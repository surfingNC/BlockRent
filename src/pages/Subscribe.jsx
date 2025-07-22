// src/pages/Subscribe.jsx
import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/Header';
import '../styles/index.css';

const SUBSCRIPTIONS = [
  { type: 'basic', label: 'Basic', sats: 15000, duration: '90 days', listings: 1, usd: 5 },
  { type: 'pro', label: 'Pro', sats: 50000, duration: '30 days', listings: 5, usd: 15 },
  { type: 'unlimited', label: 'Unlimited', sats: 150000, duration: '30 days', listings: 'Unlimited', usd: 45 },
];

const BTC_RECEIVE_ADDRESS = process.env.REACT_APP_BTC_RECEIVE_ADDRESS;

const Subscribe = () => {
  const navigate = useNavigate();
  const walletAddress = sessionStorage.getItem('walletAddress');
  const [selected, setSelected] = useState(null);
  const [txId, setTxId] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [existingSub, setExistingSub] = useState(null);
  const [listening, setListening] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/payments/status?walletAddress=${walletAddress}`)
      .then(res => res.json())
      .then(data => {
        setExistingSub(data);
        if (data?.validUntil) {
          const interval = setInterval(() => {
            const diff = new Date(data.validUntil) - new Date();
            if (diff <= 0) {
              clearInterval(interval);
              setCountdown('Expired');
            } else {
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
              const minutes = Math.floor((diff / (1000 * 60)) % 60);
              setCountdown(`${days}d ${hours}h ${minutes}m remaining`);
            }
          }, 60000);
          return () => clearInterval(interval);
        }
      })
      .catch(err => console.error('Error fetching subscription status:', err));
  }, [walletAddress]);

  useEffect(() => {
    if (!selected) return;
    let ws;
    let retryCount = 0;
    const maxRetries = 5;

    const connectWebSocket = () => {
      ws = new WebSocket('wss://mempool.space/api/v1/ws');

      ws.onopen = () => {
        setListening(true);
        ws.send(JSON.stringify({ action: 'want', data: [`addr:${BTC_RECEIVE_ADDRESS}`] }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const txs = msg?.data?.transactions || [];
        const match = txs.find(tx =>
          tx.status?.confirmed === true &&
          tx.vout?.some(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS)
        );
        if (match) {
          setTxId(match.txid);
          handleVerify(match.txid);
          ws.close();
          setListening(false);
        }
      };

      ws.onclose = () => {
        setListening(false);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => connectWebSocket(), 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connectWebSocket();
    return () => ws && ws.close();
  }, [selected]);

  const handleVerify = async (overrideTxId = null) => {
    const finalTxId = overrideTxId || txId;
    if (!finalTxId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/payments/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId: finalTxId, walletAddress }),
      });
      const data = await res.json();
      setStatus(data);
      if (data.success) {
        fetch('/api/notifications/subscription-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (err) {
      console.error('Verification failed:', err);
      setStatus({ error: 'Verification failed' });
    }
    setLoading(false);
  };

  return (
    <div>
      <DashboardHeader />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>Choose a Subscription Plan</h2>

        {existingSub?.active && (
          <div style={{ textAlign: 'center', color: 'green', marginBottom: '1rem' }}>
            Current Plan: <strong>{existingSub.type.toUpperCase()}</strong> —
            {existingSub.type === 'unlimited'
              ? ` valid until ${new Date(existingSub.validUntil).toLocaleDateString()}`
              : ` ${existingSub.listingCount} listings remaining`}<br />
            {countdown && <span style={{ fontSize: '0.85rem', color: '#666' }}>{countdown}</span>}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {SUBSCRIPTIONS.map(plan => (
            <div
              key={plan.type}
              onClick={() => setSelected(plan)}
              style={{
                border: selected?.type === plan.type ? '2px solid #2563eb' : '1px solid #ccc',
                borderRadius: '1rem',
                padding: '1.5rem',
                width: '250px',
                cursor: 'pointer',
                backgroundColor: selected?.type === plan.type ? '#eff6ff' : '#fff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                position: 'relative',
              }}
            >
              {selected?.type === plan.type && (
                <span style={{ position: 'absolute', top: '0.5rem', right: '0.75rem', color: 'green', fontSize: '1.25rem' }}>✔</span>
              )}
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{plan.label}</h3>
              <p>{plan.sats} sats (~${plan.usd} USD)</p>
              <p>{plan.duration}</p>
              <p>{plan.listings} listings</p>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ textAlign: 'center' }}>
            <p className="mb-2">Send <strong>{selected.sats} sats</strong> to:</p>
            <code style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', background: '#f1f1f1', padding: '0.5rem', borderRadius: '0.5rem' }}>
              {BTC_RECEIVE_ADDRESS}
            </code>
            <div style={{ marginBottom: '1rem' }}>
              <QRCodeCanvas
                value={`bitcoin:${BTC_RECEIVE_ADDRESS}?amount=${selected.sats / 100000000}`}
                size={160}
              />
            </div>

            {listening && (
              <p style={{ fontSize: '0.9rem', color: '#2563eb' }}>Listening for incoming payment... (auto-verifies on confirmation)</p>
            )}

            <input
              type="text"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              placeholder="Paste Transaction ID (txid)"
              style={{ border: '1px solid #ccc', padding: '0.5rem', borderRadius: '0.5rem', width: '250px' }}
            />
            <br />
            <button
              onClick={() => handleVerify()}
              disabled={!txId || loading}
              style={{ marginTop: '0.75rem', padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' }}
            >
              {loading ? 'Verifying...' : 'Verify Payment'}
            </button>
          </div>
        )}

        {status && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            {status.error ? (
              <p style={{ color: 'red' }}>{status.error}</p>
            ) : (
              <p style={{ color: 'green' }}>Subscription confirmed! Redirecting...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Subscribe;