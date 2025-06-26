// backend/routes/lease.js
import { fetchCurrentBTCPrice } from '../utils/fetchBTCPrice.js';

router.post('/new', verifyToken, async (req, res) => {
  try {
    const { tenantName, creditScore, monthlyRentUSD, leaseStart, leaseEnd } = req.body;

    const btcUsdRate = await fetchCurrentBTCPrice();
    if (!btcUsdRate) return res.status(500).json({ error: 'Failed to fetch BTC price' });

    // Calculate months & BTC required
    let monthsRequired;
    if (creditScore >= 750) monthsRequired = 1.5;
    else if (creditScore >= 700) monthsRequired = 2;
    else if (creditScore >= 650) monthsRequired = 3;
    else if (creditScore >= 600) monthsRequired = 4;
    else monthsRequired = 6;

    const totalUSD = monthsRequired * monthlyRentUSD;
    const btcCollateralRequired = parseFloat((totalUSD / btcUsdRate).toFixed(6));

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
