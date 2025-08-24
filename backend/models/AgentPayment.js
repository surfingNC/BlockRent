// backend/models/AgentPayment.js
import mongoose from 'mongoose';

const AgentPaymentSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: false, default: null }, // optional for promo redemptions
    email: { type: String, required: true, index: true },

    // Guard duplicates at the DB level
    txId: { type: String, required: true, unique: true, index: true },

    amountSats: { type: Number, required: true },

    type: { type: String, enum: ['basic', 'pro', 'unlimited'], default: 'basic' },

    validUntil: { type: Date, required: true, index: true }, // used by cleanup job

    listingCount: { type: Number },

    confirmed: { type: Boolean, default: false, index: true },

    // Keep your explicit timestamp for backward compatibility (you could switch to {timestamps:true})
    timestamp: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  }
);

// Optional compound index for queries by email + recency
AgentPaymentSchema.index({ email: 1, confirmed: 1, validUntil: -1 });

const AgentPayment =
  mongoose.models.AgentPayment ||
  mongoose.model('AgentPayment', AgentPaymentSchema);

export default AgentPayment;
