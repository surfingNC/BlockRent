// routes/profile.js
import express from 'express';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/update-phone', authMiddleware, async (req, res) => {
  const { phone } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findByIdAndUpdate(userId, { phone }, { new: true });
    res.json({ success: true, phone: user.phone });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update phone number' });
  }
});

export default router;
