// backend/server.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Routes
import authRoutes from './routes/auth.js';
import protectedRoutes from './routes/protected.js';
import verifyRoute from './routes/verify.js';
import resetRoute from './routes/reset.js';
import walletRoutes from './routes/wallet.js';
import leaseRoutes from './routes/lease.js';
import s3Routes from './routes/s3Routes.js';
import listingsRoutes from './routes/listings.js';
import applyRoutes from './routes/apply.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import accessCodeRoutes from './routes/accessCode.js';
import stripeRoutes from './routes/stripe.js';
import manageListingsRoutes from './routes/managelistings.js';

// Models still in use (Stripe-driven access)
import AgentPayment from './models/AgentPayment.js';

const app = express();

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

mongoose.set('strictQuery', true);

// ---------- MIDDLEWARE ----------
app.use(cors({ origin: [process.env.PUBLIC_APP_URL, 'http://localhost:3000'], credentials: true }));

// IMPORTANT: Mount Stripe router (contains /webhook with express.raw) BEFORE global express.json()
app.use('/api/stripe', stripeRoutes);

// Global JSON parser for everything else
app.use(express.json());

// Simple request logger (after webhook so raw body isn’t consumed)
app.use((req, _res, next) => {
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// ---------- ROUTES ----------
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/auth/verify-email', verifyRoute);
app.use('/api/auth/reset', resetRoute);
app.use('/api/wallet', walletRoutes);
app.use('/api/lease', leaseRoutes);
app.use('/api/s3', s3Routes);
app.use('/api', listingsRoutes);
app.use('/api', applyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/access-code', accessCodeRoutes);
app.use('/api/managelistings', manageListingsRoutes);

// ---------- DB & START ----------
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4, // IPv4 only
  })
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    // Sync only the indexes we actually use now
    console.log('🧱 Syncing indexes...');
    await Promise.all([AgentPayment.syncIndexes()]);
    console.log('🧱 Indexes synced');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
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

// Catch unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
});
