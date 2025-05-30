// src/pages/Login.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [btcPrice, setBtcPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBitcoinPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        setBtcPrice(data.bitcoin.usd);
      } catch (err) {
        console.error('Error fetching BTC price:', err);
      }
    };

    fetchBitcoinPrice();
    const interval = setInterval(fetchBitcoinPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const trimmedUsername = username.trim();

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard', { state: { username: data.username } });
      } else {
        setErrorMsg(data.msg || 'Login failed');
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error logging in');
    }
    setLoading(false);
  };

  return (
    <div className="app-container">
      <div className="login-box">
        <h2>Login</h2>

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
            <span style={{ fontWeight: 'bold' }}>${btcPrice.toLocaleString()}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
    </div>
  );
}

export default Login;
