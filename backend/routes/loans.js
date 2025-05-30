const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// Protected test route
router.get('/dashboard', auth, (req, res) => {
  res.json({ msg: `Welcome back, user ${req.user.id}` });
});
