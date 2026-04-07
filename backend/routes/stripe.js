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

if (!STRIPE_SECRET_KEY) {
  throw new Error(
    `[stripe] Missing Stripe secret key for mode "${STRIPE_MODE}". Set STRIPE_SECRET_KEY_${STRIPE_MODE.toUpperCase()} in env.`
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

function getBaseUrl(req) {
  // Prefer explicit config; otherwise derive from the inbound request.
  // With app.set('trust proxy', 1) in server.js, req.protocol will be correct behind HTTPS proxies.
  const host = req?.get ? req.get('host') : '';
  const derived = host ? `${req.protocol}://${host}` : '';
  return process.env.PUBLIC_APP_URL || derived || 'http://localhost:3000';
}

/* ---------------------------------------------------------
 * RESEND EMAIL (optional)
 * --------------------------------------------------------- */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

/* ---------------------------------------------------------
 * REAL-ESTATE PLANS (Local, one-time payments)
 * --------------------------------------------------------- */
const PLANS = [
  {
    type: 'basic',
    label: 'Basic (1 Listing)',
    currency: 'usd',
    amountCents: 2500,
    validDays: 30,
    listingCount: 1,
  },
  {
    type: 'pro',
    label: 'Pro (10 Listings)',
    currency: 'usd',
    amountCents: 6900,
    validDays: 30,
    listingCount: 10,
  },
  {
    type: 'unlimited',
    label: 'Unlimited Listings',
    currency: 'usd',
    amountCents: 14900,
    validDays: 30,
    // UI/marketing value only. The persisted AgentPayment listingCount can be null for "unlimited".
    listingCount: 999999,
  },
];

/* ---------------------------------------------------------
 * DEALERSHIP SUBSCRIPTION PLANS (Stripe subscriptions)
 * --------------------------------------------------------- */
const DEALER_PLANS = [
  {
    type: 'monthly',
    label: 'Dealership Monthly',
    // These should be your Stripe Price IDs:
    priceId:
      STRIPE_MODE === 'test'
        ? process.env.STRIPE_PRICE_DEALER_MONTHLY_TEST
        : process.env.STRIPE_PRICE_DEALER_MONTHLY_LIVE,
  },
  {
    type: 'annual',
    label: 'Dealership Annual',
    priceId:
      STRIPE_MODE === 'test'
        ? process.env.STRIPE_PRICE_DEALER_ANNUAL_TEST
        : process.env.STRIPE_PRICE_DEALER_ANNUAL_LIVE,
  },
];

/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */
function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normPlan(v) {
  return String(v || '').trim().toLowerCase();
}

function computeAccessFromPlan(planType) {
  const now = Date.now();
  const t = normPlan(planType);

  // Real-estate listing access (one-time)
  if (t === 'basic') {
    return {
      validUntil: new Date(now + 30 * 24 * 60 * 60 * 1000),
      listingCount: 1,
    };
  }
  if (t === 'pro') {
    return {
      validUntil: new Date(now + 30 * 24 * 60 * 60 * 1000),
      listingCount: 10,
    };
  }
  if (t === 'unlimited') {
    return {
      validUntil: new Date(now + 30 * 24 * 60 * 60 * 1000),
      listingCount: null,
    };
  }

  // Dealership plan access (handled by webhook; keep safe defaults)
  if (t === 'monthly') {
    return {
      validUntil: new Date(now + 30 * 24 * 60 * 60 * 1000),
      listingCount: null,
    };
  }
  if (t === 'annual') {
    return {
      validUntil: new Date(now + 365 * 24 * 60 * 60 * 1000),
      listingCount: null,
    };
  }

  console.warn('[stripe] computeAccessFromPlan: unknown planType:', planType);
  return { validUntil: new Date(now), listingCount: 0 };
}

function isActiveRealEstatePurchase(ap) {
  if (!ap) return false;
  if (ap.category !== 'real_estate') return false;
  if (ap.confirmed !== true) return false;
  if (!ap.validUntil) return true;
  return new Date(ap.validUntil) > new Date();
}

/* ---------------------------------------------------------
 * GET /api/stripe/plans
 * --------------------------------------------------------- */
router.get('/plans', (_req, res) => {
  res.json({ plans: PLANS, dealerPlans: DEALER_PLANS, mode: STRIPE_MODE });
});

/* ---------------------------------------------------------
 * POST /api/stripe/create-checkout-session
 * One-time payment (real estate)
 * body: { email, planType }
 * --------------------------------------------------------- */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, planType } = req.body;

    const normalizedEmail = normEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

    const t = normPlan(planType);
    const plan = PLANS.find((p) => p.type === t);
    if (!plan) return res.status(400).json({ error: 'Invalid planType' });

    const base = getBaseUrl(req);

    const metadata = {
      email: normalizedEmail,
      planType: plan.type,
      category: 'real_estate',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: normalizedEmail,
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

      // Helpful for reconciliation: metadata on the payment record
      payment_intent_data: { metadata },
      // Keep session metadata too
      metadata,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('❌ Stripe create-checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/* ---------------------------------------------------------
 * POST /api/stripe/create-dealer-subscription
 * Subscription payment (dealership)
 * body: { email, planType }
 * --------------------------------------------------------- */
router.post('/create-dealer-subscription', async (req, res) => {
  try {
    const { email, planType } = req.body;

    const normalizedEmail = normEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

    const plan = DEALER_PLANS.find((p) => p.type === normPlan(planType));
    if (!plan || !plan.priceId) {
      return res.status(400).json({ error: 'Invalid dealership plan or missing priceId' });
    }

    const base = getBaseUrl(req);

    const metadata = {
      email: normalizedEmail,
      planType: plan.type, // monthly | annual
      category: 'dealership',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: normalizedEmail,
      line_items: [{ price: plan.priceId, quantity: 1 }],

      // CRITICAL: ensures subscription events include metadata
      subscription_data: { metadata },

      success_url: `${base}/dealer-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/subscribe`,

      // Keep session metadata too
      metadata,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('❌ Stripe create-dealer-subscription error:', err);
    return res.status(500).json({ error: 'Failed to create dealer subscription session' });
  }
});

/* ---------------------------------------------------------
 * GET /api/stripe/confirm?session_id=...
 * Confirms a ONE-TIME real-estate Checkout session and writes AgentPayment
 * NOTE: Webhook also writes this record; this endpoint must be idempotent.
 * --------------------------------------------------------- */
router.get('/confirm', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });

    // Idempotency: if already exists (webhook or prior confirm), return success
    const existing = await AgentPayment.findOne({
      $or: [{ checkoutSessionId: sessionId }, { txId: sessionId }],
    }).lean();
    if (existing) {
      const active = isActiveRealEstatePurchase(existing);
      return res.json({
        ok: true,
        alreadyProcessed: true,
        email: existing.email,
        active,
        status: active ? 'active' : 'inactive',
        type: existing.type,
        planType: existing.type,
        validUntil: existing.validUntil ?? null,
        listingCount: existing.listingCount ?? null,
      });
    }

    // Expand line_items so we can validate amount/currency.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent'],
    });

    // This endpoint is ONLY for one-time real-estate payments
    if (session.mode !== 'payment') {
      return res.status(400).json({ error: 'Invalid session mode for confirm endpoint' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    if (session.payment_intent && typeof session.payment_intent === 'object') {
      if (session.payment_intent.status !== 'succeeded') {
        return res.status(400).json({ error: 'Payment intent not succeeded' });
      }
    }

    const email = normEmail(
      session.metadata?.email ||
        session.customer_details?.email ||
        session.customer_email ||
        ''
    );

    const planType = normPlan(session.metadata?.planType || '');
    const category = normPlan(session.metadata?.category || '');

    if (!email || !planType) {
      return res.status(400).json({ error: 'Missing email or planType in session metadata' });
    }

    if (category !== 'real_estate') {
      return res.status(400).json({ error: 'Invalid category for confirm endpoint' });
    }

    const plan = PLANS.find((p) => p.type === planType);
    if (!plan) return res.status(400).json({ error: 'Unknown planType' });

    const paidCurrency = String(session.currency || '').toLowerCase();
    if (paidCurrency !== String(plan.currency).toLowerCase()) {
      return res.status(400).json({ error: 'Currency mismatch' });
    }

    const items = session.line_items?.data || [];
    const itemTotal = items.reduce((sum, li) => sum + Number(li.amount_total ?? 0), 0);

    if (itemTotal !== Number(plan.amountCents)) {
      return res.status(400).json({
        error: 'Item amount mismatch',
        expected: plan.amountCents,
        received: itemTotal,
      });
    }

    const { validUntil, listingCount } = computeAccessFromPlan(planType);

    const createdAt = eventDateFromStripeSession(session);

    const record = await AgentPayment.create({
      email,
      type: planType,
      category: 'real_estate',
      validUntil,
      listingCount,
      confirmed: true,
      provider: 'stripe',
      mode: 'payment',
      // We store Stripe refs like session.id in txId (see backend/routes/notifications.js)
      txId: sessionId,
      checkoutSessionId: sessionId,
      customerId: session.customer || null,
      amountPaid: typeof session.amount_total === 'number' ? session.amount_total : plan.amountCents,
      currency: paidCurrency || plan.currency,
      latestEventAt: createdAt,
    });

    // Optional: receipt email
    if (resend) {
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: 'BlockRent Subscription Confirmed',
          html: `<p>Your plan <strong>${planType}</strong> is now active until <strong>${validUntil.toDateString()}</strong>.</p>`,
        });

        await AgentPayment.updateOne(
          { _id: record._id },
          { $set: { confirmationEmailSentAt: new Date() } }
        );
      } catch (e) {
        console.warn('📧 Resend receipt failed (continuing):', e?.message || e);
      }
    }

    return res.json({
      ok: true,
      email,
      active: true,
      status: 'active',
      type: planType,
      planType,
      validUntil,
      listingCount,
    });
  } catch (err) {
    console.error('❌ Stripe confirm error:', err);
    return res.status(500).json({ error: 'Failed to confirm session' });
  }
});

