// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/index.css';

function Dashboard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const walletAddress = sessionStorage.getItem('walletAddress');

    if (!token) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/api/protected/dashboard`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setAuthorized(true);
        setLoading(false);
      })
      .catch(() => {
        sessionStorage.clear();
        setAuthorized(false);
        setLoading(false);
      });

    if (walletAddress) {
      fetch(`/api/payments/status?walletAddress=${walletAddress}`)
        .then(res => res.json())
        .then(data => setSubscription(data))
        .catch(err => console.error('Failed to load subscription:', err));
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;
  if (!authorized) return <Navigate to="/login" replace />;

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
      {/* Full-width header like Listings page */}
      <Header />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem',
        }}
      >
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
            cursor: 'pointer'
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
            maxWidth: '400px',
            textAlign: 'center'
          }}
        >
          {subscription && subscription.active ? (
            <div style={{
              fontSize: '14px',
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '8px 16px',
              borderRadius: '999px',
              marginBottom: '16px',
              display: 'inline-block'
            }}>
              ✅ {subscription.type.toUpperCase()} plan &nbsp;
              {subscription.type === 'unlimited'
                ? `valid until ${new Date(subscription.validUntil).toLocaleDateString()}`
                : subscription.listingCount > 0
                  ? `${subscription.listingCount} listings remaining`
                  : `expired`}
            </div>
          ) : (
            <div style={{
              fontSize: '14px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '8px 16px',
              borderRadius: '999px',
              marginBottom: '16px',
              display: 'inline-block'
            }}>
              ❌ No active subscription
            </div>
          )}

          <button onClick={() => navigate('/subscribe')} style={btnStyle}>📬 Renew Now</button>
          <button onClick={() => navigate('/list-your-home')} style={btnStyle}>🏠 List Your Home</button>
          <button onClick={handleLogout} style={btnStyle}>🔓 Logout</button>
        </div>
      </div>
    </div>
  );
}

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
  width: '100%'
};

export default Dashboard;
