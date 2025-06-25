import express from 'express';
import User from '../models/User.js';
import Verification from '../models/Verification.js';

const router = express.Router();

// Dev route to reset the database (ONLY for development/testing)
router.post('/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Verification.deleteMany({});
    res.status(200).json({ message: '✅ Database reset successfully' });
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    res.status(500).json({ message: '❌ Failed to reset database' });
  }
});

export default router;
