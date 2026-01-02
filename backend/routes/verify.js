import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Verification from '../models/Verification.js';

const router = express.Router();

const normEmail = (v) => String(v || '').trim().toLowerCase();

// === ✅ EMAIL VERIFICATION ROUTE ===
// Expected body: { email, code }
router.post('/verify', async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ msg: 'Email and code are required' });
  }

  try {
    const verificationRecord = await Verification.findOne({ email });

    if (!verificationRecord) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    // expiresAt is Date; compare properly
    if (verificationRecord.expiresAt.getTime() < Date.now()) {
      await Verification.deleteOne({ email }); // cleanup
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    // brute-force mitigation
    if ((verificationRecord.attempts || 0) >= 6) {
      return res.status(429).json({ msg: 'Too many attempts. Please request a new code.' });
    }

    // Compare against codeHash (not plaintext)
    const isCodeValid = await bcrypt.compare(code, verificationRecord.codeHash);
    if (!isCodeValid) {
      await Verification.updateOne({ email }, { $inc: { attempts: 1 } });
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    // Prevent duplicates across User collection (case-insensitive username)
    const usernameLower = verificationRecord.usernameLower || verificationRecord.username.toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email }, { usernameLower }],
    });

    if (existingUser) {
      // if already registered, remove pending record so user can proceed to login
      await Verification.deleteOne({ email });
      return res.status(409).json({ msg: 'Username or email already taken' });
    }

    const newUser = new User({
      username: verificationRecord.username,
      email: verificationRecord.email,
      password: verificationRecord.passwordHash,
      isVerified: true,
    });

    try {
      await newUser.save();
    } catch (err) {
      // race-condition safe uniqueness handling
      if (err?.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'value';
        return res.status(409).json({ msg: `${field} already in use` });
      }
      throw err;
    }

    await Verification.deleteOne({ email });

    return res.status(201).json({ msg: 'Email verified and user registered successfully' });
  } catch (err) {
    console.error('❌ Verification error:', err);
    return res.status(500).json({ msg: 'Server error during verification' });
  }
});

export default router;
