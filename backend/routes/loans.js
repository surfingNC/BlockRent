// backend/routes/protected.js
import express from 'express';
import verifyToken from '../middleware/auth.js'; // adjust if your middleware file is named differently

const router = express.Router();

router.get('/dashboard', verifyToken, (req, res) => {
  res.json({ msg: `Welcome back, user ${req.user.id}` });
});

export default router;
