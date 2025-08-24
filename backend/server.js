// backend/server.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file explicitly
dotenv.config({ path: __dirname + '/.env' });

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import protectedRoutes from './routes/protected.js';
import verifyRoute from './routes/verify.js';
import resetRoute from './routes/reset.js';
import walletRoutes from './routes/wallet.js';
import leaseRoutes from './routes/lease.js';
import s3Routes from './routes/s3Routes.js';
import listingsRoutes from './routes/listings.js';
import applyRoutes from './routes/apply.js';
import paymentRoutes from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import accessCodeRoutes from './routes/accessCode.js';

import { pollPendingPayments } from './utils/pollPendingPayments.js';

// ⬇️ NEW: import models so we can sync indexes on boot
import PendingTx from './models/PendingTx.js';
import AgentPayment from './models/AgentPayment.js';
import PaymentSession from './models/PaymentSession.js';

const app = express();

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

console.log('🔧 Attempting to connect to MongoDB at:');
try {
  console.log('Host:', process.env.MONGO_URI.split('@')[1]?.split('/')[0]);
} catch {
  // ignore if URI format differs
}

mongoose.set('strictQuery', true);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/auth/verify-email', verifyRoute);
app.use('/api/auth/reset', resetRoute);
app.use('/api/wallet', walletRoutes);
app.use('/api/lease', leaseRoutes);
app.use('/api/s3', s3Routes);
app.use('/api', listingsRoutes);
app.use('/api', applyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/access-code', accessCodeRoutes);

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4, // IPv4 only
  })
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    // ⬇️ NEW: ensure indexes are applied on startup (idempotent/safe)
    console.log('🧱 Syncing indexes...');
    await Promise.all([
      PendingTx.syncIndexes(),
      AgentPayment.syncIndexes(),
      PaymentSession.syncIndexes(),
    ]);
    console.log('🧱 Indexes synced');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // ⏰ Trigger polling every 5 minutes with a re-entrancy lock
      let polling = false;
      setInterval(async () => {
        if (polling) {
          console.warn('⏳ Previous pending-payments poll still running; skipping this tick.');
          return;
        }
        polling = true;
        try {
          console.log('⏰ Running scheduled poll for pending Bitcoin payments...');
          await pollPendingPayments();
        } catch (err) {
          console.error('❌ Error during scheduled poll:', err?.message || err);
        } finally {
          polling = false;
        }
      }, 5 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:');
    console.error(err);
  });

mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose runtime error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 Mongoose connection closed on app termination');
  process.exit(0);
});

// ⬇️ NEW: catch unhandled rejections so the process doesn’t die silently
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
});
