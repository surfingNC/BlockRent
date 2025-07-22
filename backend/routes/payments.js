import express from 'express';
import axios from 'axios';
import AgentPayment from '../models/AgentPayment.js';

const router = express.Router();
const RECEIVING_ADDRESS = process.env.BTC_RECEIVE_ADDRESS;

// Subscription pricing (in sats)
const PRICING = {
  unlimited: { sats: 150000, durationDays: 30 },
  pro: { sats: 50000, durationDays: 30, listings: 5 },
  basic: { sats: 15000, durationDays: 90, listings: 1 },
};

router.post('/verify-payment', async (req, res) => {
  const { txId, walletAddress } = req.body;

  if (!txId || !walletAddress) {
    return res.status(400).json({ error: 'Missing txId or walletAddress' });
  }

  try {
    // Query mempool.space API
    const txRes = await axios.get(`https://mempool.space/api/tx/${txId}`);
    const { vout, status } = txRes.data;

    if (!status.confirmed) {
      return res.status(400).json({ error: 'Transaction not confirmed yet' });
    }

    // Look for payment to our receiving address
    const output = vout.find(o => o.scriptpubkey_address === RECEIVING_ADDRESS);
    if (!output) {
      return res.status(400).json({ error: 'Transaction not sent to correct address' });
    }

    const amount = output.value;
    let type = null, validUntil = null, listingCount = null;

    if (amount >= PRICING.unlimited.sats) {
      type = 'unlimited';
      validUntil = new Date(Date.now() + PRICING.unlimited.durationDays * 86400 * 1000);
    } else if (amount >= PRICING.pro.sats) {
      type = 'pro';
      listingCount = PRICING.pro.listings;
      validUntil = new Date(Date.now() + PRICING.pro.durationDays * 86400 * 1000);
    } else if (amount >= PRICING.basic.sats) {
      type = 'basic';
      listingCount = PRICING.basic.listings;
      validUntil = new Date(Date.now() + PRICING.basic.durationDays * 86400 * 1000);
    } else {
      return res.status(400).json({ error: 'Insufficient payment amount' });
    }

    const payment = new AgentPayment({
      walletAddress,
      txId,
      amountSats: amount,
      type,
      listingCount,
      validUntil,
    });

    await payment.save();

    return res.json({
      success: true,
      type,
      validUntil,
      listingCount: listingCount ?? '∞',
    });

  } catch (err) {
    console.error('❌ Payment verification error:', err.message);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
