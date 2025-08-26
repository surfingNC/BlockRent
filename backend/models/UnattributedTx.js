// backend/models/UnattributedTx.js
import mongoose from 'mongoose';

const UnattributedTxSchema = new mongoose.Schema(
  {
    txId: { type: String, unique: true, index: true },
    amountSats: { type: Number, required: true },
    seenAt: { type: Date, default: Date.now, index: true },
    confirmed: { type: Boolean, default: false, index: true },
    walletAddress: { type: String, default: null }, // inferred sender (optional)
    outputs: { type: [String], default: [] },      // destination addresses (debug)
    matchedSessionId: { type: String, default: null, index: true },
    candidateCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('UnattributedTx', UnattributedTxSchema);
