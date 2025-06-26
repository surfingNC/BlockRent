// backend/utils/fetchBTCPrice.js
import axios from 'axios';

export async function fetchCurrentBTCPrice() {
  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );

    const price = res.data?.bitcoin?.usd;
    if (!price) throw new Error('No price found');

    return price;
  } catch (err) {
    console.error('❌ Failed to fetch BTC price:', err.message);
    return null;
  }
}
