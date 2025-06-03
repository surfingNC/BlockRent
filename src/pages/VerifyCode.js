import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function VerifyCode() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/auth/verify-email/verify', {

      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, username, password }),
    });

    const data = await res.json();
    if (res.ok) {
      setMsg('Verification successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setMsg(data.msg || 'Verification failed');
    }
  };

  return (
    <div className="app-container">
      <div className="login-box">
        <h2>Verify Your Email</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input placeholder="Verification Code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Verify</button>
        </form>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}

export default VerifyCode;
