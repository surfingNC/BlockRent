// backend/models/AgentPayment.js
import mongoose from 'mongoose';

const AgentPaymentSchema = new mongoose.Schema(
  {
    email:       { type: String, required: true, index: true },

    // Unique identifier for the transaction / subscription event
    txId:        { type: String, required: true, unique: true, index: true },

    // Store Stripe amounts in minor units (e.g. cents for USD)
    amountPaid:  { type: Number, required: true },

    currency:    { type: String, default: 'usd' },

    type:        { type: String, enum: ['basic', 'pro', 'unlimited'], required: true },

    // Lifetime = null, otherwise subscription period end
    validUntil:  { type: Date, default: null },

    // null = Unlimited listings
    listingCount:{ type: Number, default: null },

    confirmed:   { type: Boolean, default: false, index: true },

    // Guard to prevent duplicate confirmation emails
    confirmationEmailSentAt: { type: Date, default: null },

    timestamp:   { type: Date, default: Date.now },

    // Stripe metadata
    provider:    { type: String, default: 'stripe', index: true },
    mode:        { type: String, enum: ['payment', 'subscription'], default: 'payment', index: true },

    priceId:           { type: String, default: null, index: true },   // e.g. price_xxx
    productId:         { type: String, default: null, index: true },   // e.g. prod_xxx
    checkoutSessionId: { type: String, default: null, index: true },   // cs_xxx
    invoiceId:         { type: String, default: null, index: true },   // in_xxx
    customerId:        { type: String, default: null, index: true },   // cus_xxx
    subscriptionId:    { type: String, default: null, index: true },   // sub_xxx

    subscriptionStatus: { type: String, default: null, index: true }, // active, trialing, canceled, etc.
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd:   { type: Date, default: null },
    cancelAtPeriodEnd:  { type: Boolean, default: null },

    latestEventAt: { type: Date, default: null },
  },
  { versionKey: false }
);

// Helpful compound index
AgentPaymentSchema.index(
  { email: 1, confirmed: 1, validUntil: -1 },
  { name: 'byUserConfirmedValidUntil' }
);

// Normalize email before save
AgentPaymentSchema.pre('save', function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  next();
});

export default mongoose.models.AgentPayment
  || mongoose.model('AgentPayment', AgentPaymentSchema);
