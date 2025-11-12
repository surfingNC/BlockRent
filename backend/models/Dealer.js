import mongoose from 'mongoose';

const DealerSchema = new mongoose.Schema(
  {
    dealershipName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },

    zipCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{5}(-\d{4})?$/, // ✅ validates U.S. ZIP or ZIP+4
    },

    contactEmail: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,  // ✅ always lowercase before saving
      trim: true
    },

    images: { type: [String], default: [] },

    subscriptionType: { 
      type: String, 
      enum: ['monthly', 'annual'], 
      default: 'monthly' 
    },

    subscriptionValidUntil: { type: Date },

    acceptingApplications: { type: Boolean, default: true },
  },
  {
    timestamps: true // ✅ adds createdAt and updatedAt automatically
  }
);

// ✅ Case-insensitive uniqueness for email
DealerSchema.index(
  { contactEmail: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// ✅ Index for faster ZIP-based searches
DealerSchema.index({ zipCode: 1 });

// ✅ Optional helper
DealerSchema.virtual('isSubscriptionActive').get(function () {
  return this.subscriptionValidUntil && new Date() < this.subscriptionValidUntil;
});

const Dealer = mongoose.models.Dealer || mongoose.model('Dealer', DealerSchema);
export default Dealer;
