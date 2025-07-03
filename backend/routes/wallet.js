import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyEcdsaSignature, verifyTaprootSignature } from '../utils/verifySignature.js';

const router = express.Router();
const challenges = new Map();

// === 🔐 GET Challenge Route ===
router.get('/challenge', (req, res) => {
  const challenge = `blockrent-challenge-${Date.now()}`;
  challenges.set(challenge, true);
  console.log('🆕 [Challenge] Generated:', challenge);
  res.json({ challenge });
});

// === 👛 POST Wallet Connect ===
router.post('/connect', async (req, res) => {
  const { pubkey, signature, challenge, address, balance } = req.body;

  if (!pubkey || !signature || !challenge || !address) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  if (!challenges.has(challenge)) {
    return res.status(400).json({ error: 'Invalid or expired challenge' });
  }

  challenges.delete(challenge);

  const isTaproot = address.toLowerCase().startsWith('bc1p');
  let valid = false;

  try {
    if (isTaproot) {
      console.log('🔍 Verifying Taproot Schnorr signature...');
      valid = verifyTaprootSignature(pubkey, challenge, signature);
    } else {
      console.log('🔍 Verifying ECDSA signature...');
      valid = verifyEcdsaSignature(pubkey, challenge, signature);
    }
  } catch (err) {
    console.error('❌ Verification error:', err);
    return res.status(500).json({ error: 'Verification error' });
  }

  if (!valid) {
    console.warn(`❌ Invalid signature for ${address}`);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ✅ Decode JWT and update user record
  try {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const update = {
      btcWallet: address,
      walletVerified: true,
    };

    if (balance !== undefined) {
      update.walletBalance = balance;
    }

    const user = await User.findByIdAndUpdate(userId, update, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ Wallet connected and saved for user: ${user.username}`);
    res.json({ message: 'Wallet connected successfully' });
  } catch (err) {
    console.error('❌ Failed to update user:', err);
    res.status(500).json({ error: 'Failed to update user with wallet info' });
  }
});

export default router;
