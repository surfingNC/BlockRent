import React, { useState } from 'react';

function ApplyModal({ dealer, onClose }) {
  const [email, setEmail] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [btcHoldings, setBtcHoldings] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleUniSatConnect = async () => {
    if (!window.unisat) return alert('UniSat wallet not found');
    try {
      const accounts = await window.unisat.requestAccounts();
      const address = accounts[0];
      setBtcAddress(address);

      const balance = await window.unisat.getBalance();
      const btc = balance.confirmed / 1e8;
      setBtcHoldings(btc.toFixed(4));
    } catch (err) {
      console.error('UniSat connection error:', err);
      alert('Failed to connect UniSat wallet.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !btcHoldings) {
      return alert('Please connect wallet and enter your email.');
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId: dealer._id,
          applicantEmail: email,
          btcAddress,
          btcHoldings,
          message,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('✅ Application sent successfully!');
      } else {
        setStatus(`❌ ${data.error || 'Failed to send application.'}`);
      }
    } catch (err) {
      console.error('Error submitting application:', err);
      setStatus('❌ Network error submitting application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '2rem',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          position: 'relative',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#444',
          }}
        >
          ✖
        </button>

        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '1rem',
          }}
        >
          Apply to {dealer.dealershipName}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '0.4rem',
            }}
          />

          <label>Bitcoin Wallet:</label>
          <input
            type="text"
            value={btcAddress}
            readOnly
            style={{
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '0.4rem',
            }}
          />
          <button
            type="button"
            onClick={handleUniSatConnect}
            style={{
              backgroundColor: '#374151',
              color: 'white',
              padding: '0.4rem',
              borderRadius: '6px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Connect UniSat
          </button>

          <label>BTC Holdings:</label>
          <input
            type="text"
            value={btcHoldings}
            readOnly
            style={{
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '0.4rem',
            }}
          />

          <label>Message (optional):</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="3"
            style={{
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '0.4rem',
              resize: 'none',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem',
              fontWeight: '500',
              cursor: 'pointer',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>

          {status && (
            <p style={{ textAlign: 'center', marginTop: '0.5rem' }}>{status}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export default ApplyModal;
