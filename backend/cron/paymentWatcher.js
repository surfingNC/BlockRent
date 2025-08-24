// backend/jobs/paymentWatcher.js
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import PaymentSession from '../models/PaymentSession.js'; // ← for index sync
import { determineSubscription, SUBSCRIPTIONS } from '../utils/subscriptionTiers.js';
import sendConfirmationEmail from '../utils/Application/Email.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

const VERBOSE = false;
const debug = (...args) => VERBOSE && console.log(...args);

// Hardened axios instance
const http = axios.create({
  baseURL: 'https://mempool.space/api',
  timeout: 10000,
  headers: { 'User-Agent': 'BlockRent-PaymentWatcher/1.0' },
});

async function connectToDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ PaymentWatcher: Connected to MongoDB');

    // Ensure TTL/unique indexes exist (idempotent/safe)
    await Promise.all([
      PendingTx.syncIndexes(),
      AgentPayment.syncIndexes(),
      PaymentSession.syncIndexes(),
    ]);
    console.log('🧱 Watcher indexes synced');
  } catch (error) {
    console.error('❌ PaymentWatcher DB error:', error);
    process.exit(1);
  }
}

async function fetchIncomingTxs() {
  if (!BTC_RECEIVE_ADDRESS) {
    console.error('❌ BTC_RECEIVE_ADDRESS is missing in .env');
    return;
  }

  debug(`🔍 Checking for new transactions to: ${BTC_RECEIVE_ADDRESS}`);

  try {
    const { data } = await http.get(`/address/${BTC_RECEIVE_ADDRESS}/txs`);

    for (const tx of data || []) {
      const txId = tx?.txid;
      if (!txId) continue;

      const outputs = tx?.vout || tx?.outputs || [];
      const output = outputs.find((o) => o?.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
      if (!output) continue;

      const amountSats = Number(output.value ?? 0);
      const subTier = determineSubscription(amountSats);
      if (!subTier) {
        debug(`⚠️ Tx ${txId} doesn't match any subscription tier (value=${amountSats})`);
        continue;
      }

      const confirmed = Boolean(tx?.status?.confirmed);

      // If we've seen this tx before, try to hydrate from pending
      const pendingRecord = await PendingTx.findOne({ txId }).lean();

      let email = pendingRecord?.email || null;
      let walletAddress = pendingRecord?.walletAddress || null;

      // Best-effort "from" address from VINs (not authoritative)
      if (!walletAddress && Array.isArray(tx?.vin)) {
        const vinAddr = tx.vin.find((v) => v?.prevout?.scriptpubkey_address)?.prevout?.scriptpubkey_address;
        if (vinAddr) {
          walletAddress = vinAddr;
          console.log(`📬 Extracted sender wallet: ${walletAddress} from tx ${txId}`);
        }
      }

      // Link session by walletAddress if none stored yet
      let sessionId = pendingRecord?.sessionId || null;
      if (!sessionId && walletAddress) {
        const recentSess = await mongoose.connection.collection('paymentsessions').findOne({
          walletAddress,
          createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // 15m window
        });
        if (recentSess?.sessionId) {
          sessionId = recentSess.sessionId;
          if (!email && recentSess.email) email = recentSess.email;
          console.log(`✅ Linked tx ${txId} to session ${sessionId} via walletAddress`);
        }
      }

      // Hydrate via payment session if PendingTx still has placeholder
      if ((!email || email === 'unknown@blockrent.app') && sessionId) {
        const session = await mongoose.connection.collection('paymentsessions').findOne({ sessionId });
        if (session?.email) {
          email = session.email;
          walletAddress = walletAddress || session.walletAddress || null;
          await PendingTx.updateOne({ txId }, { email, walletAddress });
          console.log(`✅ Hydrated email from session for tx ${txId}: ${email}`);
        }
      }

      // If still unknown, fallback so we can track/confirm later
      if (!email) {
        email = 'unknown@blockrent.app';
      }

      if (confirmed) {
        const existingPayment = await AgentPayment.findOne({ txId, confirmed: true }).lean();
        if (existingPayment) {
          debug(`⏩ Tx ${txId} already confirmed, skipping.`);
          // ensure no stale pending remains
          await PendingTx.deleteOne({ txId });
          continue;
        }

        await AgentPayment.findOneAndUpdate(
          { txId },
          {
            txId,
            email,
            walletAddress,
            amountSats,
            type: subTier.type,
            validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
            listingCount: subTier.listingCount,
            confirmed: true,
          },
          { upsert: true, new: true, runValidators: true } // ← validators
        );

        // send email only if we have a real address
        if (email && email !== 'unknown@blockrent.app' && email.includes('@')) {
          try {
            await sendConfirmationEmail(email, subTier);
          } catch (e) {
            console.warn(`📧 Failed to send confirmation email for ${txId}:`, e.message);
          }
        }

        await PendingTx.deleteOne({ txId });
        debug(`✅ Confirmed tx ${txId} recorded in AgentPayment`);
      } else {
        // Upsert pending so later polling can confirm it
        await PendingTx.findOneAndUpdate(
          { txId },
          {
            $set: {
              walletAddress,
              email,
              amountSats,
              type: subTier.type,
              ...(sessionId ? { sessionId } : {}),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        debug(`🕓 Tx ${txId} is unconfirmed — saved to PendingTx`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching address txs:', error?.message || error);
  }
}

async function checkPendingPayments() {
  debug('⏰ Checking pending transactions for confirmation...');
  const pendingTxs = await PendingTx.find({}).lean();

  if (!pendingTxs.length) {
    debug('🔍 No pending payments to check.');
    return;
  }

  for (const tx of pendingTxs) {
    // use let so we can hydrate/mutate locally
    let { txId, email, walletAddress, amountSats, type, sessionId, createdAt } = tx;

    // ⏸️ If email is placeholder and we don't have a sessionId yet, wait up to 5m for hydration
    if (email === 'unknown@blockrent.app' && !sessionId) {
      const ageMs = Date.now() - new Date(createdAt).getTime();
      const waitMs = 5 * 60 * 1000; // 5 minutes
      if (ageMs < waitMs) {
        debug(`⏸️ Holding ${txId} up to ${waitMs / 60000}m to allow email hydration`);
        continue;
      }
    }

    // 🔄 Hydrate email/wallet from PaymentSession if PendingTx still has a placeholder
    if ((!email || email === 'unknown@blockrent.app') && sessionId) {
      try {
        const sess = await mongoose.connection
          .collection('paymentsessions')
          .findOne({ sessionId });

        if (sess?.email) {
          await PendingTx.updateOne(
            { txId },
            { email: sess.email, walletAddress: walletAddress || sess.walletAddress || null }
          );
          // reflect hydrated values locally for this loop
          email = sess.email;
          if (!walletAddress && sess.walletAddress) walletAddress = sess.walletAddress;
          console.log(`✅ Hydrated PendingTx ${txId} from session ${sessionId}: ${email}`);
        }
      } catch (e) {
        console.warn(`⚠️ Hydration lookup failed for ${txId}:`, e.message);
      }
    }

    try {
      const { data } = await http.get(`/tx/${txId}`);
      const confirmed = Boolean(data?.status?.confirmed);

      if (confirmed) {
        const existingPayment = await AgentPayment.findOne({ txId, confirmed: true }).lean();
        if (existingPayment) {
          debug(`⏩ Tx ${txId} already confirmed, skipping.`);
          await PendingTx.deleteOne({ txId });
          continue;
        }

        const tier =
          SUBSCRIPTIONS.find((sub) => sub.type === type) ||
          determineSubscription(amountSats);

        if (!tier) {
          console.warn(`⚠️ No matching subscription tier found for tx ${txId} (amount=${amountSats})`);
          await PendingTx.deleteOne({ txId }); // prevent infinite loop on bad data
          continue;
        }

        await AgentPayment.findOneAndUpdate(
          { txId },
          {
            txId,
            email,
            walletAddress,
            amountSats,
            type: tier.type,
            validUntil: new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000),
            listingCount: tier.listingCount,
            confirmed: true,
          },
          { upsert: true, new: true, runValidators: true } // ← validators
        );

        if (email && email !== 'unknown@blockrent.app' && email.includes('@')) {
          try {
            await sendConfirmationEmail(email, tier);
          } catch (e) {
            console.warn(`📧 Failed to send confirmation email for ${txId}:`, e.message);
          }
        }

        await PendingTx.deleteOne({ txId });
        debug(`✅ Confirmed tx ${txId} moved to AgentPayment`);
      } else {
        debug(`⏳ Still pending: ${txId}`);
      }
    } catch (err) {
      console.error(`❌ Error polling tx ${txId}:`, err?.response?.data || err?.message || err);
    }
  }
}

async function cleanUpOldPendingTxs() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const result = await PendingTx.deleteMany({ createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      console.log(`🧹 Deleted ${result.deletedCount} stale PendingTx records older than 24h`);
    }
  } catch (err) {
    console.error('❌ Error cleaning stale PendingTx:', err);
  }
}

async function cleanUpExpiredPayments() {
  const now = new Date();
  try {
    const result = await AgentPayment.deleteMany({ validUntil: { $lt: now } });
    if (result.deletedCount > 0) {
      console.log(`🧹 Deleted ${result.deletedCount} expired AgentPayment records`);
    }
  } catch (err) {
    console.error('❌ Error cleaning expired payments:', err);
  }
}

async function startWatcher() {
  await connectToDB();
  console.log('🔁 PaymentWatcher is running every 60 seconds...');

  let running = false;
  setInterval(async () => {
    if (running) {
      console.warn('⏳ Previous watcher tick still running; skipping this tick.');
      return;
    }
    running = true;
    try {
      await Promise.all([
        fetchIncomingTxs(),
        checkPendingPayments(),
        cleanUpOldPendingTxs(),
        cleanUpExpiredPayments(),
      ]);
    } finally {
      running = false;
    }
  }, 60 * 1000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down watcher...');
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(0);
});

// Keep process alive on unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
});

startWatcher();
