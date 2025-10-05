import AgentPayment from '../models/AgentPayment.js';
import User from '../models/User.js';

export default async function checkAgentPayment(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }

    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(401).json({ error: 'User not found or missing email' });
    }

    const now = new Date();

    // Find a confirmed, valid payment record for this user
    const payment = await AgentPayment.findOne({
      email: user.email.toLowerCase(),
      confirmed: true,
      $or: [
        { validUntil: null },           // lifetime / pay-per-listing plan
        { validUntil: { $gt: now } },   // active subscription
      ],
    })
      .sort({ validUntil: -1 })
      .lean(false);

    if (!payment) {
      console.log(`🚫 No active subscription for ${user.email}`);
      return res.status(403).json({ error: 'No active subscription or listing credit' });
    }

    // === Access Logic ===
    if (payment.type === 'unlimited') {
      return next(); // Full access
    }

    if ((payment.type === 'pro' || payment.type === 'basic')) {
      if (payment.listingCount && payment.listingCount > 0) {
        payment.listingCount = Math.max(0, payment.listingCount - 1);
        await payment.save();
        console.log(`✅ ${user.email}: 1 credit used, remaining = ${payment.listingCount}`);
        return next();
      } else {
        return res.status(403).json({ error: 'No remaining listing credits' });
      }
    }

    // Fallback
    return res.status(403).json({ error: 'Subscription type not recognized or expired' });

  } catch (err) {
    console.error('❌ checkAgentPayment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
