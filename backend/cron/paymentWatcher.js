// backend/jobs/paymentWatcher.js
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import PaymentSession from '../models/PaymentSession.js'; // ← for index sync
import { SUBSCRIPTIONS, determineSubscription, getExpirationDate } from '../utils/subscriptionTiers.js';
import sendConfirmationEmail from '../utils/Application/Email.js';
import UnattributedTx from '../models/UnattributedTx.js';

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
      UnattributedTx.syncIndexes(),
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
      const out = outputs.find((o) => o?.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
      if (!out) continue;

      const amountSats = Number(out.value ?? 0);
      const subTier = determineSubscription(amountSats);
      if (!subTier) {
        debug(`⚠️ Tx ${txId} doesn't match any subscription tier (value=${amountSats})`);
        continue;
      }

      const confirmed = Boolean(tx?.status?.confirmed);

      // If we've seen this tx before as a confirmed payment, skip
      const alreadyPaid = await AgentPayment.findOne({ txId, confirmed: true }).lean();
      if (alreadyPaid) {
        debug(`⏩ Already recorded confirmed payment for ${txId}`);
        continue;
      }

      // Check for a PendingTx first — the normal flow will hydrate from session/email
      const pendingRecord = await PendingTx.findOne({ txId }).lean();

      let email = pendingRecord?.email || null;
      let walletAddress = pendingRecord?.walletAddress || null;
      let sessionId = pendingRecord?.sessionId || null;

      // Best-effort "from" address from VINs (not authoritative)
      if (!walletAddress && Array.isArray(tx?.vin)) {
        const vinAddr = tx.vin.find((v) => v?.prevout?.scriptpubkey_address)?.prevout?.scriptpubkey_address;
        if (vinAddr) {
          walletAddress = vinAddr;
          console.log(`📬 Extracted sender wallet: ${walletAddress} from tx ${txId}`);
        }
      }

      // If not pending and not confirmed, stage it in UnattributedTx
      if (!pendingRecord) {
        const seenAt =
          (tx?.status?.block_time && new Date(tx.status.block_time * 1000)) ||
          (tx?.status?.timestamp && new Date(tx.status.timestamp * 1000)) ||
          new Date();

        await UnattributedTx.findOneAndUpdate(
          { txId },
          {
            $setOnInsert: {
              txId,
              amountSats,
              outputs: outputs.map(o => o?.scriptpubkey_address).filter(Boolean),
              seenAt,
              walletAddress: walletAddress || null,
            },
            $set: { confirmed },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        debug(`📥 Staged UnattributedTx ${txId} (confirmed=${confirmed})`);
      }

      if (confirmed) {
        // If we can fully attribute (pending exists with type/email/session), finalize now:
        if (pendingRecord) {
          const existingPayment = await AgentPayment.findOne({ txId, confirmed: true }).lean();
          if (!existingPayment) {
            await AgentPayment.findOneAndUpdate(
              { txId },
              {
                txId,
                email: email || 'unknown@blockrent.app',
                walletAddress,
                amountSats,
                type: subTier.type,
                validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
                listingCount: subTier.listingCount,
                confirmed: true,
              },
              { upsert: true, new: true, runValidators: true }
            );

            if (email && email !== 'unknown@blockrent.app' && email.includes('@')) {
              try { await sendConfirmationEmail(email, subTier); } catch (e) {
                console.warn(`📧 Failed to send confirmation email for ${txId}:`, e.message);
              }
            }
          }

          await PendingTx.deleteOne({ txId }).catch(() => {});
          await UnattributedTx.deleteOne({ txId }).catch(() => {});
          debug(`✅ Confirmed tx ${txId} recorded in AgentPayment (from pending)`);
        } else {
          // leave in UnattributedTx for backfiller to attribute safely
          debug(`🧭 Confirmed ${txId} awaiting attribution (kept in UnattributedTx)`);
        }
      } else {
        // Not confirmed yet: ensure we have a PendingTx if we have session/email; otherwise, wait for backfill
        if (pendingRecord) {
          await PendingTx.findOneAndUpdate(
            { txId },
            {
              $set: {
                walletAddress,
                email: email || 'unknown@blockrent.app',
                amountSats,
                type: subTier.type,
                ...(sessionId ? { sessionId } : {}),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          debug(`🕓 Tx ${txId} updated/kept in PendingTx`);
        } else {
          // nothing to do; UnattributedTx already staged above
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching address txs:', error?.message || error);
  }
}

async function backfillOrphans() {
  if (process.env.BACKFILL_ENABLED !== 'true') return;

  const graceMs        = Number(process.env.BACKFILL_GRACE_MS || 45000);   // wait ≥45s before attempting
  const lookbackMin    = Number(process.env.BACKFILL_LOOKBACK_MIN || 20);  // search sessions in last 20m
  const fwdWindowMin   = Number(process.env.BACKFILL_FWD_WINDOW_MIN || 10);// up to 10m after seenAt
  const satTolerance   = Number(process.env.BACKFILL_SAT_TOL || 0);        // require exact match by default

  const now = Date.now();
  const lowerCut = new Date(now - lookbackMin * 60 * 1000);

  // Pull unattributed txs we’ve seen recently, not yet matched
  const orphans = await UnattributedTx.find({
    matchedSessionId: null,
    seenAt: { $gte: lowerCut },
  }).lean();

  if (!orphans.length) return;

  for (const tx of orphans) {
    const ageMs = now - new Date(tx.seenAt).getTime();
    if (ageMs < graceMs) continue; // let the normal flow link first

    // Determine tier from amount
    const tier = determineSubscription(tx.amountSats);
    if (!tier) {
      // Not a tier -> leave it; cleaner job will prune UnattributedTx later if desired
      continue;
    }

    // Find sessions in a time band around the tx
    const start = new Date(new Date(tx.seenAt).getTime() - 5 * 60 * 1000); // 5m before
    const end   = new Date(new Date(tx.seenAt).getTime() + fwdWindowMin * 60 * 1000);

    const candidateSessions = await PaymentSession.find({
      createdAt: { $gte: start, $lte: end },
      planType: tier.type, // must match the tier
    }).lean();

    // Optional: tighten by exact sats (recommended while using a shared address).
    // If your UI ever adds a per-session salt to the amount, change equality to "within satTolerance".
    const filtered = candidateSessions.filter(() => {
      const exact = SUBSCRIPTIONS.find(s => s.type === tier.type)?.sats ?? tier.sats;
      return Math.abs(Number(exact) - Number(tx.amountSats)) <= satTolerance;
    });

    // If not exactly ONE candidate, don't auto-link
    if (filtered.length !== 1) {
      await UnattributedTx.updateOne({ txId: tx.txId }, { candidateCount: filtered.length });
      continue;
    }

    const sess = filtered[0];

    // Upsert/ensure PendingTx with strong data (email/session)
    await PendingTx.findOneAndUpdate(
      { txId: tx.txId },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          sessionId: sess.sessionId,
          email: sess.email || 'unknown@blockrent.app',
          walletAddress: tx.walletAddress || 'unknown',
          amountSats: tx.amountSats,
          type: tier.type,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // If chain already says confirmed, mirror confirm path immediately
    if (tx.confirmed) {
      const exists = await AgentPayment.findOne({ txId: tx.txId, confirmed: true }).lean();
      if (!exists) {
        await AgentPayment.findOneAndUpdate(
          { txId: tx.txId },
          {
            txId: tx.txId,
            email: sess.email || 'unknown@blockrent.app',
            walletAddress: tx.walletAddress || 'unknown',
            amountSats: tx.amountSats,
            type: tier.type,
            validUntil: new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000),
            listingCount: tier.listingCount,
            confirmed: true,
          },
          { upsert: true, new: true, runValidators: true }
        );

        if (sess.email && sess.email.includes('@')) {
          try { await sendConfirmationEmail(sess.email, tier); } catch (e) {
            console.warn(`📧 Backfill email send failed for ${tx.txId}:`, e.message);
          }
        }
      }

      await PendingTx.deleteOne({ txId: tx.txId }).catch(() => {});
    }

    await UnattributedTx.updateOne(
      { txId: tx.txId },
      { matchedSessionId: sess.sessionId, candidateCount: 1 }
    );

    console.log(`🔗 Backfilled ${tx.txId} → session ${sess.sessionId} (${tier.type})`);
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

async function cleanUpOldUnattributed() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const r = await UnattributedTx.deleteMany({ seenAt: { $lt: cutoff } });
    if (r.deletedCount) console.log(`🧹 Deleted ${r.deletedCount} stale UnattributedTx`);
  } catch (e) {
    console.error('❌ Error cleaning UnattributedTx:', e);
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
        backfillOrphans(),
        cleanUpOldPendingTxs(),
        cleanUpExpiredPayments(),
        cleanUpOldUnattributed(),
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