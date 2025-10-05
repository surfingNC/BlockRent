// backend/routes/notifications.js
import express from 'express';
import User from '../models/User.js';
import AgentPayment from '../models/AgentPayment.js';
import { sendSubscriptionConfirmationEmail } from '../utils/mailer.js';

const router = express.Router();

/**
 * Resolve a recipient + purchase (Stripe-only) from hints.
 */
async function resolveRecipientAndPurchase({
  email,
  txId,
  checkoutSessionId,
  invoiceId,
  subscriptionId,
}) {
  let em = typeof email === 'string' && email !== 'null'
    ? email.trim().toLowerCase()
    : null;

  // Prefer strongest identifiers first
  let ap =
    (txId && await AgentPayment.findOne({ txId }).lean()) ||
    (checkoutSessionId && await AgentPayment.findOne({ checkoutSessionId }).lean()) ||
    (invoiceId && await AgentPayment.findOne({ invoiceId }).lean()) ||
    (subscriptionId && await AgentPayment.findOne({ subscriptionId }).lean()) ||
    (em && await AgentPayment.findOne({ email: em, confirmed: true }).sort({ latestEventAt: -1, validUntil: -1 }).lean()) ||
    null;

  // Finalize email from AgentPayment if not provided
  if (!em && ap?.email) em = ap.email;

  // Friendly display name
  let username = 'BlockRent Agent';
  if (em) {
    const u = await User.findOne({ email: em }).lean();
    if (u?.username) username = u.username;
  }

  return { email: em, username, agentPayment: ap };
}

/**
 * POST /api/notifications/subscription-confirmed
 * Body may include any of:
 *  - email
 *  - txId                (we store Stripe refs like session.id in txId)
 *  - checkoutSessionId   (cs_...)
 *  - invoiceId           (in_...)
 *  - subscriptionId      (sub_...)
 *  - planType            (fallback if AgentPayment not found)
 */
router.post('/subscription-confirmed', async (req, res) => {
  try {
    const { email, txId, checkoutSessionId, invoiceId, subscriptionId, planType } = req.body || {};

    const { email: em, username, agentPayment: ap } =
      await resolveRecipientAndPurchase({ email, txId, checkoutSessionId, invoiceId, subscriptionId });

    if (!em) {
      console.warn('[notifications] subscription-confirmed: could not resolve email', {
        txId, checkoutSessionId, invoiceId, subscriptionId,
      });
      return res.json({
        ok: true,
        emailed: false,
        reason: 'email_not_found',
        txId: txId ?? ap?.txId ?? null,
        checkoutSessionId: checkoutSessionId ?? ap?.checkoutSessionId ?? null,
        invoiceId: invoiceId ?? ap?.invoiceId ?? null,
        subscriptionId: subscriptionId ?? ap?.subscriptionId ?? null,
      });
    }

    // Pull details from AgentPayment if available
    const plan = ap?.type ?? planType ?? null;
    const mode = ap?.mode ?? (plan === 'unlimited' ? 'subscription' : 'payment');
    const validUntil = ap?.validUntil ?? null;
    const amountCents = ap?.amountPaid ?? null;
    const currency = ap?.currency ?? 'usd';
    const ref = ap?.txId ?? txId ?? null;

    // Send the confirmation email
    const r = await sendSubscriptionConfirmationEmail({
      to: em,
      plan,
      mode,
      amountCents,
      currency,
      validUntil,
      ref,
    });

    // Mark that we sent a confirmation for this record (if we found one)
    if (ap?._id && !ap.confirmationEmailSentAt) {
      await AgentPayment.updateOne(
        { _id: ap._id },
        { $set: { confirmationEmailSentAt: new Date() } }
      );
    }

    return res.json({
      ok: Boolean(r.ok || r.skipped),
      emailed: Boolean(r.ok),
      email: em,
      username,
      plan,
      mode,
      validUntil,
      txId: ap?.txId ?? txId ?? null,
      checkoutSessionId: ap?.checkoutSessionId ?? checkoutSessionId ?? null,
      invoiceId: ap?.invoiceId ?? invoiceId ?? null,
      subscriptionId: ap?.subscriptionId ?? subscriptionId ?? null,
    });
  } catch (err) {
    console.error('[notifications] subscription-confirmed error:', err);
    return res.status(500).json({ error: 'Failed to send email notification' });
  }
});

export default router;
