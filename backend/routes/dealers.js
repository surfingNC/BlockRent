import express from 'express';
import Dealer from '../models/Dealer.js';
import { sendDealerWelcomeEmail } from '../utils/sendDealerWelcomeEmail.js';

const router = express.Router();

// ✅ Create dealership (after subscription/payment)
router.post('/create', async (req, res) => {
  try {
    const { dealershipName, address, contactEmail, subscriptionType, images } = req.body;
    if (!dealershipName || !address || !contactEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Dealer.findOne({ contactEmail });
    if (existing) {
      return res.status(400).json({ error: 'Dealer already exists' });
    }

    const duration = subscriptionType === 'annual' ? 365 : 30;
    const validUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

    const dealer = new Dealer({
      dealershipName,
      address,
      contactEmail,
      subscriptionType,
      subscriptionValidUntil: validUntil,
      images,
    });

    await dealer.save();
    await sendDealerWelcomeEmail(dealer);

    res.status(201).json({ message: 'Dealer profile created', dealer });
  } catch (err) {
    console.error('Error creating dealer:', err);
    res.status(500).json({ error: 'Failed to create dealer' });
  }
});

// ✅ Fetch all dealerships OR by email
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;

    if (email) {
      // find dealer by contactEmail (for dashboard use)
      const dealer = await Dealer.findOne({ contactEmail: email });
      if (!dealer) {
        return res.status(404).json({ error: 'Dealer not found' });
      }
      return res.json(dealer);
    }

    // otherwise return all dealerships (for car listings)
    const dealers = await Dealer.find({}).sort({ createdAt: -1 });
    res.json(dealers);
  } catch (err) {
    console.error('Error fetching dealers:', err);
    res.status(500).json({ error: 'Failed to fetch dealers' });
  }
});

// ✅ Update dealer info / images
router.put('/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    const dealer = await Dealer.findByIdAndUpdate(id, req.body, { new: true });
    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });
    res.json(dealer);
  } catch (err) {
    console.error('Error updating dealer:', err);
    res.status(500).json({ error: 'Failed to update dealer' });
  }
});

// ✅ Delete dealer (optional admin use)
router.delete('/:id', async (req, res) => {
  try {
    await Dealer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Dealer deleted' });
  } catch (err) {
    console.error('Error deleting dealer:', err);
    res.status(500).json({ error: 'Failed to delete dealer' });
  }
});

export default router;
