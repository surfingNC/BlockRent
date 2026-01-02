// backend/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, trim: true }, // derived

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Store a HASH here (bcrypt/argon2), not plaintext
    password: { type: String, required: true, select: false },

    isVerified: { type: Boolean, default: false },

    btcWallet: { type: String, default: '' },
    walletBalance: { type: Number, default: 0 },
    walletVerified: { type: Boolean, default: false },

    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

// Ensure usernameLower is set consistently
UserSchema.pre('validate', function (next) {
  if (this.username) this.usernameLower = this.username.trim().toLowerCase();
  next();
});

// Unique indexes (source of truth)
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ usernameLower: 1 }, { unique: true });

export default mongoose.model('User', UserSchema);
