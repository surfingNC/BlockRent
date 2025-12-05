// backend/routes/dealers.js
import express from 'express';
import Dealer from '../models/Dealer.js';
import zipcodes from 'zipcodes';
import authMiddleware from '../middleware/authMiddleware.js';
import { sendDealerWelcomeEmail } from '../utils/sendDealerWelcomeEmail.js';
import AgentPayment from '../models/AgentPayment.js';

const router = express.Router();

/* ---------------------------------------------------------
 * NORMALIZE EMAIL
 * --------------------------------------------------------- */
function normalize(email) {
  return String(email || '').trim().toLowerCase();
}

/* ---------------------------------------------------------
 * PUBLIC SEARCH — Only show ACTIVE dealership listings
 * --------------------------------------------------------- */
router.get('/search', async (req, res) => {
  try {
    const { zip, radius = 25 } = req.query;

    if (!zip) return res.json({ count: 0, dealers: [] });

    const origin = zipcodes.lookup(zip);
    if (!origin) return res.status(400).json({ error: 'Invalid ZIP code' });

    const zipStrings = (zipcodes.radius(zip, Number(radius)) || [])
      .map(String);

    console.log(`🔍 Searching ${radius} miles around ${zip} → ${zipStrings.length} zips`);

    const now = new Date();

    // Only show live dealership listings
    let dealers = await Dealer.find({
      zipCode: { $in: zipStrings },
      subscriptionStatus: 'active',
      subscriptionValidUntil: { $gt: now },
      acceptingApplications: true,
    }).sort({ createdAt: -1 });

    // Try exact ZIP fallback
    if (dealers.length === 0) {
      dealers = await Dealer.find({
        zipCode: String(zip),
        subscriptionStatus: 'active',
        subscriptionValidUntil: { $gt: now },
        acceptingApplications: true,
      }).sort({ createdAt: -1 });
    }

    return res.json({ count: dealers.length, dealers });
  } catch (err) {
    console.error('❌ Error searching dealers:', err);
    res.status(500).json({ error: 'Failed to search dealerships' });
  }
});

/* ---------------------------------------------------------
 * CREATE DEALERSHIP — Requires active subscription
 * --------------------------------------------------------- */
router.post('/create', authMiddleware, async (req, res) => {
  console.log('📩 Dealer payload received:', req.body);

  try {
    const { dealershipName, address, zipCode, contactEmail, images } = req.body;

    if (!dealershipName || !address || !zipCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedEmail = normalize(contactEmail || req.user.email);

    // Check subscription in AgentPayment
    const sub = await AgentPayment.findOne({
      email: normalizedEmail,
      category: 'dealership',
    })
      .sort({ latestEventAt: -1 })
      .lean();

    // Must wait for webhook to write period end
    if (!sub || !sub.currentPeriodEnd) {
      return res.status(403).json({
        error: 'subscription_pending_webhook',
        message: 'Your payment succeeded, but Stripe webhook is still processing. Try again shortly.',
      });
    }

    const now = new Date();
    const isActive =
      sub.subscriptionStatus === 'active' &&
      new Date(sub.currentPeriodEnd) > now;

    if (!isActive) {
      return res.status(403).json({ error: 'active_subscription_required' });
    }

    // Enforce one billing email = one dealership listing
    const existingDealer = await Dealer.findOne({ contactEmail: normalizedEmail });
    if (existingDealer) {
      return res.status(400).json({
        error: 'duplicate_listing',
        message: 'A dealership listing already exists for this subscription.',
      });
    }

    const dealer = new Dealer({
      userId: req.user.id,
      dealershipName,
      address,
      zipCode,
      contactEmail: normalizedEmail,
      images: images || [],
      subscriptionValidUntil: sub.currentPeriodEnd,
      subscriptionStatus: sub.subscriptionStatus,
      acceptingApplications: true,
    });

    await dealer.save();

    // Optional welcome email
    try {
      await sendDealerWelcomeEmail(dealer);
    } catch (e) {
      console.warn('⚠️ Welcome email failed:', e.message);
    }

    return res.status(201).json({ message: 'Dealer profile created', dealer });
  } catch (err) {
    console.error('❌ Error creating dealer:', err);
    res.status(500).json({ error: 'Failed to create dealer' });
  }
});

/* ---------------------------------------------------------
 * GET MY DEALERSHIP (user has at most 1)
 * --------------------------------------------------------- */
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const dealers = await Dealer.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(dealers);
  } catch (err) {
    console.error('❌ Error fetching user dealers:', err);
    res.status(500).json({ error: 'Failed to fetch user dealerships' });
  }
});

/* ---------------------------------------------------------
 * UPDATE DEALER
 * --------------------------------------------------------- */
router.put('/:id/update', authMiddleware, async (req, res) => {
  try {
    if (req.body.contactEmail) {
      req.body.contactEmail = normalize(req.body.contactEmail);
    }

    const dealer = await Dealer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

    res.json(dealer);
  } catch (err) {
    console.error('❌ Error updating dealer:', err);
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

/* ---------------------------------------------------------
 * OWNER TOGGLES acceptingApplications
 * --------------------------------------------------------- */
router.patch('/:id/accepting', authMiddleware, async (req, res) => {
  try {
    const dealer = await Dealer.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

    const now = new Date();
    const subscriptionActive =
      dealer.subscriptionStatus === 'active' &&
      dealer.subscriptionValidUntil &&
      dealer.subscriptionValidUntil > now;

    // Cannot enable if subscription expired
    if (!subscriptionActive && req.body.accepting) {
      return res.status(403).json({
        error: 'Subscription inactive — cannot accept applications.',
      });
    }

    dealer.acceptingApplications = !!req.body.accepting;
    await dealer.save();

    res.json(dealer);
  } catch (err) {
    console.error('❌ Error updating acceptingApplications:', err);
    res.status(500).json({ error: 'Failed to update accepting applications' });
  }
});

/* ---------------------------------------------------------
 * DELETE DEALER
 * --------------------------------------------------------- */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Dealer.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) return res.status(404).json({ error: 'Dealer not found' });

    res.json({ message: 'Dealer deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting dealer:', err);
    res.status(500).json({ error: 'Failed to delete dealer' });
  }
});

export default router;
