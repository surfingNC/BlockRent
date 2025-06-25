// backend/models/Verification.js
import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  code: { type: String, required: true }, // This will be a hashed code
  expiresAt: { type: Date, required: true }
});

export default mongoose.model('Verification', verificationSchema);
