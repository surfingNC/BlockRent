import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log(`🔐 Stripe mode: ${process.env.STRIPE_MODE}`);

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// ---------- ROUTES ----------
import User from './models/User.js';
import Verification from './models/Verification.js';
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


// 🆕 NEW BlockLease dealership routes
import applicationRoutes from './routes/applications.js';
import dealersRoutes from './routes/dealers.js';

// Models still in use (Stripe-driven access)
import AgentPayment from './models/AgentPayment.js';

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST);

//stripe.customers.list({ limit: 5 }).then(r => console.log("Customers:", r.data));


const app = express();

// ---------- DATABASE CONFIG ----------
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

mongoose.set('strictQuery', true);

// ---------- MIDDLEWARE ----------
app.use(
  cors({
    origin: [process.env.PUBLIC_APP_URL, 'http://localhost:3000'],
    credentials: true,
  })
);



// 1️⃣ Webhook FIRST — raw body, unique mount path
app.use('/api/stripe/webhook', stripeWebhook);

// 2️⃣ Standard JSON parser for everything else
app.use(express.json());

// Simple logger
app.use((req, _res, next) => {
  console.log(`📡 ${req.method} ${req.originalUrl}`);
  next();
});

// 3️⃣ Stripe normal routes (sessions, subscriptions, status)
app.use('/api/stripe', stripeRoutes);



// ---------- ROUTE MOUNTS ----------
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


// 🆕 Mount new dealership & application APIs
app.use('/api/dealers', dealersRoutes);
app.use('/api/applications', applicationRoutes);

// ---------- START SERVER ----------
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4, // IPv4 only
  })
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    console.log('🧱 Syncing indexes...');
    await Promise.all([
      AgentPayment.syncIndexes(),
      User.syncIndexes(),
      Verification.syncIndexes(),
    ]);
    console.log('🧱 Indexes synced');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
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
