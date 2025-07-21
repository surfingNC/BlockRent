import express from 'express';
import zipcodes from 'zipcodes';
import verifyToken from '../middleware/authMiddleware.js';
import Listing from '../models/Listing.js';

const router = express.Router();

// === GET All Listings with optional proximity sort ===
router.get('/listings', async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });

    const { zip } = req.query;

    if (zip) {
      const origin = zipcodes.lookup(zip);
      if (!origin) {
        return res.status(400).json({ error: 'Invalid ZIP code' });
      }

      const withDistances = listings.map((listing) => {
        const target = zipcodes.lookup(listing.zipCode);
        if (!target) return { ...listing.toObject(), distance: Infinity };

        const distance = zipcodes.distance(origin.zip, target.zip);
        return { ...listing.toObject(), distance };
      });

      withDistances.sort((a, b) => a.distance - b.distance);
      return res.json(withDistances);
    }

    res.json(listings);
  } catch (err) {
    console.error('❌ Error fetching listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// === POST Create Listing ===
router.post('/listings', verifyToken, async (req, res) => {
  try {
    const {
      streetAddress,
      zipCode,
      state,              
      description,
      contactEmail,
      imageUrls,
      price,
    } = req.body;

    const newListing = new Listing({
      owner: req.user.id,
      streetAddress,
      zipCode,
      state,             
      description,
      contactEmail,
      imageUrls,
      price,
    });

    await newListing.save();
    res.status(201).json({ message: 'Listing created successfully', listing: newListing });
  } catch (err) {
    console.error('❌ Error creating listing:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// === GET All Listings ===
router.get('/listings', async (req, res) => {
  try {
    const listings = await Listing.find().sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('❌ Error fetching listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

export default router;
