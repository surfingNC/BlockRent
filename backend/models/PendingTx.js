// backend/models/PendingTx.js
import mongoose from 'mongoose';

const PendingTxSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  txId: { type: String, required: true, unique: true },
  email: { type: String },
  amountSats: { type: Number, required: true },
  type: { type: String, enum: ['basic', 'pro', 'unlimited'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const PendingTx = mongoose.model('PendingTx', PendingTxSchema);
export default PendingTx;
