const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Verification = require('../models/Verification');
const sendVerificationEmail = require('../utils/sendEmail');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// === 🔢 Utility: Generate 6-digit Code ===
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// === 📩 REGISTER ROUTE ===
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ msg: 'Username, email, and password are required' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ msg: 'Username or email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(verificationCode, 10);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save verification (upsert)
    await Verification.findOneAndUpdate(
      { email },
      { code: hashedCode, expiresAt },
      { upsert: true, new: true }
    );

    // Send email with raw code
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({ msg: 'Verification code sent to your email' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

// === 🔐 LOGIN ROUTE ===
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid username or password' });

    if (!user.isVerified) {
      return res.status(403).json({ msg: 'Email not verified. Please check your inbox.' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ msg: 'Login successful', token, username: user.username });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ msg: 'Server error during login' });
  }
});

// === 🧪 DEV-ONLY: RESET ROUTE ===
router.post('/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Verification.deleteMany({});
    console.log('🧹 All users and verification records deleted.');
    res.status(200).json({ msg: 'Database reset successful' });
  } catch (err) {
    console.error('❌ Reset error:', err);
    res.status(500).json({ msg: 'Error resetting database' });
  }
});

module.exports = router;
