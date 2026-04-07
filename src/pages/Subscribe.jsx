// src/pages/Subscribe.jsx
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import Header from '../components/Header';
import '../styles/Subscribe.css';

export default function Subscribe() {

  const location = useLocation();

  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'dealership' ? 'dealership' : 'real-estate';
  });

  const [plans, setPlans] = useState([]);
  const [stripeMode, setStripeMode] = useState('');
  const [error, setError] = useState('');

  const email = (localStorage.getItem('email') || '').toLowerCase().trim();

  // LOAD PLANS
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/stripe/plans');
        if (!r.ok) throw new Error('plans not ok');
        const j = await r.json();

        setPlans(Array.isArray(j.plans) ? j.plans : []);
        setStripeMode(j.mode || '');
      } catch (e) {
        setError('Failed to load plans.');
        setPlans([]);
        setStripeMode('');
      }
    })();
  }, []);

  const handleRealEstateCheckout = async (planType) => {
    try {
      const r = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planType }),
      });
      const j = await r.json();
      window.location.href = j.url;
    } catch {
      setError('Checkout failed.');
    }
  };

  const handleDealerCheckout = async (planType) => {
    try {
      const r = await fetch('/api/stripe/create-dealer-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planType }),
      });

      const j = await r.json();
      window.location.href = j.url;
    } catch {
      setError('Checkout failed.');
    }
  };

  return (
    <div className="dashboard-page">

      {/* BACKGROUND */}
      <div className="btc-particles">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="btc-particle">₿</span>
        ))}
      </div>

      <div className="dashboard-glow dashboard-glow-1" />
      <div className="dashboard-glow dashboard-glow-2" />
      <div className="dashboard-grid-overlay" />

      {/* HEADER */}
      <Header />

      <div className="dashboard-container">

        <h2 className="subscribe-title">
          Subscription Center {stripeMode && `(${stripeMode})`}
        </h2>

        {/* TABS */}
        <div className="subscribe-tabs">
          <button
            className={`subscribe-tab ${tab === 'real-estate' ? 'active' : ''}`}
            onClick={() => setTab('real-estate')}
          >
            Real Estate Agents
          </button>

          <button
            className={`subscribe-tab ${tab === 'dealership' ? 'active' : ''}`}
            onClick={() => setTab('dealership')}
          >
            Car Dealerships
          </button>
        </div>

        {error && <p className="subscribe-error">{error}</p>}

        {/* REAL ESTATE */}
        {tab === 'real-estate' && (
          <div className="subscribe-grid">
            {plans.map((p) => (
              <div key={p.type} className="subscribe-card glass-card">
                <h3>{p.label}</h3>

                <div className="price">
                  ${(Number(p.amountCents || 0) / 100).toFixed(2)}
                </div>

                <p>{p.validDays}-day access</p>
                <p>Listings: {p.listingCount}</p>

                <button
                  className="glass-btn"
                  onClick={() => handleRealEstateCheckout(p.type)}
                >
                  Continue
                </button>
              </div>
            ))}
          </div>
        )}

        {/* DEALERSHIP */}
        {tab === 'dealership' && (
          <div className="subscribe-grid">
            <div className="subscribe-card glass-card">
              <h3>Dealership Monthly</h3>
              <div className="price">$XX/mo</div>

              <button
                className="glass-btn"
                onClick={() => handleDealerCheckout('monthly')}
              >
                Subscribe Monthly
              </button>
            </div>

            <div className="subscribe-card glass-card highlight">
              <h3>Dealership Annual</h3>
              <div className="price">$YY/yr</div>

              <button
                className="glass-btn"
                onClick={() => handleDealerCheckout('annual')}
              >
                Subscribe Annual
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}