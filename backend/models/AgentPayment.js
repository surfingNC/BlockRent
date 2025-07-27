import mongoose from 'mongoose';

const AgentPaymentSchema = new mongoose.Schema({
  walletAddress: { type: String, required: false }, // optional for promo redemptions
  email: { type: String, required: true },           // make sure email is included too
  txId: { type: String, required: true, unique: true },
  amountSats: { type: Number, required: true },
  type: { type: String, enum: ['basic', 'pro', 'unlimited'], default: 'basic' },
  validUntil: { type: Date, required: true },
  listingCount: { type: Number },
  timestamp: { type: Date, default: Date.now },
  confirmed: { type: Boolean, default: false },
  pendingCheck: { type: Boolean, default: false },
});

// ✅ Only register the model if it hasn't been registered already
const AgentPayment = mongoose.models.AgentPayment || mongoose.model('AgentPayment', AgentPaymentSchema);

export default AgentPayment;
