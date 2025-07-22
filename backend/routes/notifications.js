// routes/notifications.js
import express from 'express';
import User from '../models/User.js';
import { Resend } from 'resend';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/subscription-confirmed', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  try {
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({ error: 'User not found for this wallet' });
    }

    await resend.emails.send({
      from: 'BlockRent <noreply@blockrent.app>',
      to: user.email,
      subject: '✅ BlockRent Subscription Confirmed',
      html: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <h2>🎉 Subscription Confirmed</h2>
          <p>Hello ${user.username || 'BlockRent Agent'},</p>
          <p>Your BlockRent subscription is now active. You can start listing your properties immediately.</p>
          <p>Thank you for using BlockRent!</p>
          <hr />
          <p style="font-size: 0.9em; color: #888;">This is an automated message. Please do not reply.</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email notification' });
  }
});

export default router;
