import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';

import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { determineSubscription, SUBSCRIPTIONS } from '../utils/subscriptionTiers.js';
import sendConfirmationEmail from '../utils/Application/Email.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

const VERBOSE = false;
const debug = (...args) => VERBOSE && console.log(...args);

async function connectToDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ PaymentWatcher: Connected to MongoDB');
  } catch (error) {
    console.error('❌ PaymentWatcher DB error:', error);
    process.exit(1);
  }
}

/**
 * STEP 1: Fetch recent transactions to BTC_RECEIVE_ADDRESS
 */
async function fetchIncomingTxs() {
  if (!BTC_RECEIVE_ADDRESS) {
    console.error('❌ BTC_RECEIVE_ADDRESS is missing in .env');
    return;
  }

  debug(`🔍 Checking for new transactions to: ${BTC_RECEIVE_ADDRESS}`);

  try {
    const { data } = await axios.get(
      `https://mempool.space/api/address/${BTC_RECEIVE_ADDRESS}/txs`
    );

    for (const tx of data) {
      const txId = tx.txid;
      const outputs = tx.vout || tx.outputs || [];
      const output = outputs.find(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);

      if (!output) continue;

      const amountSats = output.value;
      const subTier = determineSubscription(amountSats);

      if (!subTier) {
        debug(`⚠️ Tx ${txId} doesn't match any subscription tier`);
        continue;
      }

      const confirmed = tx.status?.confirmed || false;

      const pendingRecord = await PendingTx.findOne({ txId });

      if (!pendingRecord?.email) {
        console.warn(`⚠️ Skipping tx ${txId} — missing email in PendingTx`);
        continue; // ⛔️ Do not proceed without a valid email
      }

      const email = pendingRecord?.email;
      const walletAddress = pendingRecord?.walletAddress || null;

      if (confirmed) {
        const existingPayment = await AgentPayment.findOne({ txId, confirmed: true });
        if (existingPayment) {
          debug(`⏩ Tx ${txId} already confirmed, skipping.`);
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
          { upsert: true, new: true }
        );

        if (pendingRecord) {
          await PendingTx.deleteOne({ txId });
        }

        debug(`✅ Confirmed tx ${txId} recorded in AgentPayment`);
      } else {
        await PendingTx.findOneAndUpdate(
          { txId },
          {
            txId,
            walletAddress,
            email,
            amountSats,
            type: subTier.type,
          },
          { upsert: true, new: true }
        );
        debug(`🕓 Tx ${txId} is unconfirmed — saved to PendingTx`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching address txs:', error.message);
  }
}

/**
 * STEP 2: Poll PendingTx for confirmations
 */
async function checkPendingPayments() {
  debug('⏰ Checking pending transactions for confirmation...');
  const pendingTxs = await PendingTx.find({});

  if (pendingTxs.length === 0) {
    debug('🔍 No pending payments to check.');
    return;
  }

  for (const tx of pendingTxs) {
    const { txId, email, walletAddress, amountSats, type } = tx;

    try {
      const { data } = await axios.get(`https://mempool.space/api/tx/${txId}`);
      const confirmed =
        data.status === 'confirmed' || (data.confirmations && data.confirmations >= 1);

      if (confirmed) {
        const existingPayment = await AgentPayment.findOne({ txId, confirmed: true });
        if (existingPayment) {
          debug(`⏩ Tx ${txId} already confirmed, skipping.`);
          await PendingTx.deleteOne({ txId });
          continue;
        }

        const tier = SUBSCRIPTIONS.find(sub => sub.type === type) || determineSubscription(amountSats);
        if (!tier) {
          console.warn(`⚠️ No matching subscription tier found for tx ${txId}`);
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
          { upsert: true, new: true }
        );

        await sendConfirmationEmail(email, tier);
        await PendingTx.deleteOne({ txId });

        debug(`✅ Confirmed tx ${txId} moved to AgentPayment`);
      } else {
        debug(`⏳ Still pending: ${txId}`);
      }
    } catch (err) {
      console.error(`❌ Error polling tx ${txId}:`, err.response?.data || err.message);
    }
  }
}

/**
 * STEP 3: Clean expired payments
 */
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

/**
 * START WATCHER
 */
async function startWatcher() {
  await connectToDB();
  console.log('🔁 PaymentWatcher is running every 60 seconds...');
  setInterval(async () => {
    await Promise.all([
      fetchIncomingTxs(),
      checkPendingPayments(),
      cleanUpExpiredPayments()
    ]);
  }, 60 * 1000);
}

startWatcher();
