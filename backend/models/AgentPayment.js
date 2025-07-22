// models/AgentPayment.js
import mongoose from 'mongoose';

const AgentPaymentSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  txId: { type: String, required: true, unique: true },
  amountSats: { type: Number, required: true },
  type: { type: String, enum: ['basic', 'pro', 'unlimited'], default: 'basic' },
  validUntil: { type: Date, required: true },
  listingCount: { type: Number }, // used for pro tier
  timestamp: { type: Date, default: Date.now },
});

const AgentPayment = mongoose.model('AgentPayment', AgentPaymentSchema);
export default AgentPayment;
