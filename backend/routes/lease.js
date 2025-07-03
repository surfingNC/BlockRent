// backend\routes\lease.js
import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import Lease from '../models/Lease.js';
import { fetchCurrentBTCPrice } from '../utils/fetchBTCPrice.js';

const router = express.Router();

/**
 * @route   GET /api/lease/btc-price
 * @desc    Fetch current BTC price from CoinGecko
 * @access  Public
 */
router.get('/btc-price', async (req, res) => {
  try {
    const price = await fetchCurrentBTCPrice();
    res.json({ price });
  } catch (err) {
    console.error('❌ BTC price fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch BTC price' });
  }
});

/**
 * @route   POST /api/lease/new
 * @desc    Create a new lease with BTC collateral calculation
 * @access  Private (JWT required)
 */
router.post('/new', verifyToken, async (req, res) => {
  try {
    const { tenantName, creditScore, monthlyRentUSD, leaseStart, leaseEnd } = req.body;

    // Fetch current BTC/USD rate
    const btcUsdRate = await fetchCurrentBTCPrice();
    if (!btcUsdRate) return res.status(500).json({ error: 'Failed to fetch BTC price' });

    // Determine months of collateral based on credit score
    let monthsRequired;
    if (creditScore >= 750) monthsRequired = 1.5;
    else if (creditScore >= 700) monthsRequired = 2;
    else if (creditScore >= 650) monthsRequired = 3;
    else if (creditScore >= 600) monthsRequired = 4;
    else monthsRequired = 6;

    // Calculate BTC collateral amount
    const totalUSD = monthsRequired * monthlyRentUSD;
    const btcCollateralRequired = parseFloat((totalUSD / btcUsdRate).toFixed(6));

    // Create and save lease document
    const lease = new Lease({
      tenantName,
      creditScore,
      monthlyRentUSD,
      leaseStart,
      leaseEnd,
      btcUsdRate,
      collateralMonths: monthsRequired,
      btcCollateralRequired,
      userId: req.user.userId,
    });

    await lease.save();
    res.json({ success: true, lease });
  } catch (err) {
    console.error('❌ Lease creation error:', err);
    res.status(500).json({ error: 'Could not create lease' });
  }
});

export default router;
