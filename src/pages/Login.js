import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header.js';

function Login() {
  const tutorialUrl = 'https://www.youtube.com/watch?v=aXkDFB2oFdE';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [btcPrice, setBtcPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Stripe activation banner state
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');

  const navigate = useNavigate();
  // 🔒 AUTH GUARD — DO NOT REMOVE
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);

      if (decoded.exp && decoded.exp > now) {
        navigate('/dashboard', { replace: true });
      } else {
        localStorage.clear();
      }
    } catch {
      localStorage.clear();
    }
  }, [navigate]);

  // --- Stripe: confirm REAL ESTATE Checkout Session ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    // 🚫 Do NOT confirm dealership subscriptions
    const forDealership = params.get('for') === 'dealership';
    if (forDealership) return;

    // Only real estate checkout sessions call /confirm
    if (!sessionId) return;

    (async () => {
      setActivating(true);
      setActivationMsg('Activating your subscription…');

      try {
        const res = await fetch(
          `/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();

        if (res.ok && data.ok) {
          setActivationMsg('✅ Subscription activated! You can now log in.');
          localStorage.setItem('subscriptionJustActivated', '1');
        } else {
          setActivationMsg(
            `⚠️ Could not finalize payment (${data?.error || 'unknown error'}).`
          );
        }
      } catch (e) {
        console.error('confirm failed', e);
        setActivationMsg('⚠️ Network error while confirming payment.');
      } finally {
        setActivating(false);

        // Clean the URL
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        url.searchParams.delete('for');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    })();
  }, []);

  // --- Fetch BTC price ---
  useEffect(() => {
    const fetchBitcoinPrice = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        );
        const data = await res.json();
        setBtcPrice(data.bitcoin.usd);
        console.log('🪙 BTC price fetched:', data.bitcoin.usd);
      } catch (err) {
        console.error('Error fetching BTC price:', err);
      }
    };

    fetchBitcoinPrice();
    const interval = setInterval(fetchBitcoinPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- Handle login submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const data = await res.json();
      console.log('📨 Login response:', data);

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('email', data.email || '');
        localStorage.setItem('isAuthenticated', 'true');

        console.log('✅ Token saved:', localStorage.getItem('token'));
        console.log('✅ Email stored:', localStorage.getItem('email'));

        navigate('/dashboard');
      } else {
        setErrorMsg(data.msg || 'Login failed');
        setPassword('');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setErrorMsg('Server error during login');
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      
      <div className="btc-particles">
        {[...Array(8)].map((_, i) => (
          <span key={i} className="btc-particle">₿</span>
        ))}
      </div>

      {/* Optional existing background image overlay preserved but subdued */}
      <div
        className="login-bg-image"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL + '/backgroundFiller.PNG'})`,
        }}
      />

      {/* Animated glow layers (UniSat-inspired) */}
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />
      <div className="login-grid-overlay" />

      <Header showTagline={true} />

      <div className="login-main">
        <div className="login-shell">
          {/* LEFT SIDE BRAND PANEL */}
          <div className="login-brand-panel">
            <div className="brand-badge">Bitcoin-Backed Real Estate</div>

            <h1 className="brand-title">
              Secure property access,
              <span> powered by Bitcoin.</span>
            </h1>

            <p className="brand-subtitle">
              BlockRent blends modern property access with Bitcoin-native identity,
              wallet verification, and subscription infrastructure.
            </p>

            <div className="brand-feature-list">
              <div className="brand-feature-card">
                <span className="brand-feature-icon">₿</span>
                <div>
                  <h4>Live BTC Pricing</h4>
                  <p>Real-time Bitcoin market pricing for lease intelligence.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">🔐</span>
                <div>
                  <h4>Secure Auth</h4>
                  <p>JWT login, email verification, and wallet-linked identity.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">🏠</span>
                <div>
                  <h4>Property Workflow</h4>
                  <p>Built for listings, tenant applications, and Bitcoin-native access.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE LOGIN CARD */}
          <div className="login-card">
            <div className="login-card-header">
              <div className="login-chip">BlockRent Access</div>
              <h2>Welcome back</h2>
              <p>Sign in with your email or username to access your dashboard.</p>
            </div>

            {/* Stripe activation banner */}
            {(activating || activationMsg) && (
              <div className="activation-banner">
                {activationMsg || 'Activating your subscription…'}
              </div>
            )}

            {/* BTC Price */}
            {btcPrice !== null && (
              <div className="btc-card">
                <div className="btc-label">🪙 Current Bitcoin Price</div>
                <div className="btc-price">${btcPrice.toLocaleString()}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="login-form">
              {errorMsg && <p className="error-message">{errorMsg}</p>}

              <div className="input-group modern-input-group">
                <label htmlFor="identifier">Email or Username</label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="Enter email or username"
                />
              </div>

              <div className="input-group modern-input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                />
              </div>

              <button type="submit" disabled={loading} className="login-btn">
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p className="login-footer-text">
              Don&apos;t have an account? <Link to="/register">Sign Up</Link>
            </p>

            {/* Powered by UniSat */}
            <div className="unisat-section">
              <a
                href="https://unisat.io/download"
                target="_blank"
                rel="noopener noreferrer"
                className="unisat-btn"
              >
                <img
                  src={process.env.PUBLIC_URL + '/unisatlogo.jpg'}
                  alt="UniSat Logo"
                  className="unisat-logo"
                />
                <span>Powered by UniSat</span>
              </a>
            </div>

            {/* Tutorial link */}
            <div className="tutorial-section">
              <a
                href={tutorialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tutorial-link"
              >
                Watch the quick tutorial (YouTube)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;