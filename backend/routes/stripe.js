// backend/routes/stripe.js
import express from 'express';
import Stripe from 'stripe';
import AgentPayment from '../models/AgentPayment.js';
import { Resend } from 'resend';

const router = express.Router();

// Parse JSON for non-webhook routes (server mounts this router once under /api/stripe)
router.use(['/create-checkout-session'], express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
});

// Optional email sender (Resend)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

/**
 * Simple plan catalog (amounts in cents)
 * - durationDays: null = lifetime
 * - listingCount: Infinity shown as "Unlimited" to clients (we store null)
 */
const PLANS = [
  { type: 'basic',     label: 'Basic',     amountCents: 100, currency: 'usd', listingCount: 1,        durationDays: null, mode: 'payment' },
  { type: 'pro',       label: 'Pro',       amountCents: 1500, currency: 'usd', listingCount: 5,        durationDays: null, mode: 'payment' },
  { type: 'unlimited', label: 'Unlimited', amountCents: 2500, currency: 'usd', listingCount: Infinity, durationDays: 30,   mode: 'payment' },
];

// ---------- GET /api/stripe/plans ----------
router.get('/plans', (_req, res) => {
  const formatted = PLANS.map((p) => ({
    type: p.type,
    label: p.label,
    amountCents: p.amountCents,
    currency: p.currency,
    durationDays: p.durationDays,
    listingCount: p.listingCount === Infinity ? 'Unlimited' : p.listingCount,
  }));
  res.json(formatted);
});

// ---------- POST /api/stripe/create-checkout-session ----------
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, planType } = req.body || {};
    const plan = PLANS.find((p) => p.type === planType);
    if (!plan) return res.status(400).json({ error: 'Invalid planType' });

    // Include session_id in success URL so we can confirm without webhook
    const base = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${base}/login?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/subscribe`;

    const session = await stripe.checkout.sessions.create({
      mode: plan.mode, // 'payment'
      customer_email: email || undefined,
      allow_promotion_codes: true,
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
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planType: plan.type,
        email: (email || '').toLowerCase(),
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/** ---------------- Helpers ---------------- */

function computeAccessFromPlan(plan) {
  const validUntil =
    plan.durationDays != null ? new Date(Date.now() + plan.durationDays * 86400000) : null;
  const listingCount = plan.listingCount === Infinity ? null : plan.listingCount;
  return { validUntil, listingCount };
}

async function upsertFromSession(session, plans) {
  const planType = (session.metadata?.planType || 'basic').toLowerCase();
  const email = (session.customer_details?.email || session.metadata?.email || '').toLowerCase();
  const plan = plans.find((p) => p.type === planType) || plans[0];
  const amountCents = typeof session.amount_total === 'number' ? session.amount_total : plan.amountCents;
  const { validUntil, listingCount } = computeAccessFromPlan(plan);

  return await AgentPayment.findOneAndUpdate(
    { txId: session.id },
    {
      email,
      txId: session.id,
      amountPaid: amountCents,
      currency: plan.currency,
      type: plan.type,
      validUntil,
      listingCount,
      confirmed: true,
      provider: 'stripe',
      mode: 'payment',
      checkoutSessionId: session.id,
      customerId: session.customer || null,
      latestEventAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function sendConfirmationOnce(doc) {
  if (!resend) {
    console.warn('[stripe] Resend not configured (RESEND_API_KEY missing). Skipping email.');
    return;
  }
  if (!doc?.email) {
    console.warn('[stripe] No recipient email on AgentPayment doc. Skipping email.');
    return;
  }

  // Only skip if we already sent very recently (avoid dupes from webhook + confirm)
  if (doc.confirmationEmailSentAt) {
    const ageMs = Date.now() - new Date(doc.confirmationEmailSentAt).getTime();
    if (ageMs < 10 * 60 * 1000) {
      console.log(`[stripe] Email already sent recently (${Math.round(ageMs/1000)}s ago) to ${doc.email}, skipping.`);
      return;
    }
  }

  const subject = '✅ Your BlockRent subscription is active';
  const amountLine = `$${(doc.amountPaid / 100).toFixed(2)} ${(doc.currency || 'usd').toUpperCase()}`;
  const expiryLine = doc.validUntil
    ? `Valid until: ${new Date(doc.validUntil).toLocaleString()}`
    : 'Access: Lifetime';

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height:1.6">
      <h2>Thanks for your purchase!</h2>
      <p>Your <b>${doc.type}</b> plan is now active.</p>
      <p>Amount: ${amountLine}</p>
      <p>${expiryLine}</p>
    </div>
  `;
  const text = [
    'Thanks for your purchase!',
    `Your ${doc.type} plan is now active.`,
    `Amount: ${amountLine}`,
    expiryLine
  ].join('\n');

  const primaryFrom = EMAIL_FROM; // stays "support@blockrent.app" per your preference

  console.log('[stripe] 📧 Sending confirmation', {
    to: doc.email, from: primaryFrom, subject, amount: doc.amountPaid, validUntil: doc.validUntil
  });

  try {
    const resp = await resend.emails.send({
      from: primaryFrom,
      to: doc.email,
      subject,
      html,
      text,
      reply_to: primaryFrom,
    });
    console.log('[stripe] 📧 Resend primary response:', resp);
    await AgentPayment.updateOne(
      { _id: doc._id },
      { $set: { confirmationEmailSentAt: new Date() } }
    );
    console.log('[stripe] ✅ confirmationEmailSentAt set');
  } catch (err) {
    console.error('[stripe] 📧 Primary send failed:', err?.message || err);

    // Optional fallback for debugging ONLY (keeps your From unchanged unless it fails)
    try {
      const fallbackFrom = 'onboarding@resend.dev';
      console.log('[stripe] 📧 Retrying with fallback From:', fallbackFrom);
      const resp2 = await resend.emails.send({
        from: fallbackFrom,
        to: doc.email,
        subject,
        html,
        text,
        reply_to: primaryFrom,
      });
      console.log('[stripe] 📧 Resend fallback response:', resp2);
      await AgentPayment.updateOne(
        { _id: doc._id },
        { $set: { confirmationEmailSentAt: new Date() } }
      );
      console.log('[stripe] ✅ confirmationEmailSentAt set (fallback sender)');
    } catch (err2) {
      console.error('[stripe] 📧 Fallback send failed:', err2?.message || err2);
    }
  }
}


