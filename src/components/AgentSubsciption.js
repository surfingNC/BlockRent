import React, { useState } from 'react';
import QRCode from 'qrcode.react';
import axios from 'axios';

const SUBSCRIPTIONS = [
  { type: 'basic', label: 'Basic', sats: 15000, duration: '90 days', listings: 1 },
  { type: 'pro', label: 'Pro', sats: 50000, duration: '30 days', listings: 5 },
  { type: 'unlimited', label: 'Unlimited', sats: 150000, duration: '30 days', listings: '∞' },
];

const BTC_RECEIVE_ADDRESS = import.meta.env.VITE_BTC_RECEIVE_ADDRESS;

const AgentSubscription = ({ walletAddress }) => {
  const [selected, setSelected] = useState(null);
  const [txId, setTxId] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/payments/verify-payment', { walletAddress, txId });
      setStatus(res.data);
    } catch (err) {
      setStatus({ error: err.response?.data?.error || 'Verification failed' });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Choose Your Subscription</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {SUBSCRIPTIONS.map(plan => (
          <div
            key={plan.type}
            onClick={() => setSelected(plan)}
            className={`border p-4 rounded-xl cursor-pointer ${selected?.type === plan.type ? 'border-blue-600' : ''}`}
          >
            <h3 className="text-lg font-semibold">{plan.label}</h3>
            <p>{plan.sats} sats</p>
            <p>{plan.duration}</p>
            <p>{plan.listings} listings</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mb-6">
          <h4 className="font-medium mb-2">Send {selected.sats} sats to:</h4>
          <code className="block p-2 bg-gray-100 rounded mb-2">{BTC_RECEIVE_ADDRESS}</code>
          <QRCode value={`bitcoin:${BTC_RECEIVE_ADDRESS}?amount=${selected.sats / 100000000}`} size={150} />
        </div>
      )}

      {selected && (
        <div className="mb-4">
          <label className="block mb-1 font-medium">Enter Transaction ID (txid):</label>
          <input
            className="border p-2 w-full rounded"
            type="text"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
          />
          <button
            onClick={handleVerify}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!txId || loading}
          >
            {loading ? 'Verifying...' : 'Verify Payment'}
          </button>
        </div>
      )}

      {status && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          {status.error ? (
            <p className="text-red-600">{status.error}</p>
          ) : (
            <>
              <p className="text-green-600 font-semibold">Payment verified!</p>
              <p>Tier: <strong>{status.type}</strong></p>
              <p>Valid until: <strong>{new Date(status.validUntil).toLocaleDateString()}</strong></p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentSubscription;
