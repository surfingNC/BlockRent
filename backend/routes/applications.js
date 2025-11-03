import express from 'express';
import CarApplication from '../models/CarApplication.js';
import Dealer from '../models/Dealer.js';
import { sendDealerApplicationEmail } from '../utils/sendDealerApplicationEmail.js';

const router = express.Router();

// Dealership application
// ✅ Submit Bitcoin-based lease application
router.post('/submit', async (req, res) => {
  try {
    const { dealershipId, applicantEmail, btcAddress, btcHoldings, message } = req.body;

    if (!dealershipId || !applicantEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dealer = await Dealer.findById(dealershipId);
    if (!dealer || !dealer.acceptingApplications) {
      return res.status(400).json({ error: 'Dealer not accepting applications' });
    }

    // Create a new car application record
    const app = new CarApplication({
      dealershipId,
      applicantEmail,
      btcAddress,
      btcHoldings,
      message,
    });

    await app.save();

    // Send email notification to the dealership
    await sendDealerApplicationEmail({
      to: dealer.contactEmail,
      applicantEmail,
      btcAddress,
      btcHoldings,
      message,
      dealershipName: dealer.dealershipName,
    });

    res.status(201).json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error('❌ Error submitting car application:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

export default router;