/** ---------------- Non-webhook confirmation fallback ----------------
 * GET /api/stripe/confirm?session_id=cs_...
 * Useful for local dev or if webhook delivery is delayed.
 */
router.get('/confirm', async (req, res) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ error: 'session_id required' });

    console.log('[stripe] /confirm hit with session_id:', sessionId);
    const sess = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('[stripe] /confirm session payment_status:', sess.payment_status, 'email:', sess.customer_details?.email || sess.metadata?.email);

    if (sess.payment_status !== 'paid') {
      return res.status(400).json({ error: 'not_paid', payment_status: sess.payment_status });
    }

    const doc = await upsertFromSession(sess, PLANS);
    await sendConfirmationOnce(doc);

    return res.json({ ok: true, type: doc.type, validUntil: doc.validUntil ?? null });
  } catch (e) {
    console.error('confirm error:', e);
    return res.status(500).json({ error: 'confirm_failed' });
  }
});

/** ---------------- Webhook (raw body!) ----------------
 * Mount this router under /api/stripe and keep this route as '/webhook'.
 * In your server, mount this router ONCE at /api/stripe (do not mount again at /api/stripe/webhook).
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whsec) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET missing');
    return res.status(400).send('Webhook secret missing');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whsec);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log('[stripe] webhook event:', event.type);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const sess = event.data.object;
      console.log('[stripe] webhook session_id:', sess.id, 'payment_status:', sess.payment_status, 'email:', sess.customer_details?.email || sess.metadata?.email);

      // Pull plan/email from metadata
      const planType = (sess.metadata?.planType || 'basic').toLowerCase();
      const email = (sess.customer_details?.email || sess.metadata?.email || '').toLowerCase();
      const plan = PLANS.find((p) => p.type === planType) || PLANS[0];

      // Amount in cents (fallback to our catalog)
      const amountCents = typeof sess.amount_total === 'number' ? sess.amount_total : plan.amountCents;
      const { validUntil, listingCount } = computeAccessFromPlan(plan);

      // Upsert AgentPayment (use session.id as txId)
      const doc = await AgentPayment.findOneAndUpdate(
        { txId: sess.id },
        {
          email,
          txId: sess.id,
          amountPaid: amountCents,
          currency: plan.currency,
          type: plan.type,
          validUntil,
          listingCount,
          confirmed: true,
          provider: 'stripe',
          mode: 'payment',
          checkoutSessionId: sess.id,
          customerId: sess.customer || null,
          invoiceId: null,
          subscriptionId: null,
          subscriptionStatus: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: null,
          latestEventAt: new Date(),
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );

      await sendConfirmationOnce(doc);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return res.status(500).send('Webhook handler error');
  }
});

// ---------- GET /api/stripe/status?email=... ----------
router.get('/status', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const now = new Date();
  const docs = await AgentPayment.find({ email, confirmed: true })
    .sort({ latestEventAt: -1, validUntil: -1 })
    .lean();

  if (!docs.length) return res.json({ status: 'inactive' });

  const best = docs.find((d) => (d.validUntil ? d.validUntil > now : true)) || docs[0];
  const active = best.validUntil ? best.validUntil > now : true;

  return res.json({
    status: active ? 'active' : 'inactive',
    type: best.type,
    mode: best.mode,
    validUntil: best.validUntil ?? null,
    listingCount: best.listingCount ?? null,
  });
});

/* ---------------- DEV-ONLY DEBUG ENDPOINTS ---------------- */
if (process.env.NODE_ENV !== 'production') {
  // 1) See the most recent AgentPayment for an email
  router.get('/debug/last', async (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    const doc = await AgentPayment.findOne({ email }).sort({ latestEventAt: -1, timestamp: -1 }).lean();
    res.json({ doc });
  });

  // 2) Force-resend the confirmation email for the latest doc
  router.post('/debug/resend', express.json(), async (req, res) => {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    const doc = await AgentPayment.findOne({ email }).sort({ latestEventAt: -1, timestamp: -1 });
    if (!doc) return res.status(404).json({ error: 'no AgentPayment found' });
    await sendConfirmationOnce(doc);
    res.json({ ok: true });
  });
}

export default router;
