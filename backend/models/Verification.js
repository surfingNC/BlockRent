import mongoose from 'mongoose';

const VerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, trim: true },

    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

VerificationSchema.pre('validate', function (next) {
  if (this.username) this.usernameLower = this.username.trim().toLowerCase();
  next();
});

VerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
VerificationSchema.index({ usernameLower: 1 }, { unique: true });

export default mongoose.model('Verification', VerificationSchema);
