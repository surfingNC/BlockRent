import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import Listing from '../models/Listing.js';

const router = express.Router();

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
