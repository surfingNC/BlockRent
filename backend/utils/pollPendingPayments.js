// ✅ 3. utils/pollPendingPayments.js

import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import fetch from 'node-fetch';
import AgentPayment from '../models/AgentPayment.js';
import PendingTx from '../models/PendingTx.js';
import { sendSubscriptionConfirmationEmail } from './sendEmail.js';

/**
 * Polls unconfirmed transactions from PendingTx or one specific txId.
 * If a tx is confirmed and meets payment conditions, moves it to AgentPayment.
 */
export async function pollPendingPayments(specificTxId = null) {
  try {
    const query = specificTxId ? { txId: specificTxId } : {};
    const pendingPayments = await PendingTx.find(query);

    if (pendingPayments.length === 0) {
      console.log('🔍 No pending payments to check.');
      return;
    }

    console.log(`🔄 Checking ${pendingPayments.length} pending transaction(s)...`);

    for (const tx of pendingPayments) {
      try {
        const res = await fetch(`https://mempool.space/api/tx/${tx.txId}`);
        if (!res.ok) {
          console.warn(`⚠️ Failed to fetch tx ${tx.txId}`);
          continue;
        }

        const data = await res.json();
        const confirmed = data?.status?.confirmed;
        const outputs = data?.vout || [];

        const match = outputs.find(o => o.scriptpubkey_address === process.env.BTC_RECEIVE_ADDRESS);
        const amountSats = match?.value || 0;

        if (confirmed && match) {
          // Save to AgentPayment
          await AgentPayment.create({
            walletAddress: tx.walletAddress,
            txId: tx.txId,
            amountSats,
            type: tx.type || 'basic',
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            listingCount: tx.type === 'pro' ? 5 : tx.type === 'unlimited' ? Infinity : 1
          });

          // Cleanup
          await PendingTx.deleteOne({ txId: tx.txId });

          // Notify user
          await sendSubscriptionConfirmationEmail(tx.walletAddress, tx.type || 'basic');

          console.log(`✅ Confirmed & recorded tx: ${tx.txId} (${tx.walletAddress})`);
        } else {
          console.log(`⏳ Still unconfirmed or no payment match for tx: ${tx.txId}`);
        }
      } catch (err) {
        console.error(`❌ Error checking ${tx.txId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Polling failed:', err.message);
  }
}
