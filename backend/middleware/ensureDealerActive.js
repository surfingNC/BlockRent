// backend/middleware/ensureDealerActive.js
import AgentPayment from '../models/AgentPayment.js';

export default async function ensureDealerActive(req, res, next) {
  try {
    const email =
      req.user?.email ||
      req.body.email ||
      req.query.email ||
      '';

    if (!email) {
      return res
        .status(401)
        .json({ error: 'Email required for subscription check' });
    }

    const normalized = email.trim().toLowerCase();

    // Get latest dealership subscription
    const doc = await AgentPayment.findOne({
      email: normalized,
      category: 'dealership',
      subscriptionId: { $ne: null },
    })
      .sort({ latestEventAt: -1 })
      .lean();

    if (!doc) {
      return res
        .status(403)
        .json({ error: 'No active dealership subscription' });
    }

    const now = Date.now();
    const periodEnd = doc.currentPeriodEnd
      ? new Date(doc.currentPeriodEnd).getTime()
      : null;

    // Subscription expired
    if (periodEnd && now > periodEnd) {
      return res.status(403).json({ error: 'Subscription expired' });
    }

    // Payment failed
    if (doc.subscriptionStatus === 'past_due') {
      return res.status(402).json({ error: 'Payment failed (past_due)' });
    }

    // Subscription canceled
    if (doc.subscriptionStatus === 'canceled') {
      return res.status(403).json({ error: 'Subscription canceled' });
    }

    // All good
    return next();
  } catch (err) {
    console.error('ensureDealerActive error:', err);
    return res
      .status(500)
      .json({ error: 'Internal server error validating subscription' });
  }
}
