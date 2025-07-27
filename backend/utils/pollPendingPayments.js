// backend/utils/pollPendingPayments.js
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { fetchTxDetails, parseTxForSubscription } from './txUtils.js';
import { sendSubscriptionConfirmationEmail } from './sendEmail.js';

const DEBUG_MODE = true;

export async function pollPendingPayments(specificTxId = null) {
  try {
    const query = specificTxId ? { txId: specificTxId } : {};
    const pendingPayments = await PendingTx.find(query);

    if (pendingPayments.length === 0) {
      if (DEBUG_MODE) console.log('🔍 No pending payments to check.');
      return;
    }

    console.log(`🔄 Checking ${pendingPayments.length} pending transaction(s)...`);

    for (const tx of pendingPayments) {
      try {
        const details = await fetchTxDetails(tx.txId);
        const { confirmed, amountSats, subTier } = parseTxForSubscription(details);

        if (DEBUG_MODE) {
          console.log(`\n📦 TX ${tx.txId}`);
          console.log(`Confirmed: ${confirmed}`);
          console.log(`Detected subscription: ${subTier?.type || 'none'}`);
        }

        if (confirmed && subTier) {
          await AgentPayment.create({
            walletAddress: tx.walletAddress,
            email: tx.email || null,
            txId: tx.txId,
            amountSats,
            type: subTier.type,
            validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
            listingCount: subTier.listingCount,
            confirmed: true,
          });

          await PendingTx.deleteOne({ txId: tx.txId });

          if (tx.email) {
            sendSubscriptionConfirmationEmail(tx.email, subTier.type)
              .then(() => console.log(`📧 Email sent to ${tx.email}`))
              .catch(err => console.error('❌ Email send error:', err.message));
          }

          console.log(`✅ Confirmed & recorded tx: ${tx.txId}`);
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
