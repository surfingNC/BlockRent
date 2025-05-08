import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
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
        body: JSON.stringify({ username: trimmedUsername, password })
      });

      const data = await res.json();
      if (res.ok) {
        alert('Registration successful! Please log in.');
        navigate('/login');
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

  return (
    <div className="app-container">
      <div className="login-box">
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
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
      </div>
    </div>
  );
}

export default Register;
