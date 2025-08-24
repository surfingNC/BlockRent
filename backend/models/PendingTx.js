// backend/models/PendingTx.js
import mongoose from 'mongoose';

const PendingTxSchema = new mongoose.Schema(
  {
    // Optional at insert time; we often hydrate later
    walletAddress: { type: String, required: false, default: null },

    // Unique per pending record to prevent duplicates
    txId: { type: String, required: true, index: true, unique: true },

    // Allow placeholder so we don't block pending creation
    email: { type: String, required: false, default: 'unknown@blockrent.app', index: true },

    amountSats: { type: Number, required: true },

    type: { type: String, enum: ['basic', 'pro', 'unlimited'], required: true },

    sessionId: { type: String, index: true, default: null },


    // TTL: auto-delete after 48h (172800 seconds)
    createdAt: { type: Date, default: Date.now, expires: 172800 },
  },
  {
    versionKey: false,
  }
);

// Helpful compound index for your hydration/update patterns
PendingTxSchema.index({ email: 1, createdAt: -1 });

const PendingTx =
  mongoose.models.PendingTx || mongoose.model('PendingTx', PendingTxSchema);

export default PendingTx;
