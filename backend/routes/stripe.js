// backend/routes/stripe.js
import express from 'express';
import Stripe from 'stripe';
import AgentPayment from '../models/AgentPayment.js';
import { Resend } from 'resend';

const router = express.Router();

/* ---------------------------------------------------------
 * STRIPE CONFIG
 * --------------------------------------------------------- */
const STRIPE_MODE = process.env.STRIPE_MODE === 'test' ? 'test' : 'live';

const STRIPE_SECRET_KEY =
  STRIPE_MODE === 'test'
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

/* ---------------------------------------------------------
 * RESEND EMAIL
 * --------------------------------------------------------- */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

/* ---------------------------------------------------------
 * REAL ESTATE PLANS
 * --------------------------------------------------------- */
const PLANS = [
  {
    type: 'basic',
    label: 'Basic',
    amountCents: 100,
    currency: 'usd',
    listingCount: 1,
    durationDays: null,
    mode: 'payment',
  },
  {
    type: 'pro',
    label: 'Pro',
    amountCents: 1500,
    currency: 'usd',
    listingCount: 5,
    durationDays: null,
    mode: 'payment',
  },
  {
    type: 'unlimited',
    label: 'Unlimited',
    amountCents: 2500,
    currency: 'usd',
    listingCount: Infinity,
    durationDays: 30,
    mode: 'payment',
  },
];

/* ---------------------------------------------------------
 * DEALERSHIP PRICES
 * --------------------------------------------------------- */
const DEALER_PRICES = {
  dealership_monthly:
    STRIPE_MODE === 'test'
      ? process.env.STRIPE_DEALER_MONTHLY_TEST
      : process.env.STRIPE_DEALER_MONTHLY_LIVE,

  dealership_annual:
    STRIPE_MODE === 'test'
      ? process.env.STRIPE_DEALER_ANNUAL_TEST
      : process.env.STRIPE_DEALER_ANNUAL_LIVE,
};

console.log('🔐 Stripe Mode:', STRIPE_MODE);
console.log('💰 Dealer Price IDs:', DEALER_PRICES);

/* ---------------------------------------------------------
 * FORMAT ACCESS (Real Estate + Dealership)
 * --------------------------------------------------------- */
function computeAccessFromPlan(planType) {
  // 1. Real estate plans
  const plan = PLANS.find((p) => p.type === planType);
  if (plan) {
    return {
      validUntil:
        plan.durationDays != null
          ? new Date(Date.now() + plan.durationDays * 86400000)
          : null,
      listingCount: plan.listingCount === Infinity ? null : plan.listingCount,
      category: 'real_estate',
    };
  }

  // 2. Dealership monthly
  if (planType === 'dealership_monthly') {
    return {
      category: 'dealership',
      subscriptionInterval: 'monthly',
    };
  }

  // 3. Dealership annual
  if (planType === 'dealership_annual') {
    return {
      category: 'dealership',
      subscriptionInterval: 'annual',
    };
  }

  // 4. Unknown plans
  console.warn('[stripe] computeAccessFromPlan: unknown planType:', planType);
  return {
    validUntil: null,
    listingCount: null,
    category: null,
  };
}

/* ---------------------------------------------------------
 * PUBLIC: GET PLANS
 * --------------------------------------------------------- */
router.get('/plans', (req, res) => {
  res.json(
    PLANS.map((p) => ({
      type: p.type,
      label: p.label,
      amountCents: p.amountCents,
      currency: p.currency,
      durationDays: p.durationDays,
      listingCount: p.listingCount === Infinity ? 'Unlimited' : p.listingCount,
    }))
  );
});

