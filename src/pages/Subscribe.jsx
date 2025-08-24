// src/pages/Subscribe.jsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import PromoCodeForm from '../components/PromoCodeForm';
import SubscriptionPlanCard from '../components/SubscriptionPlanCard';
import PaymentQRCode from '../components/PaymentQRCode';
import useHydratedEmail from '../hooks/useHydratedEmail';
import CurrentPlanInfo from '../components/CurrentPlanInfo';
import useBtcPrice from '../hooks/useBtcPrice';
import useSubscriptionStatus from '../hooks/useSubscriptionStatus';
import { waitForEmailAndStartListener, stopActiveBtcListener } from '../hooks/startBtcPaymentListener';

import '../styles/index.css';

const BTC_RECEIVE_ADDRESS = process.env.REACT_APP_BTC_RECEIVE_ADDRESS;
console.log('🎯 BTC_RECEIVE_ADDRESS (in component):', BTC_RECEIVE_ADDRESS);

const Subscribe = () => {
  const [sessionId, setSessionId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [listening, setListening] = useState(false);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [pendingTxDetected, setPendingTxDetected] = useState(false);

  // keep a handle so we can stop the hydrator interval when switching plans
  const hydratorStopRef = useRef(null);

  // Fresh reads (wallet can be optional)
  const walletAddress = localStorage.getItem('walletAddress') || null;

  // Hydrated email (still useful for UI + status calls)
  const { email, emailReady } = useHydratedEmail();

  // Close WS + hydrator on unmount
  useEffect(() => {
    return () => {
      try { hydratorStopRef.current?.(); } catch {}
      stopActiveBtcListener();
    };
  }, []);

  // 🔁 Start the BTC WebSocket listener when ready (email optional; backend can fallback)
  useEffect(() => {
    if (!sessionId) return;
    if (!BTC_RECEIVE_ADDRESS) return;
    if (listening) return; // prevents duplicate sockets

    const expectedSats = selected?.sats ?? null;
    const sessionStartTime = Date.now();

    const stopHydrator = waitForEmailAndStartListener({
      sessionId,
      receiveAddress: BTC_RECEIVE_ADDRESS,
      setListening,
      setPendingTxDetected,
      expectedSats,
      sessionStartTime,
      email, // may be null; backend will fallback if needed
      walletAddress,
    });
    hydratorStopRef.current = stopHydrator;

    // stop the polling interval if we unmount or deps change
    return () => {
      try { stopHydrator?.(); } finally { hydratorStopRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, selected, listening]);

  // ▶️ User selects a plan → start (or restart) a payment session
  const handlePlanSelect = async (plan) => {
    // 🔄 cancel any previous flow so we can start a fresh session
    try { hydratorStopRef.current?.(); } catch {}
    try { stopActiveBtcListener(); } catch {}
    setListening(false);
    setPendingTxDetected(false);
    setSelected(null);
    setSessionId(null);
    localStorage.removeItem('lastSessionId');

    const actualEmail = localStorage.getItem('email') || null;
    console.log('🔁 Submitting session start with:', actualEmail || '(none — backend fallback)');

    try {
      const res = await fetch('/api/payments/start-payment-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: actualEmail, planType: plan.type }),
      });

      const data = await res.json();

      if (res.ok && data.sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('lastSessionId', data.sessionId);
        setSelected(plan);
        console.log('🆔 Session started:', data.sessionId);

        // ✅ Safety net: immediately try to link any recent tx to this session
        fetch('/api/payments/verify-latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: data.sessionId,
            expectedSats: undefined, // optional but helpful
            windowSec: 3600,           // look back 60 minutes
          }),
        })
          .then((r) => r.json())
          .then((j) => console.log('🔎 verify-latest result:', j))
          .catch((e) => console.warn('verify-latest failed:', e));
      } else {
        console.error('❌ Failed to start session:', data?.error || data);
      }
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  };

  // Load subscription tiers
  useEffect(() => {
    fetch('/api/payments/tiers')
      .then((res) => res.json())
      .then((data) => setSubscriptionTiers(data))
      .catch((err) => console.error('Failed to fetch tiers:', err));
  }, []);

  const btcPrice = useBtcPrice();
  const { existingSub, countdown } = useSubscriptionStatus(email, walletAddress);

  // Expire listening session after 10 minutes
  useEffect(() => {
    if (!listening) return;

    const timeout = setTimeout(() => {
      setListening(false);
      alert('⚠️ Payment session expired. Please start a new subscription.');
      window.location.href = '/dashboard';
    }, 600000); // 10 minutes

    return () => clearTimeout(timeout);
  }, [listening]);

  const formatUsd = (sats) => {
    if (!btcPrice) return '(~$...)';
    const usd = (sats / 100000000) * btcPrice;
    return `(~$${usd.toFixed(2)})`;
  };

  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>
          Choose a Subscription Plan
        </h2>

        <PromoCodeForm />

        <CurrentPlanInfo existingSub={existingSub} countdown={countdown} />

        {emailReady ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'center',
              marginBottom: '2rem',
            }}
          >
            {subscriptionTiers.map((plan) => (
              <SubscriptionPlanCard
                key={plan.type}
                plan={plan}
                selected={selected}
                onSelect={handlePlanSelect}
                formatUsd={formatUsd}
              />
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#888' }}>⏳ Loading email…</p>
        )}

        <PaymentQRCode
          selected={selected}
          listening={listening}
          pendingTxDetected={pendingTxDetected}
          btcAddress={BTC_RECEIVE_ADDRESS}
        />

        {pendingTxDetected && (
          <p style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
            ✅ Pending transaction detected. Awaiting confirmation...
          </p>
        )}
      </div>
    </div>
  );
};

export default Subscribe;
