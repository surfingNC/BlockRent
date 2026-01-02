import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import { sendVerificationEmail } from '../utils/sendEmail.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const normEmail = (v) => String(v || '').trim().toLowerCase();
const normUsername = (v) => String(v || '').trim();
const toLower = (v) => String(v || '').trim().toLowerCase();

/**
 * POST /api/auth/register
 * body: { email, username, password }
 */
router.post('/register', async (req, res) => {
  const email = normEmail(req.body.email);
  const username = normUsername(req.body.username);
  const password = String(req.body.password || '');

  if (!email || !username || !password) {
    return res.status(400).json({ msg: 'Username, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ msg: 'Password must be at least 8 characters' });
  }

  const usernameLower = toLower(username);

  try {
    /**
     * Defensive duplicate checks:
     * - primary: email + usernameLower
     * - legacy: username (case-insensitive) for old docs missing usernameLower
     */
    const [userHit, pendingHit] = await Promise.all([
      User.findOne({
        $or: [{ email }, { usernameLower }, { username }],
      }).collation({ locale: 'en', strength: 2 }), // makes { username } case-insensitive

      Verification.findOne({
        $or: [{ email }, { usernameLower }, { username }],
      }).collation({ locale: 'en', strength: 2 }),
    ]);

    if (userHit || pendingHit) {
      return res.status(409).json({ msg: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create pending verification ONLY AFTER we know username/email are free
    await Verification.create({
      email,
      username,
      usernameLower,
      passwordHash,
      codeHash,
      expiresAt,
      attempts: 0,
      resendCount: 0,
      lastSentAt: new Date(),
    });

    // Send code last (so we never email if DB says it's not valid)
    await sendVerificationEmail(email, code);

    return res.status(201).json({ msg: 'Verification code sent to your email' });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'value';
      return res.status(409).json({ msg: `${field} already in use` });
    }
    console.error('❌ Registration error:', err);
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
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    if ((record.attempts || 0) >= 6) {
      return res.status(429).json({ msg: 'Too many attempts. Please request a new code.' });
    }

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) {
      await Verification.updateOne({ email }, { $inc: { attempts: 1 } });
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    // Indexes are source of truth; this is a friendly error message
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

    return res.status(200).json({ msg: 'Email verified and user registered successfully' });
  } catch (err) {
    console.error('❌ Verification error:', err);
    return res.status(500).json({ msg: 'Server error during verification' });
  }
});

/**
 * POST /api/auth/login
 * body: { identifier, password }
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

    // IMPORTANT: password is select:false, so we must select it
    const user = await User.findOne(isEmail ? { email } : { usernameLower }).select('+password');

    if (!user) {
      return res.status(400).json({ msg: 'Invalid username/email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid username/email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ msg: 'Email not verified. Please check your inbox.' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
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

// DEV ONLY
router.post('/reset', async (_req, res) => {
  try {
    await User.deleteMany({});
    await Verification.deleteMany({});
    return res.status(200).json({ msg: 'Database reset successful' });
  } catch (err) {
    console.error('❌ Reset error:', err);
    return res.status(500).json({ msg: 'Error resetting database' });
  }
});

export default router;
