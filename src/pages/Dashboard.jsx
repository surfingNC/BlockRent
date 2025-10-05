// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import '../styles/index.css';
import { jwtDecode } from 'jwt-decode';

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [justActivated, setJustActivated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const email = (localStorage.getItem('email') || '').trim().toLowerCase();

    if (!token) {
      console.warn('⛔ No token found in localStorage');
      setLoading(false);
      return;
    }

    // Debug token safely
    try {
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      if (!decoded.exp || decoded.exp < now) {
        console.warn('🔒 Token expired:', decoded);
        localStorage.clear();
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('❌ Failed to decode token:', err);
      localStorage.clear();
      setLoading(false);
      return;
    }

    // One-time banner if we just confirmed via Stripe
    if (localStorage.getItem('subscriptionJustActivated') === '1') {
      setJustActivated(true);
      localStorage.removeItem('subscriptionJustActivated');
      setTimeout(() => setJustActivated(false), 6000);
    }

    // 🎟️ Check subscription from Stripe-backed endpoint
    if (email) {
      fetch(`/api/stripe/status?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((data) => {
          console.log('📦 Stripe subscription status:', data);
          setSubscription(data);
        })
        .catch((err) => console.error('⚠️ Subscription fetch failed:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) return <div>Loading Dashboard...</div>;

  // Helpers
  const renderSubBadge = () => {
    if (!subscription || subscription.status !== 'active') {
      return (
        <div style={pill({ bg: '#fee2e2', color: '#991b1b' })}>
          ❌ No active subscription
        </div>
      );
    }

    const plan = (subscription.type || '').toUpperCase();
    const hasExpiry = Boolean(subscription.validUntil);
    const dateStr = hasExpiry
      ? new Date(subscription.validUntil).toLocaleString()
      : 'lifetime';

    return (
      <div style={pill({ bg: '#dcfce7', color: '#166534' })}>
        ✅ {plan} plan — {hasExpiry ? `valid until ${dateStr}` : 'lifetime access'}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL + '/backgroundFiller.PNG'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem',
        }}
      >
        {justActivated && (
          <div
            style={{
              marginTop: '1rem',
              marginBottom: '1rem',
              padding: '10px 16px',
              background: '#eef6ff',
              color: '#1e3a8a',
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            🎉 Subscription activated! Welcome back.
          </div>
        )}

        <button
          onClick={() => navigate('/listings')}
          style={{
            backgroundColor: '#f7931a',
            color: 'white',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            marginTop: '2.5rem',
            marginBottom: '2rem',
            cursor: 'pointer',
          }}
        >
          Browse Listings
        </button>

        <div
          style={{
            backgroundColor: '#ffffffee',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '420px',
            textAlign: 'center',
          }}
        >
          {renderSubBadge()}

          {/* Optional: show listing count if your backend sends it */}
          {subscription?.status === 'active' && (
            <div style={{ marginBottom: 12, color: '#334155' }}>
              {subscription.listingCount == null
                ? 'Listings: Unlimited'
                : `Listings remaining: ${subscription.listingCount}`}
            </div>
          )}

          <button onClick={() => navigate('/subscribe')} style={btnStyle}>
            📬 {subscription?.status === 'active' ? 'Manage / Renew' : 'Subscribe'}
          </button>
          <button onClick={() => navigate('/list-your-home')} style={btnStyle}>
            🏠 List Your Home
          </button>
          <button onClick={handleLogout} style={btnStyle}>
            🔓 Logout
          </button>
        </div>
      </div>
    </div>
  );
}

const pill = ({ bg, color }) => ({
  fontSize: '14px',
  backgroundColor: bg,
  color,
  padding: '8px 16px',
  borderRadius: '999px',
  marginBottom: '16px',
  display: 'inline-block',
});

const btnStyle = {
  backgroundColor: '#f7931a',
  color: 'white',
  padding: '10px 18px',
  marginTop: '12px',
  border: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
};

export default Dashboard;
