import { useState, useEffect } from 'react';

const useHydratedEmail = () => {
  const [email, setEmail] = useState(null);
  const [emailReady, setEmailReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem('email');
      if (stored && stored !== 'null' && stored !== null) {
        console.log('📧 Hydrated email:', stored);
        setEmail(stored);
        setEmailReady(true);
        clearInterval(interval);
      } else {
        console.log('⏳ Waiting for email in localStorage...');
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return { email, emailReady };
};

export default useHydratedEmail;
