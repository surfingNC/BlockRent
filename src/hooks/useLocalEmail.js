// src/hooks/useLocalEmail.js
import { useState, useEffect } from 'react';

export default function useLocalEmail() {
  const [email, setEmail] = useState(localStorage.getItem('email') || '');

  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem('email');
      if (stored && stored !== email) {
        setEmail(stored);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [email]);

  return email;
}
