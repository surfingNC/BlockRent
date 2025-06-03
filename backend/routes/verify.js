const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const User = require('../models/User');
const Verification = require('../models/Verification');

// === ✅ EMAIL VERIFICATION ROUTE ===
router.post('/verify', async (req, res) => {
  const { email, code, username, password } = req.body;

  if (!email || !code || !username || !password) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  try {
    const verificationRecord = await Verification.findOne({ email });

    if (
      !verificationRecord ||
      verificationRecord.expiresAt < Date.now()
    ) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    const isCodeValid = await bcrypt.compare(code, verificationRecord.code);
    if (!isCodeValid) {
      return res.status(400).json({ msg: 'Invalid verification code' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ msg: 'Username or email already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword, isVerified: true });

    await newUser.save();
    await Verification.deleteOne({ email });

    res.status(201).json({ msg: 'Email verified and user registered successfully' });
  } catch (err) {
    console.error('❌ Verification error:', err);
    res.status(500).json({ msg: 'Server error during verification' });
  }
});

module.exports = router;
