// middleware/checkAgentPayment.js
import AgentPayment from '../models/AgentPayment.js';
import User from '../models/User.js';

export default async function (req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const now = new Date();
    const query = [];

    if (user.walletAddress) {
      query.push({ walletAddress: user.walletAddress, validUntil: { $gt: now }, confirmed: true });
    }

    if (user.email) {
      query.push({ email: user.email, validUntil: { $gt: now }, confirmed: true });
    }

    if (query.length === 0) {
      return res.status(401).json({ error: 'No identifier found for subscription lookup' });
    }

    const payment = await AgentPayment.findOne({ $or: query }).sort({ validUntil: -1 });

    if (!payment) {
      console.log(`🚫 No valid subscription found for user ${user.email || user.walletAddress}`);
      return res.status(403).json({ error: 'No active subscription or listing credit' });
    }

    if (payment.type === 'unlimited') {
      return next(); // full access
    }

    if ((payment.type === 'pro' || payment.type === 'basic') && payment.listingCount > 0) {
      payment.listingCount = Math.max(0, payment.listingCount - 1); // prevent negatives
      await payment.save();
      return next();
    }

    return res.status(403).json({ error: 'No remaining listing credits' });
  } catch (err) {
    console.error('❌ checkAgentPayment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
