import express from 'express';
import Dealer from '../models/Dealer.js';
import zipcodes from 'zipcodes';
import { sendDealerWelcomeEmail } from '../utils/sendDealerWelcomeEmail.js';

const router = express.Router();

/**
 * ✅ Create dealership (unchanged)
 */
router.post('/create', async (req, res) => {
  try {
    const { dealershipName, address, zipCode, contactEmail, subscriptionType, images } = req.body;
    if (!dealershipName || !address || !zipCode || !contactEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedEmail = contactEmail.toLowerCase().trim();
    const existing = await Dealer.findOne({ contactEmail: normalizedEmail });
    if (existing) return res.status(400).json({ error: 'Dealer already exists' });

    const durationDays = subscriptionType === 'annual' ? 365 : 30;
    const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const dealer = new Dealer({
      dealershipName,
      address,
      zipCode,
      contactEmail: normalizedEmail,
      subscriptionType,
      subscriptionValidUntil: validUntil,
      images,
    });

    await dealer.save();
    try { await sendDealerWelcomeEmail(dealer); } catch (e) { console.warn('Email failed:', e.message); }

    res.status(201).json({ message: 'Dealer profile created', dealer });
  } catch (err) {
    console.error('❌ Error creating dealer:', err);
    res.status(500).json({ error: 'Failed to create dealer' });
  }
});

/**
 * ✅ Radius-based ZIP search
 * Example: GET /api/dealers/search?zip=27609&radius=50
 */
router.get('/search', async (req, res) => {
  try {
    const { zip, radius = 25 } = req.query;
    if (!zip) return res.status(400).json({ error: 'ZIP code is required' });

    // look up base ZIP info
    const origin = zipcodes.lookup(zip);
    if (!origin) return res.status(400).json({ error: 'Invalid ZIP code' });

    // get list of ZIPs within radius miles
    const nearbyZips = zipcodes.radius(zip, Number(radius));
    if (!nearbyZips?.length) return res.json([]);

    // find all dealers whose zipCode is in that list
    const dealers = await Dealer.find({ zipCode: { $in: nearbyZips } }).sort({ createdAt: -1 });

    res.json({ count: dealers.length, dealers });
  } catch (err) {
    console.error('❌ Error searching nearby dealers:', err);
    res.status(500).json({ error: 'Failed to search nearby dealers' });
  }
});

/**
 * ✅ Existing / route for dashboard & all listings
 */
router.get('/', async (req, res) => {
  try {
    const { email, zipCode } = req.query;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const dealer = await Dealer.findOne({ contactEmail: normalizedEmail });
      if (!dealer) return res.status(404).json({ error: 'Dealer not found' });
      return res.json(dealer);
    }

    const filter = zipCode ? { zipCode } : {};
    const dealers = await Dealer.find(filter).sort({ createdAt: -1 });
    res.json(dealers);
  } catch (err) {
    console.error('❌ Error fetching dealers:', err);
    res.status(500).json({ error: 'Failed to fetch dealerships' });
  }
});

export default router;
