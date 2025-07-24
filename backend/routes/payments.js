import express from 'express';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { checkTxConfirmed, getTxDetails } from '../utils/checkTxConfirmed.js';
import { pollPendingPayments } from '../utils/pollPendingPayments.js';
import { determineSubscription, SUBSCRIPTIONS } from '../utils/subscriptionTiers.js';

const router = express.Router();

/**
 * @route POST /api/payments/verify-payment
 */
router.post('/verify-payment', async (req, res) => {
  const { txId, walletAddress, email } = req.body;

  if (!txId) {
    return res.status(400).json({ error: 'Missing txId' });
  }

  try {
    const confirmed = await checkTxConfirmed(txId);

    if (!confirmed) {
      await PendingTx.updateOne(
        { txId },
        {
          txId,
          walletAddress,
          email,
          amountSats: 0,
          type: 'basic',
        },
        { upsert: true }
      );

      await pollPendingPayments(txId);
      return res.json({ pending: true, message: 'Waiting for confirmation' });
    }

    const details = await getTxDetails(txId);
    const amountSats = details.amount;

    const matched = determineSubscription(amountSats);
    if (!matched) {
      return res.status(400).json({ error: 'Insufficient amount sent for subscription' });
    }

    await AgentPayment.create({
      walletAddress,
      email: email || null,
      txId,
      amountSats,
      type: matched.type,
      validUntil: new Date(Date.now() + matched.durationDays * 24 * 60 * 60 * 1000),
      listingCount: matched.listingCount,
      confirmed: true,
    });

    await PendingTx.deleteOne({ txId });

    return res.json({ success: true, tier: matched.type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * @route GET /api/payments/status
 */
router.get('/status', async (req, res) => {
  const { walletAddress, email } = req.query;

  if (!walletAddress && !email) {
    return res.status(400).json({ error: 'walletAddress or email is required' });
  }

  try {
    const query = walletAddress ? { walletAddress } : { email };
    const payment = await AgentPayment.findOne({
      ...query,
      confirmed: true,
    }).sort({ validUntil: -1 });

    if (!payment) {
      return res.json({ active: false });
    }

    const now = new Date();
    const active = payment.validUntil > now;
    return res.json({
      active,
      type: payment.type,
      validUntil: payment.validUntil,
      listingCount: payment.listingCount,
    });
  } catch (err) {
    console.error('❌ Error checking subscription status:', err);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

/**
 * @route GET /api/payments/tiers
 * @desc Return available subscription tiers for frontend
 */
router.get('/tiers', (req, res) => {
  const formatted = SUBSCRIPTIONS.map(tier => ({
    type: tier.type,
    label: tier.label || tier.type.charAt(0).toUpperCase() + tier.type.slice(1),
    sats: tier.sats,
    duration: `${tier.durationDays} days`,
    listings: tier.listingCount === Infinity ? 'Unlimited' : tier.listingCount,
  }));

  res.json(formatted);
});

export default router;
