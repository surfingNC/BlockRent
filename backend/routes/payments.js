// ✅ 2. routes/payments.js

import express from 'express';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { checkTxConfirmed, getTxDetails } from '../utils/checkTxConfirmed.js';
import { pollPendingPayments } from '../utils/pollPendingPayments.js';

const router = express.Router();

/**
 * @route POST /api/payments/verify-payment
 * @desc  Verify a Bitcoin transaction by txId and walletAddress
 *        - If unconfirmed, queue it for polling and store in PendingTx
 *        - If confirmed, store in AgentPayment and delete PendingTx
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

      await pollPendingPayments(txId); // trigger polling for this specific tx
      return res.json({ pending: true, message: 'Waiting for confirmation' });
    }

    const details = await getTxDetails(txId);

    await AgentPayment.create({
      walletAddress,
      txId,
      amountSats: details.amount,
      type: details.type,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      listingCount: details.listingCount || 1
    });

    await PendingTx.deleteOne({ txId }); // cleanup after confirmation

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
