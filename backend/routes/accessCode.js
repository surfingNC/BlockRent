// backend/routes/accessCode.js
import express from 'express';
import AgentPayment from '../models/AgentPayment.js';
import sendSubscriptionEmail from '../utils/Application/Email.js';

const router = express.Router();

const VALID_CODES = {
  bitcoinrent: {
    type: 'pro',
    durationDays: 30,
    listingCount: 5,
  },
};

router.post('/redeem', async (req, res) => {
  const { email, code } = req.body;
  const entry = VALID_CODES[code?.trim().toLowerCase()];

  if (!entry) {
    return res.status(400).json({ msg: 'Invalid promo code' });
  }

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  try {
    // Prevent duplicate redemption
    const existing = await AgentPayment.findOne({
      email,
      txId: { $regex: /^promo-/ } // Match promo-based redemptions
    });

    if (existing) {
      return res.status(400).json({ msg: 'You’ve already redeemed a promo code.' });
    }

    const validUntil = new Date(Date.now() + entry.durationDays * 86400 * 1000);

    await AgentPayment.create({
      email,
      txId: `promo-${Date.now()}`,
      amountSats: 0,
      type: entry.type,
      validUntil,
      listingCount: entry.listingCount,
      confirmed: true,
    });

    await sendSubscriptionEmail(email);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error redeeming code:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
