// src/hooks/useSubscriptionStatus.js
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function useSubscriptionStatus(walletAddress) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!walletAddress) return;
    axios
      .get(`/api/payments/status?walletAddress=${walletAddress}`)
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ active: false }));
  }, [walletAddress]);

  return status;
}
