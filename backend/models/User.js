// backend/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  btcWallet: String,
  walletBalance: { type: Number, default: 0 },
  walletVerified: { type: Boolean, default: false },
});

export default mongoose.model('User', UserSchema);
