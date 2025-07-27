// backend/cron/cleanupExpiredPayments.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AgentPayment from '../models/AgentPayment.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

async function cleanupExpiredPayments() {
  await mongoose.connect(MONGO_URI);
  console.log('🧹 Running expired payment cleanup...');

  const now = new Date();
  const result = await AgentPayment.updateMany(
    { validUntil: { $lt: now }, confirmed: true },
    { $set: { confirmed: false, expired: true } }
  );

  console.log(`✅ Cleanup done. Marked ${result.modifiedCount} payments as expired.`);

  await mongoose.disconnect();
}

// Run once when called
cleanupExpiredPayments();
