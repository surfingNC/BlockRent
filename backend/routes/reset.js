import express from 'express';
import User from '../models/User.js';
import Verification from '../models/Verification.js';

const router = express.Router();

// 🚨 Dev-only route to reset the database
router.post('/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Verification.deleteMany({});
    console.log('🧹 All users and verification codes deleted.');
    res.status(200).json({ message: '✅ Database reset successfully' });
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    res.status(500).json({ message: '❌ Failed to reset database' });
  }
});

export default router;
