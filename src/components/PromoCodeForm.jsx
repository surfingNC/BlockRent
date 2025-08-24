import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PromoCodeForm = () => {
  const navigate = useNavigate();
  const email = localStorage.getItem('email') || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    if (!email) return setMessage('❌ Email not found. Please log in again.');
    if (!code.trim()) return setMessage('❌ Please enter a promo code.');

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/access-code/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), email }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('✅ Promo applied! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setMessage(`❌ ${data.msg || 'Invalid promo code'}`);
      }
    } catch (err) {
      console.error('Promo error:', err);
      setMessage('❌ Server error. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', marginBottom: '2rem', textAlign: 'center' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Have a Promo Code?</h3>
      <form onSubmit={handlePromoSubmit}>
        <input
          type="text"
          placeholder="Enter access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #ccc',
            width: '70%',
            maxWidth: '300px',
            marginBottom: '0.5rem'
          }}
        />
        <br />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Verifying...' : 'Submit'}
        </button>
      </form>
      {message && (
        <div style={{ marginTop: '0.5rem', color: message.startsWith('✅') ? 'green' : 'red' }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default PromoCodeForm;
