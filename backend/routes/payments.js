import express from 'express';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { fetchTxDetails, parseTxForSubscription } from '../utils/txUtils.js';
import { SUBSCRIPTIONS } from '../utils/subscriptionTiers.js';
import sendConfirmationEmail from '../utils/Application/Email.js';
import { v4 as uuidv4 } from 'uuid';
import PaymentSession from '../models/PaymentSession.js';

const router = express.Router();

router.post('/start-payment-session', async (req, res) => {
  const { email, planType } = req.body;

  if (!email || !planType) {
    return res.status(400).json({ error: 'Missing email or planType' });
  }

  try {
    // 🧹 Clean up old sessions for this email
    await PaymentSession.deleteMany({ email });

    // 🆕 Create new session
    const sessionId = uuidv4();
    const newSession = new PaymentSession({
      sessionId,
      email,
      planType,
      createdAt: new Date()
    });

    await newSession.save();

    console.log('🆕 PaymentSession created:', sessionId);
    return res.status(201).json({ sessionId });
  } catch (err) {
    console.error('❌ Failed to create session:', err);
    return res.status(500).json({ error: 'Failed to create payment session' });
  }
});



/**
 * @route POST /api/payments/verify-payment
 */
router.post('/verify-payment', async (req, res) => {
  console.log("📩 Incoming verify-payment request:", req.body);

  const { txId, sessionId, walletAddress } = req.body;

  if (!txId || !sessionId) {
    return res.status(400).json({ error: 'Missing txId or sessionId' });
  }

  // Look up the session
 const session = await PaymentSession.findOne({
  sessionId,
  createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // 15 minutes ago
});


  if (!session) {
    console.warn('❌ Session not found for ID:', sessionId);
    return res.status(400).json({ error: 'Invalid or expired payment session.' });
  } else {
    console.log('✅ Found session:', session);
  }

  //const email = session.email;
  const email = session?.email || req.body.email; // ✅ fallback
  if (!email) {
    console.warn(`❌ Email is missing for tx: ${txId}, session: ${sessionId}`);
    console.log('📦 Full session object:', session); 
    console.log('📬 req.body.email was:', req.body.email);
    return res.status(400).json({ error: 'Missing user email.' });
  }

  try {
    const details = await fetchTxDetails(txId);
    console.log('🔎 Full transaction details:', JSON.stringify(details, null, 2));

    const { confirmed, amountSats, subTier } = parseTxForSubscription(details);

    if (!subTier) {
      return res.status(400).json({
        error: 'Transaction does not match any subscription tier or receiving address.',
      });
    }

    if (!walletAddress) {
      console.warn(`⚠️ Missing wallet address for tx ${txId}`);
    }

    if (!email || email === 'MISSING') {
      console.warn(`❌ Cannot save PendingTx — missing valid email for tx: ${txId}`);
      return res.status(400).json({ error: 'Missing email. Cannot save pending transaction.' });
    }


    if (!confirmed) {
      try {
        console.log("💌 Email going into PendingTx:", email);

        const pendingResult = await PendingTx.findOneAndUpdate(
          { txId },
          {
            txId,
            email: email,
            walletAddress: walletAddress || 'unknown',
            amountSats,
            type: subTier.type,
          },
          { upsert: true, new: true }
        );

        console.log(`🕓 Tx ${txId} is unconfirmed — saved to PendingTx`);
        return res.status(202).json({
          pending: true,
          message: 'Transaction detected but not yet confirmed.',
        });
      } catch (dbErr) {
        console.error('❌ Failed to save PendingTx:', dbErr);
        return res.status(500).json({ error: 'Database error saving pending transaction.' });
      }
    }
    console.log('💾 Writing to AgentPayment:', {
      txId,
      email,
      walletAddress,
      amountSats,
      type: subTier.type,
      validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
      listingCount: subTier.listingCount,
    });


    const paymentResult = await AgentPayment.findOneAndUpdate(
      { txId },
      {
        txId,
        email,
        walletAddress: walletAddress || 'unknown',
        amountSats,
        type: subTier.type,
        validUntil: new Date(Date.now() + subTier.durationDays * 24 * 60 * 60 * 1000),
        listingCount: subTier.listingCount,
        confirmed: true,
      },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`✅ Confirmed tx ${txId} ${paymentResult ? 'updated' : 'created'} for ${email}`);

    try {
      await sendConfirmationEmail(email, subTier);
      console.log(`📧 Confirmation email sent to ${email}`);
    } catch (emailErr) {
      console.error(`❌ Email send failed for ${email}: ${emailErr.message}`);
    }

    return res.json({ success: true, tier: subTier.type });
  } catch (err) {
    console.error('❌ Verification failed:', err.message || err);
    return res.status(500).json({ error: 'Server error while verifying transaction.' });
  }

});

/**
 * @route GET /api/payments/status
 * @desc Check if user has an active subscription or pending transaction
 */
router.get('/status', async (req, res) => {
  const { walletAddress, email } = req.query;

  if (!walletAddress && !email) {
    return res.status(400).json({ error: 'walletAddress or email is required' });
  }

  try {
    const query = walletAddress ? { walletAddress } : { email };

    // 1. Check confirmed payment
    const payment = await AgentPayment.findOne({ ...query, confirmed: true }).sort({ validUntil: -1 });

    if (payment) {
      const now = new Date();
      const active = payment.validUntil > now;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔍 Confirmed payment for ${email || walletAddress}:`, {
          active,
          type: payment.type,
          validUntil: payment.validUntil,
        });
      }

      return res.json({
        status: active ? 'active' : 'expired',
        type: payment.type,
        validUntil: payment.validUntil,
        listingCount: payment.listingCount,
      });
    }

    // 2. Check pending transaction
    const pending = await PendingTx.findOne(query).sort({ _id: -1 });

    if (pending) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⏳ Pending tx for ${email || walletAddress}:`, pending.txId);
      }

      return res.json({
        status: 'pending',
        type: pending.type,
        amountSats: pending.amountSats,
        txId: pending.txId,
      });
    }

    // 3. Default to inactive (don’t log)
    return res.json({ status: 'inactive' });
  } catch (err) {
    console.error('❌ Error checking subscription status:', err);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});



/**
 * @route GET /api/payments/tiers
 * @desc Return available subscription tiers for frontend
 */
router.get('/tiers', (req, res) => {
  //console.log("📦 Sending subscription tiers:", SUBSCRIPTIONS);

  const formatted = SUBSCRIPTIONS.map((tier) => ({
    type: tier.type,
    label: tier.label || tier.type.charAt(0).toUpperCase() + tier.type.slice(1),
    sats: tier.sats,
    durationDays: tier.durationDays,
    listingCount: tier.listingCount === Infinity ? 'Unlimited' : tier.listingCount,
  }));

  res.json(formatted);
});

export default router;
