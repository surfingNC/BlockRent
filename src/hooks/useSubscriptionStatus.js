// src/hooks/useSubscriptionStatus.js
import { useEffect, useState } from 'react';

const useSubscriptionStatus = (email, walletAddress) => {
  const [existingSub, setExistingSub] = useState(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const queryParam = walletAddress
      ? `walletAddress=${walletAddress}`
      : email
      ? `email=${email}`
      : null;

    if (!queryParam) return;

    fetch(`/api/payments/status?${queryParam}`)
      .then(res => res.json())
      .then(data => {
        setExistingSub(data);

        if (data?.validUntil) {
          const interval = setInterval(() => {
            const diff = new Date(data.validUntil) - new Date();
            if (diff <= 0) {
              clearInterval(interval);
              setCountdown('Expired');
            } else {
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
              const minutes = Math.floor((diff / (1000 * 60)) % 60);
              setCountdown(`${days}d ${hours}h ${minutes}m remaining`);
            }
          }, 60000);

          // Initialize countdown immediately without waiting 1 minute
          const initialDiff = new Date(data.validUntil) - new Date();
          if (initialDiff <= 0) {
            setCountdown('Expired');
          } else {
            const days = Math.floor(initialDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((initialDiff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((initialDiff / (1000 * 60)) % 60);
            setCountdown(`${days}d ${hours}h ${minutes}m remaining`);
          }

          return () => clearInterval(interval);
        }
      })
      .catch(err => console.error('Error fetching subscription status:', err));
  }, [walletAddress, email]);

  return { existingSub, countdown };
};

export default useSubscriptionStatus;
