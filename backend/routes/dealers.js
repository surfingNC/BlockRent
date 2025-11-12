import express from 'express';
import Dealer from '../models/Dealer.js';
import { sendDealerWelcomeEmail } from '../utils/sendDealerWelcomeEmail.js';
import zipcodes from 'zipcodes';

const router = express.Router();

/**
 * ✅ Search dealerships by proximity
 * Returns { count, dealers } so frontend can safely read data.dealers
 */
router.get('/search', async (req, res) => {
  try {
    const { zip, radius } = req.query;

    if (!zip) {
      // no search yet → just send empty
      return res.json({ count: 0, dealers: [] });
    }

    // Validate ZIP
    const origin = zipcodes.lookup(zip);
    if (!origin) {
      return res.status(400).json({ error: 'Invalid ZIP code' });
    }

    // Find nearby ZIPs within radius (default 25 miles)
    const nearbyZips = zipcodes.radius(zip, parseInt(radius) || 25) || [];
    const zipStrings = nearbyZips.map(z => String(z)); // normalize to strings

    console.log(
      `🔍 Searching within ${radius || 25} miles of ${zip} → ${zipStrings.length} ZIPs`
    );

    // Find dealers whose ZIP is within the nearby list
    let dealers = await Dealer.find({ zipCode: { $in: zipStrings } }).sort({ createdAt: -1 });

    // ✅ Fallback to exact ZIP if radius query somehow misses it
    if (dealers.length === 0) {
      const exact = await Dealer.find({ zipCode: String(zip) }).sort({ createdAt: -1 });
      if (exact.length > 0) {
        console.log(`📌 Fallback exact-zip query matched ${exact.length} dealer(s)`);
        dealers = exact;
      }
    }

    return res.json({ count: dealers.length, dealers });
  } catch (err) {
    console.error('❌ Error searching dealers by ZIP:', err);
    res.status(500).json({ error: 'Failed to search dealers' });
  }
});

/**
 * ✅ Create dealership (after subscription/payment)
 */
router.post('/create', async (req, res) => {
  console.log('📩 Dealer payload received:', req.body);
  try {
    const { dealershipName, address, zipCode, contactEmail, subscriptionType, images } = req.body;
    if (!dealershipName || !address || !contactEmail || !zipCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedEmail = contactEmail.toLowerCase().trim();

    // Check for existing dealer (case-insensitive)
    const existing = await Dealer.findOne({ contactEmail: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'Dealer already exists' });
    }

    // Calculate subscription period
    const durationDays = subscriptionType === 'annual' ? 365 : 30;
    const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Create dealer record
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

    // Optional welcome email
    try {
      await sendDealerWelcomeEmail(dealer);
    } catch (emailErr) {
      console.warn('Welcome email failed:', emailErr.message);
    }

    res.status(201).json({ message: 'Dealer profile created', dealer });
  } catch (err) {
    console.error('❌ Error creating dealer:', err);
    res.status(500).json({ error: 'Failed to create dealer' });
  }
});

/**
 * ✅ Fetch all dealerships OR a single dealer by email
 */
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const dealer = await Dealer.findOne({ contactEmail: normalizedEmail });

      if (!dealer) {
        return res.status(404).json({ error: 'Dealer not found' });
      }

      return res.json(dealer);
    }

    // Default: don’t return all unless explicitly searched
    return res.json({ count: 0, dealers: [] });
  } catch (err) {
    console.error('❌ Error fetching dealers:', err);
    res.status(500).json({ error: 'Failed to fetch dealerships' });
  }
});

/**
 * ✅ Update dealer info (images, address, etc.)
 */
router.put('/:id/update', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.contactEmail) {
      req.body.contactEmail = req.body.contactEmail.toLowerCase().trim();
    }

    const dealer = await Dealer.findByIdAndUpdate(id, req.body, { new: true });
    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

    res.json(dealer);
  } catch (err) {
    console.error('❌ Error updating dealer:', err);
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

/**
 * ✅ Delete dealer (admin use)
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Dealer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Dealer not found' });

    res.json({ message: 'Dealer deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting dealer:', err);
    res.status(500).json({ error: 'Failed to delete dealer' });
  }
});

export default router;
