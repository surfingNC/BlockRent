// src/pages/Subscribe.jsx
import React, { useEffect, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';

export default function Subscribe() {
  const [tab, setTab] = useState("real-estate"); // NEW — two tabs

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState('');

  // Real estate status
  const [reStatus, setReStatus] = useState(null);

  // Dealership status
  const [dealerStatus, setDealerStatus] = useState(null);

  const email = (localStorage.getItem('email') || '').toLowerCase();

  // ---------------------------------------------------------
  // LOAD REAL ESTATE PLANS + STATUS
  // ---------------------------------------------------------
  useEffect(() => {
    // Load real estate plans
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

    // Load real estate status
    if (email) {
      fetch(`/api/stripe/status?email=${encodeURIComponent(email)}`)
        .then(r => r.ok ? r.json() : { status: 'inactive' })
        .then(setReStatus)
        .catch(() => setReStatus({ status: 'inactive' }));
    }
  }, [email]);

  // ---------------------------------------------------------
  // LOAD DEALERSHIP STATUS
  // ---------------------------------------------------------
  useEffect(() => {
    if (!email) return;

    fetch(`/api/stripe/dealer-status?email=${encodeURIComponent(email)}`)
      .then(r => r.ok ? r.json() : { status: 'inactive' })
      .then(setDealerStatus)
      .catch(() => setDealerStatus({ status: 'inactive' }));
  }, [email]);

  // ---------------------------------------------------------
  // START REAL ESTATE CHECKOUT SESSION
  // ---------------------------------------------------------
  const handleRealEstateCheckout = async (planType) => {
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

  // ---------------------------------------------------------
  // START DEALERSHIP CHECKOUT SESSION
  // ---------------------------------------------------------
  const handleDealerCheckout = async (planType) => {
    setError('');
    try {
      const r = await fetch('/api/stripe/create-dealer-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planType }),
      });

      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'Failed to create subscription');
      window.location.href = j.url;
    } catch (e) {
      setError(e.message || 'Failed to start dealership checkout.');
    }
  };

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>

        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>
          Subscription Center
        </h2>

        {/* ---------------------------- */}
        {/* TABS                        */}
        {/* ---------------------------- */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setTab("real-estate")}
            style={{
              padding: '0.5rem 1rem',
              borderBottom: tab === "real-estate" ? '3px solid #3b82f6' : '3px solid transparent',
              fontWeight: tab === "real-estate" ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            Real Estate Agents
          </button>

          <button
            onClick={() => setTab("dealership")}
            style={{
              padding: '0.5rem 1rem',
              borderBottom: tab === "dealership" ? '3px solid #3b82f6' : '3px solid transparent',
              fontWeight: tab === "dealership" ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            Car Dealerships
          </button>
        </div>

        {error && (
          <p style={{ textAlign: 'center', color: '#b91c1c', marginBottom: 16 }}>{error}</p>
        )}

        {/* ---------------------------- */}
        {/* REAL ESTATE TAB             */}
        {/* ---------------------------- */}
        {tab === "real-estate" && (
          <div>
            {reStatus?.status === 'active' && (
              <p style={{ textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                ✅ Current plan: {reStatus.type}{" "}
                {reStatus.validUntil
                  ? `(until ${new Date(reStatus.validUntil).toLocaleDateString()})`
                  : "(lifetime)"}
              </p>
            )}

            {loadingPlans && <p style={{ textAlign: 'center' }}>Loading plans…</p>}

            <div style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginTop: '1rem'
            }}>
              {plans.map((p) => (
                <div key={p.type} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 16
                }}>
                  <h3>{p.label}</h3>
                  <p>${(p.amountCents / 100).toFixed(2)}</p>
                  <p style={{ color: '#6b7280' }}>
                    {p.durationDays ? `${p.durationDays}-day access` : 'Lifetime access'}
                  </p>
                  <p style={{ color: '#6b7280' }}>
                    Listings: {p.listingCount}
                  </p>

                  <button
                    onClick={() => handleRealEstateCheckout(p.type)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#3b82f6',
                      color: 'white',
                      border: 0,
                      cursor: 'pointer',
                      marginTop: '1rem'
                    }}
                  >
                    Continue
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------- */}
        {/* DEALERSHIP TAB              */}
        {/* ---------------------------- */}
        {tab === "dealership" && (
          <div>

            {/* Dealer status */}
            {dealerStatus && (
              <p style={{
                textAlign: 'center',
                marginBottom: '1rem',
                fontWeight: 600,
                color:
                  dealerStatus.status === 'active' ? '#16a34a'
                    : dealerStatus.status === 'past_due' ? '#d97706'
                    : '#b91c1c'
              }}>
                {dealerStatus.status === 'active' && "✅ Active dealership subscription"}
                {dealerStatus.status === 'past_due' && "⚠️ Payment past due"}
                {dealerStatus.status === 'expired' && "⛔ Subscription expired"}
                {dealerStatus.status === 'inactive' && "No active dealership subscription"}
              </p>
            )}

            {/* Two pricing cards */}
            <div style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
            }}>
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16
              }}>
                <h3>Dealership Monthly</h3>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>$XX/mo</p>
                <p style={{ color: '#6b7280' }}>Ideal for small lots or testing BlockLease.</p>

                <button
                  onClick={() => handleDealerCheckout('dealership_monthly')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#3b82f6',
                    color: 'white',
                    border: 0,
                    cursor: 'pointer',
                    marginTop: '1rem'
                  }}
                >
                  Subscribe Monthly
                </button>
              </div>

              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16
              }}>
                <h3>Dealership Annual</h3>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>$YY/yr</p>
                <p style={{ color: '#6b7280' }}>Best for established dealerships.</p>

                <button
                  onClick={() => handleDealerCheckout('dealership_annual')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#3b82f6',
                    color: 'white',
                    border: 0,
                    cursor: 'pointer',
                    marginTop: '1rem'
                  }}
                >
                  Subscribe Annual
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
