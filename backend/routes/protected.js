// backend\routes\protected.js
import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    msg: `Welcome, user with ID: ${req.user.id}`,
  });
});

export default router;
