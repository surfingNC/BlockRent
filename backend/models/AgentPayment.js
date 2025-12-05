// backend/models/AgentPayment.js
import mongoose from 'mongoose';

const AgentPaymentSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },

    // For real-estate one-time Stripe Checkout sessions (session.id)
    txId: { type: String, default: null, index: true },

    // For dealership subscriptions (sub_xxx)
    subscriptionId: { type: String, default: null, index: true },

    // Amount for the transaction (cents). May be null for some subscription events.
    amountPaid: { type: Number, default: null },

    currency: { type: String, default: 'usd' },

    // Plan type (MUST match what we write everywhere else)
    // Real estate: basic, pro, unlimited
    // Dealership: dealership_monthly, dealership_annual
    type: {
      type: String,
      enum: [
        'basic',
        'pro',
        'unlimited',
        'dealership_monthly',
        'dealership_annual',
      ],
      required: true,
    },

    // Distinguish product lines
    category: {
      type: String,
      enum: ['real_estate', 'dealership'],
      default: 'real_estate',
      index: true,
    },

    // Real-estate access window (null = lifetime)
    validUntil: { type: Date, default: null },

    // Real-estate listing count (null = unlimited)
    listingCount: { type: Number, default: null },

    // For real-estate payments
    confirmed: { type: Boolean, default: false, index: true },
    confirmationEmailSentAt: { type: Date, default: null },

    timestamp: { type: Date, default: Date.now },

    provider: { type: String, default: 'stripe', index: true },
    mode: {
      type: String,
      enum: ['payment', 'subscription'],
      default: 'payment',
      index: true,
    },

    priceId: { type: String, default: null, index: true },
    productId: { type: String, default: null, index: true },
    checkoutSessionId: { type: String, default: null, index: true },
    invoiceId: { type: String, default: null, index: true },
    customerId: { type: String, default: null, index: true },

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
    null
  ],
  default: null,
  index: true,
},

    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: null },

    latestEventAt: { type: Date, default: null },
  },
  { versionKey: false }
);

// Index for subscription lookups
AgentPaymentSchema.index(
  { email: 1, mode: 1, latestEventAt: -1 },
  { name: 'byUserSubscriptionMode' }
);

// Normalize email
AgentPaymentSchema.pre('save', function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  next();
});

export default mongoose.models.AgentPayment ||
  mongoose.model('AgentPayment', AgentPaymentSchema);
