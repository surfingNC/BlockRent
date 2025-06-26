// backend/models/Verification.js
import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

export default mongoose.model('Verification', verificationSchema);
