import mongoose from 'mongoose';

const CarApplicationSchema = new mongoose.Schema({
  dealershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  applicantEmail: { type: String, required: true },
  btcAddress: { type: String },
  btcHoldings: { type: Number }, // in BTC or sats
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('CarApplication', CarApplicationSchema);
