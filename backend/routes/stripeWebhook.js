// backend/routes/stripeWebhook.js
import express from 'express';
import Stripe from 'stripe';
import Dealer from '../models/Dealer.js';
import AgentPayment from '../models/AgentPayment.js';
import { Resend } from 'resend';
import { computeAccessFromPlan } from './stripe.js';

const router = express.Router();

/* --------------------------------------------------------
 * STRIPE CONFIG
 * -------------------------------------------------------- */
const STRIPE_MODE = process.env.STRIPE_MODE === 'test' ? 'test' : 'live';

const STRIPE_SECRET =
  STRIPE_MODE === 'test'
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

const STRIPE_WEBHOOK_SECRET =
  STRIPE_MODE === 'test'
    ? process.env.STRIPE_WEBHOOK_SECRET_TEST
    : process.env.STRIPE_WEBHOOK_SECRET_LIVE;

const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2024-06-20' });

/* --------------------------------------------------------
 * DEALERSHIP PRICE IDS
 * -------------------------------------------------------- */
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

/* --------------------------------------------------------
 * REAL-ESTATE EMAIL SENDER
 * -------------------------------------------------------- */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM =
  process.env.EMAIL_FROM || 'BlockRent <noreply@blockrent.app>';

/* --------------------------------------------------------
 * HELPERS
 * -------------------------------------------------------- */

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/** Ensure dealer detection is metadata-first (strongest) */
function isDealershipSubscription(subscription) {
  if (!subscription) return false;

  // 1️⃣ Strongest: explicit category
  if (subscription.metadata?.category === 'dealership') return true;
  if (subscription.metadata?.category === 'real_estate') return false;

  // 2️⃣ Fallback: price ID match
  const priceIds = Object.values(DEALER_PRICES).filter(Boolean);

  return subscription.items?.data?.some((item) =>
    priceIds.includes(item.price?.id)
  );
}

function isRealEstateCheckoutSession(session) {
  if (!session) return false;
  return session.metadata?.category === 'real_estate';
}

/* --------------------------------------------------------
 * REAL-ESTATE CONFIRMATION EMAIL
 * -------------------------------------------------------- */
async function sendConfirmationEmail(doc) {
  if (!resend || !doc?.email) return;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: doc.email,
      subject: 'Your BlockRent subscription is active',
      html: `
        <div style="font-family: sans-serif; padding: 16px;">
          <h2>Your BlockRent subscription is active</h2>
          <p>Plan: <b>${doc.type}</b></p>
          <p>Amount Paid: $${(doc.amountPaid / 100).toFixed(2)}</p>
          <p>${
            doc.validUntil
              ? `Valid until: ${new Date(doc.validUntil).toLocaleString()}`
              : 'Lifetime Access'
          }</p>
        </div>
      `,
    });

    await AgentPayment.updateOne(
      { _id: doc._id },
      { confirmationEmailSentAt: new Date() }
    );
  } catch (err) {
    console.error('❌ Email send error:', err);
  }
}

/* --------------------------------------------------------
 * SAVE & SYNC DEALER SUBSCRIPTIONS
 * -------------------------------------------------------- */
async function saveDealerSubscription(subscription, email, planType) {
  if (!subscription) return;

  if (!isDealershipSubscription(subscription)) return;

  const normalizedEmail = normalizeEmail(
    email ||
    subscription.metadata?.email ||
    subscription.items?.data?.[0]?.price?.metadata?.email
  );

  const normalizedPlanType = String(
    planType ||
      subscription.metadata?.planType ||
      subscription.items?.data?.[0]?.price?.nickname ||
      ''
  )
    .toLowerCase()
    .trim();

  const price = subscription.items?.data?.[0]?.price || null;

  const start =
    subscription.current_period_start &&
    new Date(subscription.current_period_start * 1000);

  const end =
    subscription.current_period_end &&
    new Date(subscription.current_period_end * 1000);

  const interval =
    subscription.items?.data?.[0]?.price?.recurring?.interval || null;

  // Compute dealer metadata once
  const access = computeAccessFromPlan(normalizedPlanType);

  // Save AgentPayment entry
  const doc = await AgentPayment.findOneAndUpdate(
    { subscriptionId: subscription.id },
    {
      email: normalizedEmail,
      type: normalizedPlanType,
      category: 'dealership',
      provider: 'stripe',
      mode: 'subscription',
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
      priceId: price?.id || null,
      productId: price?.product || null,
      subscriptionInterval: interval,
      latestEventAt: new Date(),
      ...(access || {}),
    },
    { upsert: true, new: true }
  );

  // Sync Dealer model
  try {
    const now = new Date();
    const isActive =
      subscription.status === 'active' &&
      end &&
      end.getTime() > now.getTime();

    await Dealer.updateMany(
      { contactEmail: normalizedEmail },
      {
        subscriptionStatus: subscription.status,
        subscriptionValidUntil: end || null,
        acceptingApplications: isActive,
      }
    );
  } catch (err) {
    console.error('❌ Failed to sync Dealer subscription:', err);
  }

  return doc;
}

