import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header.js';

function Login() {
  const [identifier, setIdentifier] = useState(''); // <-- renamed from username
  const [password, setPassword] = useState('');
  const [btcPrice, setBtcPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Stripe activation banner state
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');

  const navigate = useNavigate();

  // --- Stripe: confirm Checkout Session if redirected with ?session_id=... ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

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
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
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
          identifier: identifier.trim(), // 👈 can be username or email
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
      <Header />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 72px)',
        }}
      >
        <div className="app-container">
          <div className="login-box">
            <h2 style={{ textAlign: 'center' }}>Login</h2>

            {/* Stripe activation banner */}
            {(activating || activationMsg) && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: '#eef6ff',
                  color: '#1e3a8a',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {activationMsg || 'Activating your subscription…'}
              </div>
            )}

            {/* BTC Price */}
            {btcPrice !== null && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#f3f4f6',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  textAlign: 'center',
                  fontWeight: '500',
                  color: '#1f2937',
                  fontSize: '1rem',
                }}
              >
                🪙 Current Bitcoin Price:{' '}
                <span style={{ fontWeight: 'bold' }}>
                  ${btcPrice.toLocaleString()}
                </span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

              <div className="input-group">
                <label htmlFor="identifier">Email or Username</label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p>
              Don't have an account? <Link to="/register">Sign Up</Link>
            </p>
          </div>

          {/* === Powered by UniSat section (centered below box) === */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              marginTop: '2rem',
              textAlign: 'center',
            }}
          >
            <a
              href="https://unisat.io/download"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#f7931a',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: '600',
                padding: '8px 16px',
                borderRadius: '6px',
                transition: 'background-color 0.3s ease',
                fontSize: '0.95rem',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = '#d67b00')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = '#f7931a')
              }
            >
              <img
                src={process.env.PUBLIC_URL + '/unisatlogo.jpg'}
                alt="UniSat Logo"
                style={{ height: '22px', width: 'auto' }}
              />
              <span>Powered by UniSat</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
