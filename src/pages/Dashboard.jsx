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

useEffect(() => {
  const token = localStorage.getItem('token');
  const email = localStorage.getItem('email');

  if (!token) {
    console.warn('⛔ No token found in localStorage');
    setLoading(false);
    return;
  }

  // 🔍 DEBUG: See what's inside the token
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('🔍 Raw decoded payload:', payload);
    console.log('🕒 Exp:', payload.exp, '| Now:', Math.floor(Date.now() / 1000));
  } catch (err) {
    console.error('❌ Manual decode failed:', err);
  }

  // ✅ Safe decode + validation
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

  // 🎟️ Check subscription
  if (email) {
    fetch(`/api/payments/status?email=${email}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('📦 Subscription:', data);
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
          {subscription?.status === 'active' ? (
            <div style={{
              fontSize: '14px',
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '8px 16px',
              borderRadius: '999px',
              marginBottom: '16px',
              display: 'inline-block'
            }}>
              ✅ {subscription.type.toUpperCase()} plan —{' '}
              {subscription.type === 'unlimited'
                ? `valid until ${new Date(subscription.validUntil).toLocaleDateString()}`
                : `${subscription.listingCount} listings remaining`}
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
