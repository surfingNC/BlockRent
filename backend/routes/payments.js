// ✅ backend/routes/payments.js

import express from 'express';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { checkTxConfirmed, getTxDetails } from '../utils/checkTxConfirmed.js';
import { pollPendingPayments } from '../utils/pollPendingPayments.js';

const router = express.Router();

/**
 * @route POST /api/payments/verify-payment
 */
router.post('/verify-payment', async (req, res) => {
  const { txId, walletAddress } = req.body;
  if (!txId || !walletAddress)
    return res.status(400).json({ error: 'Missing txId or walletAddress' });

  try {
    const confirmed = await checkTxConfirmed(txId);

    if (!confirmed) {
      await PendingTx.updateOne(
        { txId },
        { txId, walletAddress, amountSats: 0, type: 'basic' },
        { upsert: true }
      );

      await pollPendingPayments(txId);
      return res.json({ pending: true, message: 'Waiting for confirmation' });
    }

    const details = await getTxDetails(txId);

    await AgentPayment.create({
      walletAddress,
      txId,
      amountSats: details.amount,
      type: details.type,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      listingCount: details.listingCount || 1,
      confirmed: true,
    });

    await PendingTx.deleteOne({ txId });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * @route GET /api/payments/status
 * @desc  Check subscription status by walletAddress or email
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

export default router;
