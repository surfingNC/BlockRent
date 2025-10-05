// src/pages/Subscribe.jsx
import React, { useEffect, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';

export default function Subscribe() {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const email = (localStorage.getItem('email') || '').toLowerCase();

  useEffect(() => {
    // Load catalog
    (async () => {
      try {
        const r = await fetch('/api/stripe/plans');
        if (!r.ok) throw new Error('plans not ok');
        const j = await r.json();
        setPlans(j);
      } catch (e) {
        setError('Failed to load plans.');
      } finally {
        setLoadingPlans(false);
      }
    })();

    // Load status
    if (email) {
      fetch(`/api/stripe/status?email=${encodeURIComponent(email)}`)
        .then(r => r.ok ? r.json() : { status: 'inactive' })
        .then(setStatus)
        .catch(() => setStatus({ status: 'inactive' }));
    }
  }, [email]);

  const handleSelect = async (planType) => {
    setError('');
    try {
      const r = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planType }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'Failed to create session');
      window.location.href = j.url;
    } catch (e) {
      setError(e.message || 'Failed to start checkout.');
    }
  };

  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>
          Choose a Subscription Plan
        </h2>

        {status?.status === 'active' && (
          <p style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
            ✅ Your current plan: {status.type} {status.validUntil ? `(until ${new Date(status.validUntil).toLocaleDateString()})` : '(lifetime)'}
          </p>
        )}

        {loadingPlans && <p style={{ textAlign: 'center' }}>Loading plans…</p>}
        {error && <p style={{ textAlign: 'center', color: '#b91c1c' }}>{error}</p>}

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {plans.map((p) => (
            <div key={p.type} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <h3 style={{ margin: 0 }}>{p.label}</h3>
              <p style={{ margin: '8px 0' }}>${(p.amountCents/100).toFixed(2)}</p>
              <p style={{ margin: '8px 0', color: '#6b7280' }}>
                {p.durationDays ? `${p.durationDays}-day access` : 'Lifetime access'}
              </p>
              <p style={{ margin: '8px 0', color: '#6b7280' }}>
                Listings: {p.listingCount}
              </p>
              <button
                onClick={() => handleSelect(p.type)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 0, cursor: 'pointer' }}
              >
                Continue
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
