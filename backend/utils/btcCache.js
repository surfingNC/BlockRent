import { fetchCurrentBTCPrice } from './fetchBTCPrice.js';

let cachedPrice = null;
let lastFetched = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedBTCPrice() {
  const now = Date.now();

  if (!cachedPrice || now - lastFetched > CACHE_DURATION_MS) {
    console.log('🔄 Refreshing cached BTC price...');
    const newPrice = await fetchCurrentBTCPrice();
    if (newPrice) {
      cachedPrice = newPrice;
      lastFetched = now;
    }
  } else {
    console.log('💾 Using cached BTC price');
  }

  return cachedPrice;
}
