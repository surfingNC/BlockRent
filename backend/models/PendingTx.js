// backend/models/PendingTx.js
import mongoose from 'mongoose';

const PendingTxSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  txId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  amountSats: { type: Number, required: true },
  type: { type: String, enum: ['basic', 'pro', 'unlimited'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 172800 },
});

const PendingTx = mongoose.model('PendingTx', PendingTxSchema);
export default PendingTx;
