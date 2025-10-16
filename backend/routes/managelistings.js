import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import Listing from '../models/Listing.js';

const router = express.Router();

/**
 * @route GET /api/managelistings/my-listings
 * @desc  Fetch listings owned by the logged-in user
 */
router.get('/my-listings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // ✅ from token
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing user id' });
    }

    // ✅ match by owner ObjectId, not email
    const listings = await Listing.find({ owner: userId }).sort({ createdAt: -1 });

    res.json(listings);
  } catch (err) {
    console.error('❌ Error fetching user listings:', err);
    res.status(500).json({ error: 'Server error while fetching listings' });
  }
});

/**
 * @route DELETE /api/managelistings/:id
 * @desc  Delete a specific listing owned by the user
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const listing = await Listing.findOneAndDelete({
      _id: req.params.id,
      owner: userId, // ✅ only delete if owner matches
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or not authorized' });
    }

    res.json({ msg: 'Listing deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting listing:', err);
    res.status(500).json({ error: 'Server error while deleting listing' });
  }
});

export default router;
