// backend/models/PaymentSession.js
import mongoose from 'mongoose';

const PaymentSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    planType: { type: String, required: true, enum: ['basic', 'pro', 'unlimited'] },
    walletAddress: { type: String, default: null }, // optional, helps hydration
    createdAt: { type: Date, default: Date.now, expires: 3600 }, // TTL: 1 hour
  },
  { versionKey: false }
);

// Reuse model if hot-reloading
const PaymentSession =
  mongoose.models.PaymentSession || mongoose.model('PaymentSession', PaymentSessionSchema);

export default PaymentSession;
