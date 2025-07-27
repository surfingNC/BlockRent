// src/pages/Subscribe.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import '../styles/index.css';

//const [subscriptionTiers, setSubscriptionTiers] = useState([]);


const BTC_RECEIVE_ADDRESS = process.env.REACT_APP_BTC_RECEIVE_ADDRESS;
console.log("Frontend BTC Address:", BTC_RECEIVE_ADDRESS);


const Spinner = () => (
  <div className="spinner" style={{ margin: '1rem auto' }}>
    <div style={{
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #2563eb',
      borderRadius: '50%',
      width: '28px',
      height: '28px',
      animation: 'spin 1s linear infinite',
      margin: '0 auto'
    }} />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

//==============================================
const PromoCodeForm = () => {
  const navigate = useNavigate();
  const email = localStorage.getItem('email') || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePromoSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setMessage('❌ Email not found. Please log in again.');
      return;
    }

    if (!code.trim()) {
      setMessage('❌ Please enter a promo code.');
      return;
    }

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
        setMessage('✅ Promo applied! Redirecting to dashboard...');
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

//==============================================

const Subscribe = () => {
  const navigate = useNavigate();
  const walletAddress = localStorage.getItem('walletAddress');
  const [selected, setSelected] = useState(null);
  const [txId, setTxId] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [existingSub, setExistingSub] = useState(null);
  const [listening, setListening] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [btcPrice, setBtcPrice] = useState(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);

  //===============================================
	const handleVerify = useCallback(async (overrideTxId = null) => {
		const finalTxId = overrideTxId || txId;
		if (!finalTxId) {
			setStatus({ error: 'Missing txId.' });
			return;
		}

		setLoading(true);
		try {
      const payload = {
        txId: finalTxId,
        walletAddress,
        email: localStorage.getItem('email'),
      };

      //console.log("🔍 Verifying payment with payload:", payload); //comment this out once working

			const res = await fetch('/api/payments/verify-payment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});


			const data = await res.json();
      //console.log("✅ Backend response:", data); // Debug


			setStatus(data);

			if (data.success) {
				await fetch('/api/notifications/subscription-confirmed', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ walletAddress: walletAddress || 'manual' }),
				});

				setTimeout(() => navigate('/dashboard'), 2000);
			}
		} catch (err) {
			console.error('Verification failed:', err);
			setStatus({ error: 'Verification failed' });
		}
		setLoading(false);
	}, [txId, walletAddress, navigate]);


  //==========================

    useEffect(() => {
      fetch('/api/payments/tiers')
      .then(res => res.json())
      .then(data => setSubscriptionTiers(data))
      .catch(err => console.error('Failed to fetch tiers:', err));
    }, []);

  useEffect(() => {
    // should this go here?
    const fetchCachedPrice = async () => {
      const cached = localStorage.getItem('btc_price_cached');
      const timestamp = localStorage.getItem('btc_price_cached_at');
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      if (cached && timestamp && now - parseInt(timestamp, 10) < tenMinutes) {
        setBtcPrice(parseFloat(cached));
      } else {
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
          const data = await res.json();
          const price = data?.bitcoin?.usd;
          if (price) {
            setBtcPrice(price);
            localStorage.setItem('btc_price_cached', price.toString());
            localStorage.setItem('btc_price_cached_at', now.toString());
          }
        } catch (err) {
          console.error('Failed to fetch BTC price:', err);
        }
      }
    };

    fetchCachedPrice();
  }, []);


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
        tx.vout?.some(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS)
      );
      if (match) {
        console.log('🟡 Incoming tx detected:', match.txid);
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
}, [selected, handleVerify]);



  useEffect(() => {
    if (!listening) return;
    const timeout = setTimeout(() => {
      setListening(false);
    }, 3 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [listening]);
// ========

//=========

  const formatUsd = (sats) => {
    if (!btcPrice) return '(~$...)';
    const usd = (sats / 100000000) * btcPrice;
    return `(~$${usd.toFixed(2)})`;
  };

  	if (existingSub?.active && existingSub?.type === 'unlimited') {
		return (
			<div>
				<DashboardHeader username={localStorage.getItem('username') || ''} />
				<div style={{ maxWidth: '720px', margin: '2rem auto', padding: '2rem', textAlign: 'center' }}>
					<h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'green' }}>✅ You already have an active Unlimited plan.</h2>
					<p style={{ color: '#444', marginTop: '1rem' }}>
						Your subscription is valid until: <strong>{new Date(existingSub.validUntil).toLocaleDateString()}</strong>
					</p>
					<p style={{ fontSize: '0.9rem', color: '#66' }}>No need to purchase again.</p>
				</div>
			</div>
		);
	}


  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>Choose a Subscription Plan</h2>

        <PromoCodeForm />


        {existingSub?.active && (
          <div style={{ textAlign: 'center', color: 'green', marginBottom: '1rem' }}>
            Current Plan: <strong>{existingSub.type.toUpperCase()}</strong> —
            {existingSub.type === 'unlimited'
              ? ` valid until ${new Date(existingSub.validUntil).toLocaleDateString()}`
              : ` ${existingSub.listingCount} listings remaining`}<br />
            {countdown && <span style={{ fontSize: '0.85rem', color: '#665' }}>{countdown}</span>}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {subscriptionTiers.map(plan => (

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
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
              </h3>
              <p>
                {plan.sats.toLocaleString('en-US')} sats{' '}
                <span style={{ color: '#665' }}>{formatUsd(plan.sats)}</span>
              </p>
              <p>{plan.durationDays} days</p>
              <p>{plan.listingCount === Infinity ? 'Unlimited' : plan.listingCount} listings</p>
            </div>
          ))}
        </div>

        {selected && (
            <div style={{ textAlign: 'center' }}>
                <p className="mb-2">
                    Send <strong>{selected.sats.toLocaleString('en-US')} sats</strong> to:
                </p>
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
                    <div>
                        <Spinner />
                        <p style={{ fontSize: '0.9rem', color: '#2563eb' }}>
                            Listening for incoming payment... (auto-verifies on confirmation)
                        </p>
                    </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', color: '#665' }}>
                        Didn't detect your payment? You can manually verify it here:
                    </p>
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
                        style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem 1.25rem',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            borderRadius: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {loading ? 'Verifying...' : 'Verify Manually'}
                    </button>
                </div>
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