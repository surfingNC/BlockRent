const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Verification = require('../models/Verification');

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

module.exports = router;
