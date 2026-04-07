import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import { sendMail } from '../utils/mailer.js';

const router = express.Router();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // This should never happen because server.js fail-fast checks required env vars.
    // Keep it explicit so logs are clear if something misconfigures production.
    console.error('❌ JWT_SECRET is not set at request time');
    return null;
  }
  return secret;
}



function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const normEmail = (v) => String(v || '').trim().toLowerCase();
const normUsername = (v) => String(v || '').trim();
const toLower = (v) => String(v || '').trim().toLowerCase();

async function sendVerificationEmail(to, code) {
  const subject = 'BlockLease Email Verification Code';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.4;">
      <h2 style="margin: 0 0 12px 0;">Verify your email</h2>
      <p style="margin: 0 0 12px 0;">Your verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 0 0 12px 0;">${code}</p>
      <p style="margin: 0; color: #555;">This code expires in 10 minutes.</p>
    </div>
  `.trim();

  const text = `Your BlockLease verification code is: ${code} (expires in 10 minutes)`;

  return sendMail({ to, subject, html, text });
}

/**
 * POST /api/auth/register
 * body: { email, username, password }
 */
router.post('/register', async (req, res) => {
  const email = normEmail(req.body.email);
  const username = normUsername(req.body.username);
  const password = String(req.body.password || '');

  if (!email || !username || !password) {
    return res.status(400).json({ msg: 'Email, username, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters' });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ msg: 'Invalid email format' });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ email }, { usernameLower: toLower(username) }],
    });

    if (existingUser) {
      return res.status(409).json({ msg: 'Email or username already registered' });
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Verification.findOneAndUpdate(
      { email },
      {
        email,
        username,
        usernameLower: toLower(username),
        passwordHash,
        codeHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mailResult = await sendVerificationEmail(email, code);

    // Dev convenience: if no email provider is configured, return the code only in non-production.
    const debugCode =
      process.env.NODE_ENV !== 'production' && mailResult?.skipped ? { code } : {};

    return res.status(200).json({
      msg: 'Verification code sent to email',
      ...debugCode,
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ msg: 'Email or username already registered' });
    }
    return res.status(500).json({ msg: 'Server error during registration' });
  }
});

/**
 * POST /api/auth/verify-email
 * body: { email, code }
 */
router.post('/verify-email', async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ msg: 'Email and code are required' });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ msg: 'Invalid code format' });
  }

  try {
    const record = await Verification.findOne({ email });

    if (!record) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await Verification.deleteOne({ email });
      return res.status(400).json({ msg: 'Verification code expired. Please register again.' });
    }

    if ((record.attempts || 0) >= 5) {
      await Verification.deleteOne({ email });
      return res.status(429).json({ msg: 'Too many attempts. Please register again.' });
    }

    const codeOk = await bcrypt.compare(code, record.codeHash);
    if (!codeOk) {
      record.attempts = (record.attempts || 0) + 1;
      await record.save();
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { usernameLower: record.usernameLower }],
    });

    if (existingUser) {
      await Verification.deleteOne({ email });
      return res.status(409).json({ msg: 'Username or email already registered' });
    }

    const newUser = new User({
      username: record.username,
      email: record.email,
      password: record.passwordHash,
      isVerified: true,
    });

    try {
      await newUser.save();
    } catch (err) {
      if (err?.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'value';
        return res.status(409).json({ msg: `${field} already in use` });
      }
      throw err;
    }

    await Verification.deleteOne({ email });

    const secret = getJwtSecret();
    if (!secret) return res.status(500).json({ msg: 'Server misconfiguration' });

    const token = jwt.sign(
      { id: newUser._id, username: newUser.username, email: newUser.email },
      secret,
      { expiresIn: '1h' }
    );

    return res.status(201).json({
      msg: 'Email verified successfully',
      token,
      username: newUser.username,
      email: newUser.email,
    });
  } catch (err) {
    console.error('❌ Verify error:', err);
    return res.status(500).json({ msg: 'Server error during verification' });
  }
});

/**
 * POST /api/auth/login
 * body: { identifier, password } where identifier = email OR username
 */
router.post('/login', async (req, res) => {
  const identifierRaw = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');

  if (!identifierRaw || !password) {
    return res.status(400).json({ msg: 'Email/Username and password are required' });
  }

  try {
    const isEmail = identifierRaw.includes('@');
    const email = normEmail(identifierRaw);
    const usernameLower = toLower(identifierRaw);

    const user = await User.findOne(isEmail ? { email } : { usernameLower }).select('+password');

    if (!user) return res.status(401).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ msg: 'Invalid credentials' });

    const secret = getJwtSecret();
    if (!secret) return res.status(500).json({ msg: 'Server misconfiguration' });

    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      secret,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      msg: 'Login successful',
      token,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json({ msg: 'Server error during login' });
  }
});

export default router;
