// backend/routes/notifications.js
import express from 'express';
import mongoose from 'mongoose';
import { Resend } from 'resend';

import User from '../models/User.js';
import AgentPayment from '../models/AgentPayment.js';
import PendingTx from '../models/PendingTx.js';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper: resolve wallet/email from various hints
async function resolveWalletAndEmail({ walletAddress, txId, email, sessionId }) {
  let wa = walletAddress && walletAddress !== 'null' ? walletAddress : null;
  let em = email && email !== 'null' ? email : null;

  // If we have a wallet but no email, try User by wallet
  if (wa && !em) {
    const u = await User.findOne({ walletAddress: wa }).lean();
    if (u?.email) em = u.email;
  }

  // Try resolve by txId via AgentPayment, then PendingTx
  if ((!wa || !em) && txId) {
    const ap = await AgentPayment.findOne({ txId }).lean();
    if (ap) {
      wa = wa || ap.walletAddress || null;
      em = em || ap.email || null;
    } else {
      const p = await PendingTx.findOne({ txId }).lean();
      if (p) {
        wa = wa || p.walletAddress || null;
        em = em || p.email || null;
      }
    }
  }

  // Try paymentsessions collection via sessionId
  if ((!wa || !em) && sessionId) {
    try {
      const sess = await mongoose.connection
        .collection('paymentsessions')
        .findOne({ sessionId });
      if (sess) {
        wa = wa || sess.walletAddress || null;
        em = em || sess.email || null;
      }
    } catch (e) {
      console.warn('[notifications] paymentsessions lookup failed:', e?.message);
    }
  }

  // As a last pass, if we have an email, try User to get wallet/username
  let username = 'BlockRent Agent';
  if (em) {
    const u = await User.findOne({ email: em }).lean();
    if (u?.username) username = u.username;
    if (!wa && u?.walletAddress) wa = u.walletAddress;
  }

  return { walletAddress: wa, email: em, username };
}

router.post('/subscription-confirmed', async (req, res) => {
  try {
    const { walletAddress, txId, email, sessionId } = req.body || {};

    // Derive wallet/email if not provided
    const { walletAddress: wa, email: em, username } = await resolveWalletAndEmail({
      walletAddress,
      txId,
      email,
      sessionId,
    });

    // Optionally include tier if we have a txId
    let tier = null;
    if (txId) {
      const ap = await AgentPayment.findOne({ txId }).lean();
      if (ap?.type) tier = ap.type;
    }

    // If we still don't have an email, don't fail—just report
    if (!em) {
      console.warn(
        '[notifications] subscription-confirmed: could not resolve email (wallet:%s, txId:%s, sessionId:%s)',
        wa, txId, sessionId
      );
      return res.json({
        ok: true,
        emailed: false,
        reason: 'email_not_found',
        walletAddress: wa || null,
        txId: txId || null,
        sessionId: sessionId || null,
        tier,
      });
    }

    // Send the email
    await resend.emails.send({
      from: 'BlockRent <noreply@blockrent.app>',
      to: em,
      subject: '✅ BlockRent Subscription Confirmed',
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>🎉 Subscription Confirmed</h2>
          <p>Hello ${username},</p>
          <p>Your BlockRent subscription is now active. You can start listing your properties immediately.</p>
          ${tier ? `<p><strong>Plan:</strong> ${tier}</p>` : ''}
          ${wa ? `<p><strong>Wallet:</strong> ${wa}</p>` : ''}
          ${txId ? `<p><strong>Transaction:</strong> ${txId}</p>` : ''}
          <p>Thank you for using BlockRent!</p>
          <hr />
          <p style="font-size: 0.9em; color: #888;">This is an automated message. Please do not reply.</p>
        </div>
      `,
    });

    return res.json({
      ok: true,
      emailed: true,
      email: em,
      walletAddress: wa || null,
      txId: txId || null,
      sessionId: sessionId || null,
      tier,
    });
  } catch (err) {
    console.error('[notifications] subscription-confirmed error:', err);
    return res.status(500).json({ error: 'Failed to send email notification' });
  }
});

export default router;
