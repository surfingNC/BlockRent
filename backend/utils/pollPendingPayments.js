import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import fetch from 'node-fetch';
import AgentPayment from '../models/AgentPayment.js';
import PendingTx from '../models/PendingTx.js';
import { sendSubscriptionConfirmationEmail } from './sendEmail.js';
import { determineSubscription } from './subscriptionTiers.js';

const BTC_RECEIVE_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

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

        const match = outputs.find(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
        const amountSats = match?.value || 0;

        const sub = determineSubscription(amountSats);

        if (confirmed && match && sub) {
          await AgentPayment.create({
            walletAddress: tx.walletAddress,
            email: tx.email || null,
            txId: tx.txId,
            amountSats,
            type: sub.type,
            validUntil: new Date(Date.now() + sub.durationDays * 24 * 60 * 60 * 1000),
            listingCount: sub.listingCount,
            confirmed: true,
          });

          await PendingTx.deleteOne({ txId: tx.txId });

          if (tx.email) {
            await sendSubscriptionConfirmationEmail(tx.email, sub.type);
            console.log(`📧 Email sent to ${tx.email}`);
          } else {
            console.log(`ℹ️ No email provided — skipping notification`);
          }

          console.log(`✅ Confirmed & recorded tx: ${tx.txId} (${tx.walletAddress})`);
        } else {
          console.log(`⏳ Still unconfirmed or invalid sats for tx: ${tx.txId}`);
        }
      } catch (err) {
        console.error(`❌ Error checking ${tx.txId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Polling failed:', err.message);
  }
}
