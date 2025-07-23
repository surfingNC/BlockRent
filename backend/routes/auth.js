// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import { sendVerificationEmail } from '../utils/sendEmail.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// === 🔢 Generate 6-digit Code ===
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// === 📩 REGISTER (temporary - save to verification) ===
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store full user data in Verification
    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        username,
        password: hashedPassword,
        code: verificationCode, // raw code (or hash it if you prefer)
        expiresAt,
      },
      { upsert: true, new: true }
    );

    await sendVerificationEmail(email, verificationCode);
    console.log(`📨 Code ${verificationCode} sent to ${email}`);

    res.status(201).json({ msg: 'Verification code sent to your email' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

// === ✅ VERIFY EMAIL & CREATE USER ===
router.post('/verify-email/verify', async (req, res) => {
  const { email, code } = req.body;

  try {
    const record = await Verification.findOne({ email });

    if (!record || record.expiresAt < Date.now()) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    if (record.code !== code) {
      return res.status(400).json({ msg: 'Incorrect verification code' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email already registered' });
    }

    const newUser = new User({
      username: record.username,
      email: record.email,
      password: record.password,
      isVerified: true,
    });

    await newUser.save();
    await Verification.deleteOne({ _id: record._id });

    res.status(200).json({ msg: 'Email verified and user registered successfully' });
  } catch (err) {
    console.error('❌ Verification error:', err);
    res.status(500).json({ msg: 'Server error during verification' });
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

// === 🧪 DEV-ONLY RESET ROUTE ===
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

export default router;
