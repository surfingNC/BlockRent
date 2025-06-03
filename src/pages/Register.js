import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (password !== confirmPassword) {
      setPasswordsMatch(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: trimmedUsername, password })
      });

      const data = await res.json();
      if (res.ok) {
        alert('Verification code sent to your email.');
        navigate('/verify-email', {
          state: {
            email,
            username: trimmedUsername,
            password
          }
        });
      } else {
        alert(data.msg || 'Registration failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error registering user');
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setPasswordsMatch(password === value);
  };

  const handleResetDatabase = async () => {
    if (window.confirm('Are you sure you want to reset the database?')) {
      try {
        const res = await fetch('http://localhost:5000/api/auth/reset', {
          method: 'POST'
        });
        const data = await res.json();
        alert(data.msg || 'Database reset');
      } catch (err) {
        console.error(err);
        alert('Error resetting database');
      }
    }
  };

  return (
    <div className="app-container">
      <div className="login-box">
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              style={{
                borderColor: !passwordsMatch ? 'red' : '',
                borderWidth: !passwordsMatch ? '2px' : ''
              }}
            />
            {!passwordsMatch && (
              <p style={{ color: 'red', fontSize: '0.9em', marginTop: '5px' }}>
                Passwords do not match
              </p>
            )}
          </div>
          <button type="submit" disabled={!passwordsMatch}>Sign Up</button>
        </form>

        <button
          type="button"
          style={{
            marginTop: '1rem',
            backgroundColor: '#cc0000',
            color: '#fff',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={handleResetDatabase}
        >
          🔄 Reset Dev DB
        </button>
      </div>
    </div>
  );
}

export default Register;
