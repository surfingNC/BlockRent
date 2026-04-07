// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header.js';

function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [passwordTooShort, setPasswordTooShort] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();


  const handleRegister = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
      setPasswordTooShort(true);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordsMatch(false);
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          username: trimmedUsername,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('pendingVerifyEmail', normalizedEmail);
        alert('Verification code sent to your email.');
        navigate('/verify-email', { state: { email: normalizedEmail } });
      } else {
        localStorage.removeItem('pendingVerifyEmail');
        alert(data.msg || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      localStorage.removeItem('pendingVerifyEmail');
      alert('Error registering user');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordTooShort(value.length > 0 && value.length < 8);
    setPasswordsMatch(value === confirmPassword);
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setPasswordsMatch(password === value);
  };

  return (
    <div className="login-page">
      <div className="btc-particles">
        {[...Array(8)].map((_, i) => (
          <span key={i} className="btc-particle">₿</span>
        ))}
      </div>

      <Header />

      {/* Background system (same as login) */}
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

          {/* LEFT SIDE */}
          <div className="login-brand-panel">
            <div className="brand-badge">
              Bitcoin-Backed Real Estate
            </div>

            <h1 className="brand-title">
              Build your <span>Bitcoin identity</span>.
            </h1>

            <p className="brand-subtitle">
              BlockRent replaces outdated credit systems with Bitcoin-backed credibility and wallet-based identity.
            </p>

            <div className="brand-feature-list">
              <div className="brand-feature-card">
                <span className="brand-feature-icon">₿</span>
                <div>
                  <h4>Wallet Identity</h4>
                  <p>Use your Bitcoin wallet as proof of financial strength.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">🔐</span>
                <div>
                  <h4>Secure Registration</h4>
                  <p>Email verification and encrypted authentication.</p>
                </div>
              </div>

              <div className="brand-feature-card">
                <span className="brand-feature-icon">🏠</span>
                <div>
                  <h4>Access Properties</h4>
                  <p>Unlock listings and applications instantly.</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE (FORM) */}
          <div className="login-card">
            <div className="login-card-header">
              <div className="login-chip">New Account</div>
              <h2>Create account</h2>
              <p>Register to begin using BlockRent.</p>
            </div>

            <form onSubmit={handleRegister} className="login-form">

              <div className="modern-input-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="modern-input-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="modern-input-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  autoComplete="new-password"
                />
                {passwordTooShort && (
                  <div className="error-message">
                    Password must be at least 8 characters long
                  </div>
                )}
              </div>

              <div className="modern-input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                  autoComplete="new-password"
                  style={{
                    borderColor: !passwordsMatch ? '#ef4444' : '',
                  }}
                />
                {!passwordsMatch && (
                  <div className="error-message">
                    Passwords do not match
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={!passwordsMatch || passwordTooShort || submitting}
              >
                {submitting ? 'Sending code...' : 'Create Account'}
              </button>
            </form>

            <div className="login-footer-text">
              Already have an account? <Link to="/login">Login</Link>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default Register;