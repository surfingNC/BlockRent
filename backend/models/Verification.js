//backend/models/Verification.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  code: { type: String, required: true }, // This will be a hashed code
  expiresAt: { type: Date, required: true }
});

module.exports = mongoose.model('Verification', verificationSchema);
