// src/hooks/useBtcPrice.js
import { useState, useEffect } from 'react';

const useBtcPrice = () => {
  const [btcPrice, setBtcPrice] = useState(null);

  useEffect(() => {
    const fetchCachedPrice = async () => {
      const cached = localStorage.getItem('btc_price_cached');
      const timestamp = localStorage.getItem('btc_price_cached_at');
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      if (cached && timestamp && now - parseInt(timestamp, 10) < tenMinutes) {
        setBtcPrice(parseFloat(cached));
      } else {
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
          const data = await res.json();
          const price = data?.bitcoin?.usd;
          if (price) {
            setBtcPrice(price);
            localStorage.setItem('btc_price_cached', price.toString());
            localStorage.setItem('btc_price_cached_at', now.toString());
          }
        } catch (err) {
          console.error('Failed to fetch BTC price:', err);
        }
      }
    };

    fetchCachedPrice();
  }, []);

  return btcPrice;
};

export default useBtcPrice;
