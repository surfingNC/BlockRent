// middleware/checkAgentPayment.js
import AgentPayment from '../models/AgentPayment.js';

export default async function (req, res, next) {
  const walletAddress = req.user?.walletAddress;
  if (!walletAddress) {
    return res.status(401).json({ error: 'Wallet address required' });
  }

  const payment = await AgentPayment.findOne({
    walletAddress,
    validUntil: { $gt: new Date() }
  }).sort({ validUntil: -1 }); // use the most recent valid payment

  if (!payment) {
    return res.status(403).json({ error: 'No active subscription or listing credit' });
  }

  if (payment.type === 'unlimited') {
    return next(); // all good
  }

  if ((payment.type === 'pro' || payment.type === 'basic') && payment.listingCount > 0) {
    payment.listingCount -= 1;
    await payment.save();
    return next();
  }

  return res.status(403).json({ error: 'No remaining listing credits' });
}
