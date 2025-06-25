import express from 'express';
import { verifyEcdsaSignature, verifyTaprootSignature } from '../utils/verifySignature.js';

const router = express.Router();
const challenges = new Map();

// Challenge GET route
router.get('/challenge', (req, res) => {
  const challenge = `blockrent-challenge-${Date.now()}`;
  challenges.set(challenge, true);
  console.log('🆕 [Challenge] Generated:', challenge);
  res.json({ challenge });
});

// Wallet connect POST route
router.post('/connect', (req, res) => {
  const { pubkey, signature, challenge, address } = req.body;

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

  console.log(`✅ Wallet connected: ${address}`);
  res.json({ message: 'Wallet connected successfully' });
});

export default router;
