import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { jwtDecode } from 'jwt-decode';

import Button from '../components/ui/Button';
import '../styles/Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [dealerStatus, setDealerStatus] = useState(null);
  const [justActivated, setJustActivated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return setLoading(false);

        const decoded = jwtDecode(token);
        const now = Math.floor(Date.now() / 1000);

        if (!decoded.exp || decoded.exp < now) {
          localStorage.clear();
          return setLoading(false);
        }

        const email = decoded.email?.toLowerCase();
        if (!email) return setLoading(false);

        if (localStorage.getItem('subscriptionJustActivated') === '1') {
          setJustActivated(true);
          localStorage.removeItem('subscriptionJustActivated');
          setTimeout(() => setJustActivated(false), 5000);
        }

        const [subRes, dealerRes] = await Promise.all([
          fetch(`/api/stripe/status?email=${encodeURIComponent(email)}`, { signal: controller.signal }),
          fetch(`/api/stripe/dealer-status?email=${encodeURIComponent(email)}`, { signal: controller.signal }),
        ]);

        setSubscription(await subRes.json());
        setDealerStatus(await dealerRes.json());

      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Dashboard init error:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => controller.abort();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return <div className="dashboard-loading">Loading Dashboard...</div>;
  }

  const getSubscriptionCTA = () =>
    subscription?.status === 'active' ? 'Manage Plan' : 'Subscribe';

  const renderSubBadge = () => {
    if (!subscription || subscription.status !== 'active') {
      return <div className="badge inactive">Inactive</div>;
    }

    const plan = (subscription.type || '').toUpperCase();
    const expiry = subscription.validUntil
      ? new Date(subscription.validUntil).toLocaleDateString()
      : 'lifetime';

    return <div className="badge active">{plan} • {expiry}</div>;
  };

  const renderDealerBadge = () => {
    const status = dealerStatus?.subscriptionStatus;
    const active = status === 'active' || status === 'trialing';

    return active
      ? <div className="badge active">Dealer Active</div>
      : <div className="badge inactive">Inactive</div>;
  };

  return (
    <div className="dashboard-page">

      <div className="btc-particles">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="btc-particle">₿</span>
        ))}
      </div>

      <div className="dashboard-glow dashboard-glow-1" />
      <div className="dashboard-glow dashboard-glow-2" />
      <div className="dashboard-grid-overlay" />

      <Header />

      <div className="dashboard-container">

        {justActivated && (
          <div className="activation-banner">
            🎉 Subscription activated
          </div>
        )}

        <div className="dashboard-grid">

          {/* REAL ESTATE */}
          <div className="glass-card">
            <div className="card-header">
              <h3>Real Estate</h3>
              {renderSubBadge()}
            </div>

            <div className="card-body">

              <Button onClick={() => navigate('/listings')}>
                Browse Listings
              </Button>

              <Button onClick={() => navigate('/subscribe')}>
                {getSubscriptionCTA()}
              </Button>

              <Button onClick={() => navigate('/list-your-home')}>
                List Property
              </Button>

              <Button onClick={() => navigate('/manage-listings')}>
                Manage Listings
              </Button>

            </div>
          </div>

          {/* AUTOMOTIVE */}
          <div className="glass-card">
            <div className="card-header">
              <h3>Automotive</h3>
              {renderDealerBadge()}
            </div>

            <div className="card-body">

              <Button onClick={() => navigate('/car-listings')}>
                Browse Dealers
              </Button>

              <Button onClick={() => navigate('/subscribe?tab=dealership')}>
                Subscribe
              </Button>

              <Button
                onClick={() => navigate('/list-your-dealership')}
                disabled={dealerStatus?.subscriptionStatus !== 'active'}
              >
                List Dealership
              </Button>

              <Button
                onClick={() => navigate('/dealer-dashboard')}
                disabled={dealerStatus?.subscriptionStatus !== 'active'}
              >
                Dealer Dashboard
              </Button>

            </div>
          </div>

        </div>

        <Button className="logout-btn" onClick={handleLogout}>
          Logout
        </Button>

      </div>
    </div>
  );
}

export default Dashboard;