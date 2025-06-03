import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function VerifyEmail() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const username = location.state?.username;
  const password = location.state?.password;


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Missing email. Please register again.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Email verified successfully. Please log in.');
        navigate('/login');
      } else {
        setError(data.msg || 'Invalid code');
      }
    } catch (err) {
      console.error(err);
      setError('Verification failed. Try again.');
    }
  };

  return (
    <div className="app-container">
      <div className="login-box">
        <h2>Verify Your Email</h2>
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
              pattern="\d{6}"
              maxLength={6}
            />
          </div>
          <button type="submit">Verify</button>
        </form>
      </div>
    </div>
  );
}

export default VerifyEmail;
