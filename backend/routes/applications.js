import express from 'express';
import CarApplication from '../models/CarApplication.js';
import Dealer from '../models/Dealer.js';
import { sendDealerApplicationEmail } from '../utils/sendDealerApplicationEmail.js';

const router = express.Router();

/**
 * 🚗 Submit dealership lease application
 */
router.post('/submit', async (req, res) => {
  try {
    const {
      dealershipId,
      applicantEmail,
      btcAddress,
      btcHoldings,
      message
    } = req.body;

    if (!dealershipId || !applicantEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch dealer
    const dealer = await Dealer.findById(dealershipId);
    if (!dealer) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    /* ----------------------------------------------------
     * ❌ HARD BLOCK 1 — Stripe subscription inactive/expired
     * ---------------------------------------------------- */
    const now = new Date();

    const subscriptionExpired =
      !dealer.subscriptionValidUntil ||
      now > dealer.subscriptionValidUntil ||
      dealer.subscriptionStatus !== 'active';

    if (subscriptionExpired) {
      return res.status(403).json({
        error: 'This dealership subscription is inactive or expired. Applications are temporarily disabled.',
      });
    }

    /* ----------------------------------------------------
     * ❌ HARD BLOCK 2 — dealer turned off applications
     * ---------------------------------------------------- */
    if (!dealer.acceptingApplications) {
      return res.status(403).json({
        error: 'This dealership is not currently accepting applications.',
      });
    }

    /* ----------------------------------------------------
     * Application is allowed → save + notify dealer
     * ---------------------------------------------------- */
    const app = new CarApplication({
      dealershipId,
      applicantEmail,
      btcAddress,
      btcHoldings,
      message,
    });

    await app.save();

    // Email dealer owner
    await sendDealerApplicationEmail({
      to: dealer.contactEmail,
      applicantEmail,
      btcAddress,
      btcHoldings,
      message,
      dealershipName: dealer.dealershipName,
    });

    return res
      .status(201)
      .json({ message: 'Application submitted successfully' });

  } catch (err) {
    console.error('❌ Error submitting car application:', err);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

export default router;
