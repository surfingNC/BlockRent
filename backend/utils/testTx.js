// backend/utils/testTx.js
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import mongoose from 'mongoose';
import { fetchTxDetails, parseTxForSubscription } from './txUtils.js';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';

const MONGO_URI = process.env.MONGO_URI;
const simulate = process.argv.includes('--simulate');
const txId = process.argv[2];

if (!txId) {
  console.error('❌ Please provide a txId.');
  console.log('Usage: node backend/utils/testTx.js <txid> [--simulate]');
  process.exit(1);
}

async function main() {
  if (simulate) {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for simulation.');
  }

  console.log(`\n🔍 Testing transaction: ${txId}`);
  const details = await fetchTxDetails(txId);
  const { confirmed, amountSats, subTier } = parseTxForSubscription(details);

  console.log(`\n=== TX SUMMARY ===`);
  console.log(`Confirmed: ${confirmed}`);
  console.log(`Amount to BTC_RECEIVE_ADDRESS: ${amountSats} sats`);
  console.log(
    subTier
      ? `Matched Subscription Tier: ${subTier.type} (${subTier.sats} sats)`
      : `No matching subscription tier.`
  );

  if (simulate && subTier) {
    if (confirmed) {
      await AgentPayment.create({
        walletAddress: 'SIM_TEST_WALLET',
        email: 'sim@test.com',
        txId,
        amountSats,
        type: subTier.type,
        validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
        listingCount: subTier.listingCount,
        confirmed: true,
      });
      console.log('✅ Simulated confirmed payment saved to AgentPayment.');
    } else {
      await PendingTx.updateOne(
        { txId },
        {
          txId,
          walletAddress: 'SIM_TEST_WALLET',
          email: 'sim@test.com',
          amountSats,
          type: subTier.type,
        },
        { upsert: true }
      );
      console.log('🕓 Simulated unconfirmed payment saved to PendingTx.');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
