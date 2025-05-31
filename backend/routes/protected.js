// routes/protectedRoute.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    msg: `Welcome, user with ID: ${req.user.id}`,
  });
});

module.exports = router;
