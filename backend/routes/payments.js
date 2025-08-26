import express from 'express';
import axios from 'axios';
import PendingTx from '../models/PendingTx.js';
import AgentPayment from '../models/AgentPayment.js';
import { fetchTxDetails, parseTxForSubscription } from '../utils/txUtils.js';
import { SUBSCRIPTIONS, determineSubscription } from '../utils/subscriptionTiers.js';
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

  const { txId, sessionId, walletAddress: walletFromBody, email: emailFromBody } = req.body;

  if (!txId || !sessionId) {
    return res.status(400).json({ error: 'Missing txId or sessionId' });
  }

  // Look up the session (15-minute window)
  const session = await PaymentSession.findOne({
    sessionId,
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
  });

  if (!session) {
    console.warn('❌ Session not found or expired for ID:', sessionId);
    return res.status(400).json({ error: 'Invalid or expired payment session.' });
  } else {
    console.log('✅ Found session:', session);
  }

  // Email fallback: allow backend to proceed even if email isn't hydrated yet
  const email = session?.email || emailFromBody || 'unknown@blockrent.app';

  // Prefer body wallet, then session-stored wallet, then 'unknown'
  const walletAddress = walletFromBody || session?.walletAddress || 'unknown';

  try {
    const details = await fetchTxDetails(txId);
    console.log('🔎 Full transaction details:', JSON.stringify(details, null, 2));

    const { confirmed, amountSats, subTier, receiveMatched } = parseTxForSubscription(details);

    // Ensure this tx actually pays your receive address / matches a tier
    if (!subTier || receiveMatched === false) {
      return res.status(400).json({
        error: 'Transaction does not match any subscription tier or receiving address.',
      });
    }

    if (!confirmed) {
      // ---------- INSERTED: guarded PendingTx upsert ----------
      try {
        // Look for an existing pending for this tx
        const existing = await PendingTx.findOne({ txId }).lean().catch(() => null);

        // If this tx is already linked to a different session, don't relink it
        if (existing && existing.sessionId && existing.sessionId !== sessionId) {
          console.warn(
            `🔒 Tx ${txId} already linked to session ${existing.sessionId}; refusing to relink to ${sessionId}`
          );
          return res.status(202).json({
            pending: true,
            message: 'Transaction already pending under a different session.',
          });
        }

        // Preserve best-known email/wallet (don’t overwrite a real email with "unknown")
        let nextEmail = email;
        let nextWallet = walletAddress;

        if (existing) {
          if (existing.email && existing.email !== 'unknown@blockrent.app') {
            nextEmail = existing.email;
          }
          if (existing.walletAddress) {
            nextWallet = existing.walletAddress;
          }
        }

        console.log("💾 Upserting PendingTx with:", {
          txId, sessionId, email: nextEmail, walletAddress: nextWallet, amountSats, type: subTier.type
        });

        await PendingTx.findOneAndUpdate(
          { txId },
          {
            $setOnInsert: { createdAt: new Date() },
            $set: {
              sessionId,               // keep the session link for hydration
              email: nextEmail,        // may still be 'unknown@blockrent.app'
              walletAddress: nextWallet,
              amountSats,
              type: subTier.type,
            },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
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
      // ---------- /INSERTED ----------
    }

    // Confirmed path — avoid duplicate emails/updates
    const already = await AgentPayment.findOne({ txId, confirmed: true }).lean();
    if (already) {
      console.log(`ℹ️ Tx ${txId} already confirmed for ${already.email}`);
      return res.json({ status: 'already_confirmed', tier: already.type });
    }

    console.log('💾 Writing to AgentPayment:', {
      txId,
      email,
      walletAddress,
      amountSats,
      type: subTier.type,
      validUntil: getExpirationDate(subTier),
      listingCount: subTier.listingCount,
    });

    await AgentPayment.findOneAndUpdate(
      { txId },
      {
        txId,
        email,
        walletAddress,
        amountSats,
        type: subTier.type,
        validUntil: getExpirationDate(subTier),
        listingCount: subTier.listingCount,
        confirmed: true,
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Try to send the email only if we have a real address
    if (email && email !== 'unknown@blockrent.app' && email.includes('@')) {
      try {
        await sendConfirmationEmail(email, subTier);
        console.log(`📧 Confirmation email sent to ${email}`);
      } catch (emailErr) {
        console.error(`❌ Email send failed for ${email}: ${emailErr.message}`);
      }
    } else {
      console.log('📧 Skipping confirmation email due to placeholder/invalid email:', email);
    }

    // Clean up any pending record for this tx
    await PendingTx.deleteOne({ txId }).catch(() => {});

    return res.json({ success: true, tier: subTier.type });
  } catch (err) {
    console.error('❌ Verification failed:', err.message || err);
    console.error(err.stack);
    return res.status(500).json({ error: 'Server error while verifying transaction.' });
  }
});


// POST /api/payments/verify-latest
router.post('/verify-latest', async (req, res) => {
  try {
    const { sessionId, expectedSats, windowSec = 600 } = req.body; // 10 min default
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    // 1) Validate session
    const session = await PaymentSession.findOne({
      sessionId,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // 15 min window
    });
    if (!session) return res.status(400).json({ error: 'Invalid or expired session' });

    // 2) Receiving address
    const addr = process.env.BTC_RECEIVE_ADDRESS;
    if (!addr) return res.status(500).json({ error: 'BTC_RECEIVE_ADDRESS missing' });

    // 3) Find newest qualifying tx to our address
    const { data } = await axios.get(`https://mempool.space/api/address/${addr}/txs`, { timeout: 10000 });
    const now = Math.floor(Date.now() / 1000);

    let match = null;
    for (const tx of data || []) {
      const vout = tx?.vout || tx?.outputs || [];
      const out = vout.find(o => o?.scriptpubkey_address === addr);
      if (!out) continue;

      const sats = Number(out.value ?? 0);
      if (expectedSats && sats < Number(expectedSats)) continue;

      const ts = tx?.status?.block_time || tx?.status?.timestamp || now;
      if (now - ts > Number(windowSec)) continue;

      match = { txId: tx.txid, amountSats: sats, confirmed: Boolean(tx?.status?.confirmed) };
      break; // newest first
    }

    if (!match) return res.status(404).json({ error: 'No recent matching tx found' });

    // 4) Tier check
    const subTier = determineSubscription(match.amountSats);
    if (!subTier) return res.status(400).json({ error: 'Amount does not match any tier' });

    // 5) Guarded PendingTx upsert (don’t relink across different sessions; preserve good data)
    const existing = await PendingTx.findOne({ txId: match.txId }).lean().catch(() => null);

    if (existing && existing.sessionId && existing.sessionId !== sessionId) {
      console.warn(`🔒 Tx ${match.txId} already linked to session ${existing.sessionId}; refusing to relink to ${sessionId}`);
      return res.status(202).json({
        pending: true,
        message: 'Transaction already pending under a different session.',
        txId: match.txId,
      });
    }

    // preserve best-known values
    let nextEmail = session.email || 'unknown@blockrent.app';
    let nextWallet = existing?.walletAddress || 'unknown';
    if (existing?.email && existing.email !== 'unknown@blockrent.app') {
      nextEmail = existing.email;
    }

    await PendingTx.findOneAndUpdate(
      { txId: match.txId },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          sessionId,
          email: nextEmail,
          walletAddress: nextWallet,
          amountSats: match.amountSats,
          type: subTier.type,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // 6) If already confirmed, mirror confirm path immediately
    if (match.confirmed) {
      // If a confirmed doc already exists, short-circuit
      const already = await AgentPayment.findOne({ txId: match.txId, confirmed: true }).lean();
      if (!already) {
        await AgentPayment.findOneAndUpdate(
          { txId: match.txId },
          {
            txId: match.txId,
            email: nextEmail === 'unknown@blockrent.app' ? session.email : nextEmail,
            walletAddress: nextWallet,
            amountSats: match.amountSats,
            type: subTier.type,
            validUntil: getExpirationDate(subTier),
            listingCount: subTier.listingCount,
            confirmed: true,
          },
          { upsert: true, new: true, runValidators: true }
        );
      }

      await PendingTx.deleteOne({ txId: match.txId }).catch(() => {});
      return res.json({ success: true, tier: subTier.type, status: 'confirmed' });
    }

    // 7) Pending
    return res.status(202).json({ pending: true, tier: subTier.type, txId: match.txId });
  } catch (e) {
    console.error('verify-latest error:', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: 'verify-latest failed' });
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