/* --------------------------------------------------------
 * MAIN WEBHOOK ENDPOINT
 * -------------------------------------------------------- */
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('❌ Invalid Stripe webhook signature:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const type = event.type;
    const data = event.data.object;

    console.log(`📥 Webhook received: ${type}`);

    /* -----------------------------------------------------
     * CHECKOUT SESSION COMPLETED
     * ----------------------------------------------------- */
    if (type === 'checkout.session.completed') {
      const email = normalizeEmail(
        data.customer_details?.email ||
        data.metadata?.email ||
        ''
      );

      const planType = normalizeEmail(data.metadata?.planType);
      const category = data.metadata?.category;

      // REAL ESTATE — one-time payment
      if (data.mode === 'payment' && isRealEstateCheckoutSession(data)) {
        const { validUntil, listingCount } = computeAccessFromPlan(planType);

        const doc = await AgentPayment.findOneAndUpdate(
          { txId: data.id },
          {
            email,
            txId: data.id,
            amountPaid: data.amount_total ?? 0,
            currency: data.currency,
            type: planType,
            validUntil,
            listingCount,
            confirmed: true,
            provider: 'stripe',
            mode: 'payment',
            category: 'real_estate',
            checkoutSessionId: data.id,
            customerId: data.customer || null,
            latestEventAt: new Date(),
          },
          { upsert: true, new: true }
        );

        await sendConfirmationEmail(doc);
        return res.json({ received: true });
      }

      // DEALERSHIP — initial subscription
      if (data.mode === 'subscription' && category === 'dealership') {
        if (data.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            data.subscription
          );
          await saveDealerSubscription(subscription, email, planType);
        }
        return res.json({ received: true });
      }

      return res.json({ received: true });
    }

    /* -----------------------------------------------------
     * SUBSCRIPTION CREATED / UPDATED
     * ----------------------------------------------------- */
    if (
      type === 'customer.subscription.created' ||
      type === 'customer.subscription.updated'
    ) {
      const subscription = data;

      if (isDealershipSubscription(subscription)) {
        const email = normalizeEmail(
          subscription.metadata?.email ||
          subscription.items?.data?.[0]?.price?.metadata?.email
        );

        const planType = normalizeEmail(
          subscription.metadata?.planType ||
          subscription.items?.data?.[0]?.price?.nickname
        );

        await saveDealerSubscription(subscription, email, planType);
      }

      return res.json({ received: true });
    }

    /* -----------------------------------------------------
     * INVOICE PAID (renewal)
     * ----------------------------------------------------- */
    if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
      if (!data.subscription) return res.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(
        data.subscription
      );

      if (!isDealershipSubscription(subscription)) {
        return res.json({ received: true });
      }

      const email = normalizeEmail(
        subscription.metadata?.email ||
        subscription.items?.data?.[0]?.price?.metadata?.email
      );

      const planType = normalizeEmail(
        subscription.metadata?.planType ||
        subscription.items?.data?.[0]?.price?.nickname
      );

      await saveDealerSubscription(subscription, email, planType);

      await AgentPayment.updateOne(
        { subscriptionId: subscription.id },
        {
          invoiceId: data.id,
          amountPaid: data.amount_paid ?? null,
          latestEventAt: new Date(),
        }
      );

      return res.json({ received: true });
    }

    /* -----------------------------------------------------
     * PAYMENT FAILED (past_due)
     * ----------------------------------------------------- */
    if (type === 'invoice.payment_failed') {
      if (!data.subscription) return res.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(
        data.subscription
      );

      if (!isDealershipSubscription(subscription)) {
        return res.json({ received: true });
      }

      const email = normalizeEmail(subscription.metadata?.email);

      await AgentPayment.findOneAndUpdate(
        { subscriptionId: subscription.id },
        {
          subscriptionStatus: 'past_due',
          latestEventAt: new Date(),
        }
      );

      await Dealer.updateMany(
        { contactEmail: email },
        {
          subscriptionStatus: 'past_due',
          acceptingApplications: false,
        }
      );

      return res.json({ received: true });
    }

    /* -----------------------------------------------------
     * SUBSCRIPTION CANCELED
     * ----------------------------------------------------- */
    if (type === 'customer.subscription.deleted') {
      const subscription = data;

      if (!isDealershipSubscription(subscription)) {
        return res.json({ received: true });
      }

      const email = normalizeEmail(subscription.metadata?.email);

      await AgentPayment.findOneAndUpdate(
        { subscriptionId: subscription.id },
        {
          subscriptionStatus: 'canceled',
          latestEventAt: new Date(),
        }
      );

      await Dealer.updateMany(
        { contactEmail: email },
        {
          subscriptionStatus: 'canceled',
          acceptingApplications: false,
        }
      );

      return res.json({ received: true });
    }

    return res.json({ received: true });
  }
);

export default router;
