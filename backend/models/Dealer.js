import mongoose from 'mongoose';

const DealerSchema = new mongoose.Schema({
  dealershipName: { type: String, required: true },
  address: { type: String, required: true },
  contactEmail: { type: String, required: true, unique: true },
  images: [String],
  subscriptionType: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  subscriptionValidUntil: { type: Date },
  acceptingApplications: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Dealer', DealerSchema);
