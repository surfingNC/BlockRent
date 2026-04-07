// backend/routes/stripeWebhook.js
import express from 'express';
import Stripe from 'stripe';
import { Resend } from 'resend';

import Dealer from '../models/Dealer.js';
import AgentPayment from '../models/AgentPayment.js';
import { computeAccessFromPlan } from './stripe.js';

const router = express.Router();

/* --------------------------------------------------------
 * STRIPE CONFIG (LAZY + ESM-SAFE)
 * -------------------------------------------------------- */
function getStripeMode() {
  return process.env.STRIPE_MODE === 'test' ? 'test' : 'live';
}

function getStripeSecret(mode) {
  const key =
    mode === 'test'
      ? process.env.STRIPE_SECRET_KEY_TEST
      : process.env.STRIPE_SECRET_KEY_LIVE;

  if (!key) {
    throw new Error(
      `[stripeWebhook] Missing Stripe secret key for mode "${mode}". Set STRIPE_SECRET_KEY_${mode === 'test' ? 'TEST' : 'LIVE'} in env.`
    );
  }
  return key;
}

function getStripeWebhookSecret(mode) {
  const wh =
    mode === 'test'
      ? process.env.STRIPE_WEBHOOK_SECRET_TEST
      : process.env.STRIPE_WEBHOOK_SECRET_LIVE;

  if (!wh) {
    throw new Error(
      `[stripeWebhook] Missing Stripe webhook secret for mode "${mode}". Set STRIPE_WEBHOOK_SECRET_${mode === 'test' ? 'TEST' : 'LIVE'} in env.`
    );
  }
  return wh;
}

// Stripe client is created lazily so env vars don't have to exist at import-time (ESM-safe).
let stripeClient = null;
function getStripe() {
  if (stripeClient) return stripeClient;
  const mode = getStripeMode();
  const key = getStripeSecret(mode);
  stripeClient = new Stripe(key, { apiVersion: '2024-06-20' });
  return stripeClient;
}

function getEndpointSecret() {
  const mode = getStripeMode();
  return getStripeWebhookSecret(mode);
}

/* --------------------------------------------------------
 * RESEND EMAIL (Optional)
 * -------------------------------------------------------- */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

/* --------------------------------------------------------
 * Helpers
 * -------------------------------------------------------- */
function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normStr(v) {
  return String(v || '').trim().toLowerCase();
}

function eventDateFromEvent(event) {
  const t = Number(event?.created);
  if (!Number.isFinite(t)) return new Date();
  return new Date(t * 1000);
}

function mapDealerType(planType) {
  const t = normStr(planType);
  if (t === 'dealership_monthly' || t === 'dealership_annual') return t;
  if (t === 'monthly') return 'dealership_monthly';
  if (t === 'annual' || t === 'yearly') return 'dealership_annual';
  return null;
}

function isDealerActive({ status, currentPeriodEnd }) {
  const s = String(status || 'inactive');
  if (s !== 'active' && s !== 'trialing') return false;
  if (!currentPeriodEnd) return true;
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

async function safeSendReceiptEmail({ to, planType, validUntil }) {
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: 'BlockRent Purchase Confirmed',
      html: `<p>Your plan <strong>${planType}</strong> is active until <strong>${validUntil.toDateString()}</strong>.</p>`,
    });
  } catch (err) {
    console.warn('📧 Resend receipt failed (continuing):', err?.message || err);
  }
}

/* --------------------------------------------------------
 * WEBHOOK: POST /api/stripe/webhook
 * IMPORTANT: server.js must mount this route with:
 *   app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
 * so req.body is the RAW Buffer here.
 * -------------------------------------------------------- */
