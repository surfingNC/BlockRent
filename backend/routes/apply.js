// backend/routes/apply.js
import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import Listing from '../models/Listing.js';
import sendApplicationEmail from '../utils/sendApplicationEmail.js';

const router = express.Router();

router.post('/listings/apply', verifyToken, async (req, res) => {
  try {
    const { listingId, applicantName, walletAddress, balance, applicantEmail, messageText } = req.body;
    const listing = await Listing.findById(listingId);

    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const subject = `New Rental Application from ${applicantName}`;
    const message = `Hello ${listing.contactEmail},\n\nYou have received a new rental application through BlockRent:\n\nApplicant Name: ${applicantName}\nApplicant Email: ${applicantEmail}\nWallet Address: ${walletAddress}\nBitcoin Balance: ${balance} sats\n\nPersonal Message:\n${messageText}\n\nPlease review and follow up as needed.`;

    await sendApplicationEmail(listing.contactEmail, subject, message);

    res.json({ message: 'Application submitted successfully' });
  } catch (err) {
    console.error('❌ Error processing application:', err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

export default router;
