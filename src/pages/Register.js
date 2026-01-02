// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        // Persist email so VerifyEmail survives refresh
        localStorage.setItem('pendingVerifyEmail', normalizedEmail);

        alert('Verification code sent to your email.');
        navigate('/verify-email', { state: { email: normalizedEmail } });
      } else {
        // Don't keep stale pending email on failures
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
            <h2 style={{ textAlign: 'center' }}>Register</h2>

            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  autoComplete="new-password"
                />
                {passwordTooShort && (
                  <p style={{ color: 'red', fontSize: '0.9em', marginTop: '5px' }}>
                    Password must be at least 8 characters long
                  </p>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                  autoComplete="new-password"
                  style={{
                    borderColor: !passwordsMatch ? 'red' : '',
                    borderWidth: !passwordsMatch ? '2px' : '',
                  }}
                />
                {!passwordsMatch && (
                  <p style={{ color: 'red', fontSize: '0.9em', marginTop: '5px' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              <button type="submit" disabled={!passwordsMatch || passwordTooShort || submitting}>
                {submitting ? 'Sending code...' : 'Sign Up'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
