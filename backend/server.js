import './env.js';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ---------- PATH HELPERS (ESM) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`🔐 Stripe mode: ${process.env.STRIPE_MODE || '(not set)'}`);

// ---------- ROUTES ----------
import User from './models/User.js';
import Verification from './models/Verification.js';
import AgentPayment from './models/AgentPayment.js';

import authRoutes from './routes/auth.js';
import protectedRoutes from './routes/protected.js';
import walletRoutes from './routes/wallet.js';
import leaseRoutes from './routes/lease.js';
import s3Routes from './routes/s3Routes.js';
import listingsRoutes from './routes/listings.js';
import applyRoutes from './routes/apply.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import accessCodeRoutes from './routes/accessCode.js';
import stripeRoutes from './routes/stripe.js';
import stripeWebhook from './routes/stripeWebhook.js';
import manageListingsRoutes from './routes/managelistings.js';
import applicationRoutes from './routes/applications.js';
import dealersRoutes from './routes/dealers.js';

const app = express();

// Reverse proxies (Render/Fly/etc.) need this for correct req.protocol/IP.
app.set('trust proxy', 1);

// ---------- REQUIRED ENV (FAIL FAST) ----------
const required = ['MONGO_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ---------- DATABASE CONFIG ----------
mongoose.set('strictQuery', true);

// ---------- BASIC SECURITY HEADERS (no extra deps) ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// ---------- SIMPLE IN-MEMORY RATE LIMITER (no extra deps) ----------
function rateLimit({ windowMs, max, keyFn }) {
  const hits = new Map();
  const keyOf = keyFn || ((req) => req.ip || 'unknown');

  // Cleanup to avoid unbounded growth
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits.entries()) {
      if (!v || v.resetAt <= now) hits.delete(k);
    }
  }, Math.max(30_000, Math.floor(windowMs / 2))).unref?.();

  return (req, res, next) => {
    const key = keyOf(req);
    const now = Date.now();

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }

    next();
  };
}



// ---------- CORS (production-safe) ----------
// If you deploy frontend + backend on the same domain, CORS is effectively unnecessary.
// If you deploy frontend separately, set PUBLIC_APP_URL to that exact origin (no path).
const allowedOrigins = new Set(
  [
    process.env.PUBLIC_APP_URL,      // e.g. https://blocklease.app
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Optional: only needed if you ever open the app directly from :5000 in dev
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ]
    .filter(Boolean)
    .map((o) => String(o).replace(/\/$/, '')) // normalize trailing slash
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Stripe CLI/webhooks/Postman (no Origin header)
      const normalized = String(origin).replace(/\/$/, '');
      if (allowedOrigins.has(normalized)) return cb(null, true);

      // IMPORTANT: do not throw—just deny.
      return cb(null, false);
    },
    credentials: true,
  })
);



// 1) Stripe webhook FIRST — must receive raw body BEFORE any JSON parser.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// 2) Standard parsers for everything else
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// ---------- RATE LIMIT ZONES ----------
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));
app.use('/api/s3', rateLimit({ windowMs: 15 * 60 * 1000, max: 120 }));
app.use('/api/stripe', rateLimit({ windowMs: 15 * 60 * 1000, max: 120 }));

// ---------- ROUTE MOUNTS ----------
app.use('/api/stripe', stripeRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/lease', leaseRoutes);
app.use('/api/s3', s3Routes);
app.use('/api', listingsRoutes);
app.use('/api', applyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/access-code', accessCodeRoutes);
app.use('/api/managelistings', manageListingsRoutes);

app.use('/api/dealers', dealersRoutes);
app.use('/api/applications', applicationRoutes);

// ---------- SERVE FRONTEND (PRODUCTION SINGLE-SERVER) ----------
if (process.env.NODE_ENV === 'production') {
  // CRA build output: <repo-root>/build
  const buildPath = join(__dirname, '..', 'build');
  app.use(express.static(buildPath));

  // Any non-API route should return the React app
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    return res.sendFile(join(buildPath, 'index.html'));
  });
}

// ---------- START SERVER ----------
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4,
  })
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    try {
      console.log('🧱 Syncing indexes...');
      await Promise.all([
        AgentPayment.syncIndexes(),
        User.syncIndexes(),
        Verification.syncIndexes(),
      ]);
      console.log('🧱 Indexes synced');
    } catch (err) {
      console.warn('⚠️ Index sync failed (continuing):', err?.message || err);
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });

// ---------- CONNECTION LOGGING ----------
mongoose.connection.on('connected', () => console.log('✅ Mongoose connection established'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose runtime error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongoose disconnected from MongoDB'));

// ---------- GRACEFUL SHUTDOWN ----------
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 Mongoose connection closed on app termination');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
});