function eventDateFromStripeSession(session) {
  // session.created is a unix seconds timestamp.
  const t = Number(session?.created);
  if (!Number.isFinite(t)) return new Date();
  return new Date(t * 1000);
}

/* ---------------------------------------------------------
 * GET /api/stripe/status?email=...
 * Real-estate plan status (AgentPayment)
 * Returns BOTH the new shape (status/type) and the legacy shape (active/planType)
 * so existing UI components keep working.
 * --------------------------------------------------------- */
router.get('/status', async (req, res) => {
  try {
    const email = normEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const now = new Date();

    const record = await AgentPayment.findOne({
      email,
      category: 'real_estate',
      confirmed: true,
      type: { $in: ['basic', 'pro', 'unlimited'] },
      $or: [{ validUntil: null }, { validUntil: { $gt: now } }],
    })
      .sort({ validUntil: -1, latestEventAt: -1, timestamp: -1 })
      .lean();

    if (!record) {
      return res.json({
        active: false,
        status: 'inactive',
      });
    }

    const active = isActiveRealEstatePurchase(record);

    return res.json({
      // Legacy fields (Subscribe.jsx)
      active,
      planType: record.type,
      // New/standard fields (Dashboard.jsx)
      status: active ? 'active' : 'inactive',
      type: record.type,
      validUntil: record.validUntil ?? null,
      listingCount: record.listingCount ?? null,
    });
  } catch (err) {
    console.error('❌ Stripe status error:', err);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/* ---------------------------------------------------------
 * GET /api/stripe/dealer-status?email=...
 * Dealership subscription status (AgentPayment)
 * --------------------------------------------------------- */
router.get('/dealer-status', async (req, res) => {
  try {
    const email = normEmail(req.query.email);
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const doc = await AgentPayment.findOne({
      email,
      category: 'dealership',
      subscriptionId: { $ne: null },
    })
      .sort({ latestEventAt: -1, timestamp: -1 })
      .lean();

    if (!doc) {
      return res.json({
        status: 'inactive',
        active: false,
      });
    }

    const now = Date.now();
    const periodEnd = doc.currentPeriodEnd ? new Date(doc.currentPeriodEnd).getTime() : null;

    // Default to Stripe's status if present
    let status = String(doc.subscriptionStatus || 'inactive');

    // If we have a period end and it is in the past, force an "expired" state for the UI.
    if (periodEnd && now > periodEnd && status !== 'canceled') {
      status = 'expired';
    }

    const active = (status === 'active' || status === 'trialing') && (!periodEnd || now <= periodEnd);

    return res.json({
      status,
      subscriptionStatus: doc.subscriptionStatus ?? null,
      type: doc.type ?? null,
      currentPeriodStart: doc.currentPeriodStart ?? null,
      currentPeriodEnd: doc.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(doc.cancelAtPeriodEnd),
      active,
    });
  } catch (err) {
    console.error('❌ Dealer status error:', err);
    return res.status(500).json({ error: 'Failed to fetch dealer status' });
  }
});

export { PLANS, computeAccessFromPlan };
export default router;
