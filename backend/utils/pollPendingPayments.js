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
          console.log(`\n📦 TX: ${tx.txId}`);
          console.log(`Confirmed: ${confirmed}`);
          console.log(`Amount (sats): ${amountSats}`);
          console.log(`Detected Subscription Tier: ${subTier?.type || 'None'}`);
        }

        // Ensure tx has necessary fields
        if (!tx.email) {
          console.warn(`⚠️ Missing email for tx ${tx.txId}. Skipping.`);
          continue;
        }

        if (!tx.walletAddress) {
          console.warn(`⚠️ Missing walletAddress for tx ${tx.txId}. Skipping.`);
          continue;
        }

        if (confirmed && subTier) {
          // Create subscription record
          await AgentPayment.create({
            walletAddress: tx.walletAddress,
            email: tx.email,
            txId: tx.txId,
            amountSats,
            type: subTier.type,
            validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
            listingCount: subTier.listingCount,
            confirmed: true,
          });

          // Remove from pending
          await PendingTx.deleteOne({ txId: tx.txId });

          // Send confirmation email
          try {
            await sendSubscriptionConfirmationEmail(tx.email, subTier.type);
            console.log(`📧 Confirmation email sent to ${tx.email}`);
          } catch (emailErr) {
            console.error(`❌ Failed to send email to ${tx.email}: ${emailErr.message}`);
          }

          console.log(`✅ Confirmed and recorded TX: ${tx.txId}`);
        } else {
          console.log(`⏳ TX ${tx.txId} is still unconfirmed or does not meet subscription tier.`);
        }
      } catch (err) {
        console.error(`❌ Error processing tx ${tx.txId}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to poll pending payments:', err.message);
  }
}