/* ---------------------------------------------------------
 * REAL ESTATE — CREATE CHECKOUT SESSION
 * --------------------------------------------------------- */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, planType } = req.body;
    const plan = PLANS.find((p) => p.type === planType);

    if (!plan) return res.status(400).json({ error: 'Invalid planType' });

    const base = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    const normalizedEmail = (email || '').toLowerCase().trim();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      allow_promotion_codes: true,
      customer_email: normalizedEmail || undefined,

      line_items: [
        {
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amountCents,
            product_data: { name: plan.label },
          },
          quantity: 1,
        },
      ],

      success_url: `${base}/login?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/subscribe`,

      metadata: {
        email: normalizedEmail,
        planType: plan.type,
        category: 'real_estate',
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ error creating real-estate checkout:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/* ---------------------------------------------------------
 * DEALERSHIP — CREATE SUBSCRIPTION SESSION
 * --------------------------------------------------------- */
router.post('/create-dealer-subscription', async (req, res) => {
  try {
    let { email, planType } = req.body;

    if (!email) return res.status(400).json({ error: 'email required' });

    // Normalize
    email = email.trim().toLowerCase();

    const lower = planType?.toLowerCase(); // 'dealership_monthly' or 'dealership_annual'
    const priceId = DEALER_PRICES[lower];

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid dealership planType' });
    }

    // Always search Stripe with normalized lowercase email
    const existing = await stripe.customers.list({ email, limit: 1 });

    const customer =
      existing.data[0] ||
      (await stripe.customers.create({
        email,
        metadata: { created_from: 'blockrent' },
      }));

    const base = process.env.PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      allow_promotion_codes: true,

      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${base}/dashboard?dealer_success=1`,
      cancel_url: `${base}/subscribe?for=dealership`,

      // This metadata lives ONLY on the checkout session
      metadata: {
        email,
        planType: lower,
        category: 'dealership',
      },

      // This metadata is copied to the created Subscription
      subscription_data: {
        metadata: {
          email,
          planType: lower,
          category: 'dealership',
        },
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ dealer subscription error:', err);
    return res.status(500).json({ error: 'Failed to create subscription session' });
  }
});

/* ---------------------------------------------------------
 * FALLBACK (NON-WEBHOOK) REAL ESTATE CONFIRMATION (SAFE)
 * --------------------------------------------------------- */
router.get('/confirm', async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: 'session_id required' });
    }

    const sess = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("🔍 /confirm called for session:", {
      id: sess.id,
      mode: sess.mode,
      category: sess.metadata?.category,
      planType: sess.metadata?.planType
    });

    /* -----------------------------------------------------
     * 🚫 BLOCK ALL NON–REAL-ESTATE SESSIONS
     * ----------------------------------------------------- */

    // 1️⃣ Subscriptions should NEVER hit /confirm
    if (sess.mode === 'subscription') {
      console.warn(`🚫 /confirm called for SUBSCRIPTION session ${sess.id}. Blocking.`);
      return res.status(400).json({ error: 'invalid_confirm_context' });
    }

    // 2️⃣ Dealership payments should NEVER hit /confirm
    if (sess.metadata?.category !== 'real_estate') {
      console.warn(
        `🚫 /confirm called for NON-REAL-ESTATE session ${sess.id} (category=${sess.metadata?.category}). Blocking.`
      );
      return res.status(400).json({ error: 'invalid_confirm_category' });
    }

    // 3️⃣ Only proceed for REAL ESTATE one-time payments
    if (sess.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'not_paid',
        payment_status: sess.payment_status,
      });
    }

    /* -----------------------------------------------------
     * ACTUAL REAL ESTATE LOGIC (SAFE NOW)
     * ----------------------------------------------------- */

    const planType = (sess.metadata.planType || '').toLowerCase();
    const { validUntil, listingCount } = computeAccessFromPlan(planType);

    const email =
      (sess.customer_details?.email ||
        sess.metadata?.email ||
        'unknown@blockrent.app')
        .toLowerCase()
        .trim();

    const doc = await AgentPayment.findOneAndUpdate(
      { txId: sess.id },
      {
        email,
        txId: sess.id,
        amountPaid: sess.amount_total ?? 0,
        currency: sess.currency,
        type: planType,
        validUntil,
        listingCount,
        confirmed: true,
        provider: 'stripe',
        mode: 'payment',
        category: 'real_estate',
        checkoutSessionId: sess.id,
        customerId: sess.customer || null,
        latestEventAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log("✅ /confirm completed:", {
      email: doc.email,
      type: doc.type,
      category: doc.category,
      validUntil: doc.validUntil
    });

    return res.json({
      ok: true,
      type: doc.type,
      validUntil: doc.validUntil ?? null,
    });

  } catch (e) {
    console.error('[stripe] /confirm error:', e);
    return res.status(500).json({ error: 'confirm_failed' });
  }
});


/* ---------------------------------------------------------
 * REAL ESTATE STATUS — Only category: real_estate
 * --------------------------------------------------------- */
router.get('/status', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });

    // Query only real estate payments
    const docs = await AgentPayment.find({
      email,
      confirmed: true,
      category: 'real_estate',
    })
      .sort({ latestEventAt: -1 })
      .lean();

    if (!docs.length) return res.json({ status: 'inactive' });

    const now = new Date();

    // Pick one that is currently valid, otherwise latest
    const best =
      docs.find((d) => !d.validUntil || d.validUntil > now) || docs[0];

    const active = best.validUntil ? best.validUntil > now : true;

    return res.json({
      status: active ? 'active' : 'inactive',
      type: best.type || null,
      mode: best.mode || null,
      validUntil: best.validUntil || null,
      listingCount: best.listingCount ?? null,
    });
  } catch (err) {
    console.error('❌ real-estate-status error:', err);
    res.status(500).json({ error: 'status_failed' });
  }
});

/* ---------------------------------------------------------
 * DEALERSHIP STATUS — Uses AgentPayment only
 * --------------------------------------------------------- */
router.get('/dealer-status', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });

    // Find latest AgentPayment entry for dealership category
    const doc = await AgentPayment.findOne({
      email,
      category: 'dealership',
      mode: 'subscription',            // <– required
      subscriptionId: { $ne: null },   // <– required
    })
      .sort({ latestEventAt: -1 })
      .lean();


    if (!doc) {
      return res.json({ status: 'inactive' });
    }

    const now = new Date();
    const active =
      doc.subscriptionStatus === 'active' &&
      (!doc.currentPeriodEnd || new Date(doc.currentPeriodEnd) > now);

    return res.json({
      status: active ? 'active' : doc.subscriptionStatus || 'inactive',
      subscriptionStatus: doc.subscriptionStatus || 'inactive',
      currentPeriodEnd: doc.currentPeriodEnd || null,
      currentPeriodStart: doc.currentPeriodStart || null,
      planType: doc.type || null,
      mode: doc.mode || null,
    });
  } catch (err) {
    console.error('❌ dealer-status error:', err);
    res.status(500).json({ error: 'dealer_status_failed' });
  }
});

/* ---------------------------------------------------------
 * EXPORTS (Webhook Needs These)
 * --------------------------------------------------------- */
export { PLANS, computeAccessFromPlan };

export default router;
