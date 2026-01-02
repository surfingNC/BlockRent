import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
    <div className="app-container">
      <div className="login-box">
        <h2>Verify Your Email</h2>

        {email && (
          <p style={{ color: '#555' }}>
            Enter the 6-digit code sent to <strong>{email}</strong>.
          </p>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="code">6-digit Code</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              disabled={!email || submitting}
            />
          </div>
          <button type="submit" disabled={!email || submitting}>
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VerifyEmail;
