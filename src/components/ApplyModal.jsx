import React, { useState } from 'react';

function ApplyModal({ dealer, onClose }) {
  const [email, setEmail] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [btcHoldings, setBtcHoldings] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  if (!dealer) return null;

  // ❌ Dealer cannot accept applications
  const isBlocked = dealer.acceptingApplications === false;

  const handleUniSatConnect = async () => {
    if (isBlocked) return;

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
    if (isBlocked) return;

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
  <div className="modal-overlay">
    <form onSubmit={handleSubmit} className="glass-card modal-card">

      {/* CLOSE */}
      <button
        type="button"
        onClick={onClose}
        className="modal-close"
      >
        ×
      </button>

      <h2 className="modal-title">
        Apply to {dealer.dealershipName}
      </h2>

      {isBlocked && (
        <div className="modal-warning">
          🚫 This dealership is not accepting applications right now.
        </div>
      )}

      <input
        className="glass-input"
        type="email"
        placeholder="Your Email"
        value={email}
        disabled={isBlocked}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        className="glass-input"
        type="text"
        placeholder="Wallet Address"
        value={btcAddress}
        readOnly
        disabled={isBlocked}
      />

      <button
        type="button"
        onClick={handleUniSatConnect}
        disabled={isBlocked}
        className="glass-btn"
      >
        Connect UniSat
      </button>

      <input
        className="glass-input"
        type="text"
        placeholder="BTC Holdings"
        value={btcHoldings}
        readOnly
        disabled={isBlocked}
      />

      <textarea
        className="glass-input"
        placeholder="Message (optional)"
        value={message}
        disabled={isBlocked}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        type="submit"
        disabled={loading || isBlocked}
        className="glass-btn apply-btn"
      >
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>

      {status && <p className="modal-status">{status}</p>}

    </form>
  </div>
);
}

export default ApplyModal;
