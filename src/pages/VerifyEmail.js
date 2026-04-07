import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header.js';

function VerifyEmail() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const emailFromState = location.state?.email || '';
  const emailFromStorage = localStorage.getItem('pendingVerifyEmail') || '';

  const email = useMemo(
    () => (emailFromState || emailFromStorage).trim().toLowerCase(),
    [emailFromState, emailFromStorage]
  );

  useEffect(() => {
    if (emailFromState) {
      localStorage.setItem('pendingVerifyEmail', emailFromState.trim().toLowerCase());
    }
  }, [emailFromState]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Missing email. Please register again.');
      return;
    }

    const c = code.trim();
    if (!/^\d{6}$/.test(c)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch('http://localhost:5000/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: c }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.removeItem('pendingVerifyEmail');
        alert('Email verified successfully. Please log in.');
        navigate('/login');
      } else {
        setError(data.msg || 'Invalid or expired code');
      }
    } catch (err) {
      console.error(err);
      setError('Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Header />

      {/* Background system */}
      <div
        className="login-bg-image"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL + '/backgroundFiller.PNG'})`,
        }}
      />
      <div className="login-grid-overlay" />
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <div className="login-main">
        <div className="login-shell">

          {/* LEFT PANEL */}
          <div className="login-brand-panel">
            <div className="brand-badge">
              Email Verification
            </div>

            <h1 className="brand-title">
              Confirm your <span>identity</span>.
            </h1>

            <p className="brand-subtitle">
              We’ve sent a secure 6-digit verification code to your email. Enter it to activate your account.
            </p>

            <div className="brand-feature-list">
              <div className="brand-feature-card">
                <span className="brand-feature-icon">📩</span>
                <div>
                  <h4>Secure Delivery</h4>
                  <p>Verification codes are sent instantly to your email.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">🔐</span>
                <div>
                  <h4>Protected Access</h4>
                  <p>Ensures only you can activate your account.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">⚡</span>
                <div>
                  <h4>Fast Activation</h4>
                  <p>Complete setup and access your dashboard instantly.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="login-card">
            <div className="login-card-header">
              <div className="login-chip">Verification</div>
              <h2>Enter code</h2>
              <p>
                {email
                  ? `Code sent to ${email}`
                  : 'Enter your verification code'}
              </p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit} className="login-form">

              <div className="modern-input-group">
                <label>6-digit Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  disabled={!email || submitting}
                  style={{
                    letterSpacing: '6px',
                    textAlign: 'center',
                    fontSize: '1.2rem',
                  }}
                />
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={!email || submitting}
              >
                {submitting ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>

            <div className="login-footer-text">
              Wrong email? <Link to="/register">Register again</Link>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;