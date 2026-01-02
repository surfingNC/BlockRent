import mongoose from 'mongoose';

const DealerSchema = new mongoose.Schema(
  {
    // 🧑 Owner of the dealership (logged-in user)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 📍 Dealership Info
    dealershipName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },

    zipCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{5}(-\d{4})?$/, // supports ZIP or ZIP+4
    },

    // 📧 Used to match Stripe customer + Dealer subscription
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    welcomeEmailSentAt: { type: Date, default: null },

    // 🖼 Photos stored
    images: { type: [String], default: [] },

    /* --------------------------------------------------------
     * 🔐 SUBSCRIPTION FIELDS (controlled by Stripe webhook)
     * -------------------------------------------------------- */

    // expiration from Stripe current_period_end
    subscriptionValidUntil: { type: Date, default: null },

    // mirrors Stripe subscription.status
    subscriptionStatus: {
      type: String,
      enum: [
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused',
        'expired',
      ],
      default: 'expired',
    },

    // Dealer can toggle this unless subscription expired
    acceptingApplications: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/* --------------------------------------------------------
 * INDEXES (updated)
 * -------------------------------------------------------- */

// 🔥 ENFORCE 1 DEALERSHIP PER SUBSCRIPTION EMAIL
DealerSchema.index({ contactEmail: 1 }, { unique: true });

// Helpful for search
DealerSchema.index({ zipCode: 1 });

/* --------------------------------------------------------
 * VIRTUAL — Check if subscription is currently active
 * -------------------------------------------------------- */
DealerSchema.virtual('isSubscriptionActive').get(function () {
  const now = new Date();

  return (
    this.subscriptionValidUntil &&
    now < this.subscriptionValidUntil &&
    this.subscriptionStatus === 'active'
  );
});

const Dealer =
  mongoose.models.Dealer || mongoose.model('Dealer', DealerSchema);

export default Dealer;
