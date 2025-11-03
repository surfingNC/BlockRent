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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-3">
          Apply to {dealer.dealershipName}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="border rounded px-2 py-1"
          />

          <label>Bitcoin Wallet:</label>
          <input
            type="text"
            value={btcAddress}
            readOnly
            className="border rounded px-2 py-1"
          />
          <button
            type="button"
            onClick={handleUniSatConnect}
            className="bg-gray-700 text-white py-1 px-3 rounded"
          >
            Connect UniSat
          </button>

          <label>BTC Holdings:</label>
          <input
            type="text"
            value={btcHoldings}
            readOnly
            className="border rounded px-2 py-1"
          />

          <label>Message (optional):</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows="3"
            className="border rounded px-2 py-1"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>

          {status && <p className="text-center mt-2">{status}</p>}
        </form>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-black"
        >
          ✖
        </button>
      </div>
    </div>
  );
}

export default ApplyModal;