router.post('/', async (req, res) => {
  const stripe = getStripe();
  const endpointSecret = getEndpointSecret();

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Webhook Error: Missing Stripe-Signature header');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'Invalid signature'}`);
  }

  try {
    switch (event.type) {
      /* ---------------------------------
       * ONE-TIME PAYMENTS (REAL ESTATE)
       * --------------------------------- */
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Only handle one-time purchases here
        if (session?.mode !== 'payment') break;
        if (session?.payment_status !== 'paid') break;

        const email = normEmail(
          session?.metadata?.email ||
            session?.customer_details?.email ||
            session?.customer_email ||
            ''
        );

        const planType = normStr(session?.metadata?.planType || '');
        const category = normStr(session?.metadata?.category || '');

        if (category !== 'real_estate' || !email || !planType) break;

        // Idempotency: Stripe may retry webhooks
        const existing = await AgentPayment.findOne({
          $or: [{ checkoutSessionId: session.id }, { txId: session.id }],
        }).lean();
        if (existing) break;

        const { validUntil, listingCount } = computeAccessFromPlan(planType);

        await AgentPayment.create({
          email,
          type: planType,
          category: 'real_estate',
          validUntil,
          listingCount,
          confirmed: true,
          provider: 'stripe',
          mode: 'payment',
          // Store Stripe refs (session.id) in both txId + checkoutSessionId
          txId: session.id,
          checkoutSessionId: session.id,
          customerId: session.customer || null,
          amountPaid: typeof session.amount_total === 'number' ? session.amount_total : null,
          currency: session.currency ? String(session.currency).toLowerCase() : 'usd',
          latestEventAt: eventDateFromEvent(event),
        });

        // Optional: receipt email
        await safeSendReceiptEmail({ to: email, planType, validUntil });

        break;
      }

      /* ---------------------------------
       * SUBSCRIPTIONS (DEALERSHIP)
       * --------------------------------- */
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;

        const email = normEmail(subscription?.metadata?.email || '');
        const category = normStr(subscription?.metadata?.category || '');
        const planType = normStr(subscription?.metadata?.planType || '');

        // We only handle dealership subscriptions here.
        if (category !== 'dealership' || !email) break;

        const mappedType = mapDealerType(planType);

        const currentPeriodStart = subscription?.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : null;

        const currentPeriodEnd = subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;

        const subscriptionStatus = subscription?.status || null;

        await AgentPayment.findOneAndUpdate(
          { subscriptionId: subscription.id },
          {
            $set: {
              email,
              category: 'dealership',
              type: mappedType || 'dealership_monthly',
              provider: 'stripe',
              mode: 'subscription',
              subscriptionId: subscription.id,
              customerId: subscription.customer || null,
              invoiceId: subscription.latest_invoice || null,
              subscriptionStatus,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              latestEventAt: eventDateFromEvent(event),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // If the user already has a Dealer listing, keep it in sync.
        // Never auto-enable acceptingApplications; only force it OFF when inactive.
        const active = isDealerActive({ status: subscriptionStatus, currentPeriodEnd });
        const dealerUpdate = {
          subscriptionStatus: subscriptionStatus || 'expired',
          subscriptionValidUntil: currentPeriodEnd || new Date(),
        };
        if (!active) dealerUpdate.acceptingApplications = false;

        await Dealer.updateMany(
          { contactEmail: email },
          { $set: dealerUpdate }
        );

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        const email = normEmail(subscription?.metadata?.email || '');
        const category = normStr(subscription?.metadata?.category || '');

        if (category !== 'dealership' || !email) break;

        const now = new Date();

        await AgentPayment.findOneAndUpdate(
          { subscriptionId: subscription.id },
          {
            $set: {
              email,
              category: 'dealership',
              provider: 'stripe',
              mode: 'subscription',
              subscriptionId: subscription.id,
              customerId: subscription.customer || null,
              invoiceId: subscription.latest_invoice || null,
              subscriptionStatus: subscription?.status || 'canceled',
              currentPeriodStart: null,
              currentPeriodEnd: now,
              cancelAtPeriodEnd: false,
              latestEventAt: eventDateFromEvent(event),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await Dealer.updateMany(
          { contactEmail: email },
          {
            $set: {
              subscriptionStatus: subscription?.status || 'canceled',
              subscriptionValidUntil: now,
              acceptingApplications: false,
            },
          }
        );

        break;
      }

      // Optional: we do not rely on invoice.paid, but it can help attach invoice ids.
      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice?.subscription || null;
        if (!subscriptionId) break;

        await AgentPayment.updateMany(
          { subscriptionId },
          {
            $set: {
              invoiceId: invoice.id || null,
              latestEventAt: eventDateFromEvent(event),
            },
          }
        );

        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('❌ Stripe webhook handler error:', err);
    // Return 500 so Stripe retries; webhook processing is idempotent.
    return res.status(500).json({ received: false });
  }
});

export default router;
