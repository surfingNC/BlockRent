import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import '../styles/index.css';

const BTC_RECEIVE_ADDRESS = process.env.REACT_APP_BTC_RECEIVE_ADDRESS;
console.log('🎯 BTC_RECEIVE_ADDRESS (in component):', BTC_RECEIVE_ADDRESS);


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

const Subscribe = () => {
  const [sessionId, setSessionId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [existingSub, setExistingSub] = useState(null);
  const [listening, setListening] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [btcPrice, setBtcPrice] = useState(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  //const navigate = useNavigate();
  const walletAddress = localStorage.getItem('walletAddress');
  const [email, setEmail] = useState(null); // null means "not yet loaded"
  const [emailReady, setEmailReady] = useState(false);
  //const [verifyMessage, setVerifyMessage] = useState(null);


useEffect(() => {
  const interval = setInterval(() => {
    const stored = localStorage.getItem('email');
    if (stored && stored !== 'null' && stored !== null) {
      console.log('📧 Hydrated email:', stored);
      setEmail(stored);
      setEmailReady(true);
      clearInterval(interval);
    } else {
      console.log('⏳ Waiting for email in localStorage...');
    }
  }, 250);

  return () => clearInterval(interval);
}, []);

const triggerWebSocket = (sessionId, actualEmail, walletAddress) => {
  console.log('⚡ triggerWebSocket(): sessionId =', sessionId);
  console.log('⚡ triggerWebSocket(): actualEmail =', actualEmail);
  console.log('⚡ triggerWebSocket(): walletAddress =', walletAddress);
  console.log('⚡ triggerWebSocket(): emailReady =', emailReady);

  if (!emailReady || !actualEmail || actualEmail === 'null') {
    console.error('❌ Hydrated email is missing or invalid in triggerWebSocket');
    alert('Email not loaded. Please refresh and try again.');
    return;
  }
  console.log('🚀 Triggering WebSocket manually...');

  const ws = new WebSocket('wss://mempool.space/api/v1/ws');

  ws.onopen = () => {
    console.log('🔌 WebSocket connected');

    if (!BTC_RECEIVE_ADDRESS || BTC_RECEIVE_ADDRESS.length < 10) {
      console.error('❌ BTC_RECEIVE_ADDRESS is invalid or missing:', BTC_RECEIVE_ADDRESS);
      ws.close();
      return;
    }

    const subMsg = { action: 'want', data: [`addr:${BTC_RECEIVE_ADDRESS}`] };
    console.log('📨 Subscribing with message:', subMsg);
    ws.send(JSON.stringify(subMsg));

    setListening(true);
  };

ws.onmessage = (event) => {
  console.log('📡 Raw WebSocket message:', event.data);
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (e) {
    console.error('❌ Failed to parse ws message:', e);
    return;
  }

  const txid = msg?.data?.txid;
  const outputs = msg?.data?.vout || [];

  const matchedOutput = outputs.find(o => o.scriptpubkey_address === BTC_RECEIVE_ADDRESS);
  if (!matchedOutput || !txid) {
    console.log('📭 No matching output or missing txid');
    return;
  }

  console.log('🎯 Matched txid! About to post for verification:', txid);
  console.log('📬 Triggering fetch with email:', actualEmail);

  fetch('/api/payments/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId: txid, sessionId, email: actualEmail, walletAddress }),
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ Verification response:', data);
      if (data.success) {
        fetch('/api/notifications/subscription-confirmed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        setTimeout(() => {
          window.location.href = '/dashboard';
          ws.close(); // ✅ Only close WebSocket on success
        }, 1500);
      } else {
        alert('❌ Verification failed.');
        // Don't close WebSocket here — keep listening
      }
    })
    .catch(err => {
      console.error('❌ Verification error:', err);
      alert('❌ Verification failed.');
      // Still don't close here — might succeed later
    });
};


ws.onerror = (err) => {
  console.error('⚠️ WebSocket error occurred:', err);

  // Do not close immediately — let the connection stay alive
  // Optionally notify the user, or set a retry timeout if connection is lost

  // Example (optional): notify after delay if still broken
  setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.warn('⏱ Still not connected — closing WebSocket');
      ws.close(); // Graceful cleanup only if needed
    }
  }, 5000); // wait 5s before taking action
};


  ws.onclose = () => {
    console.log('🔌 WebSocket closed');
  };
};



const handlePlanSelect = async (plan) => {
   const actualEmail = localStorage.getItem('email'); // ✅ get fresh value

  if (!emailReady || !email) {
    console.error('❌ Email not ready or missing in handlePlanSelect');
    alert('Please wait for your email to finish loading...');
    return;
  }

   // ✅ Log the email you're sending to the backend
  console.log('🔁 Submitting session start with:', email);

  try {
    const res = await fetch('/api/payments/start-payment-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: actualEmail, planType: plan.type }),
    });


    const data = await res.json();

    if (res.ok && data.sessionId) {
      setSessionId(data.sessionId);
      localStorage.setItem('lastSessionId', data.sessionId); // 🆕 persist to localStorage
      setSelected(plan);
      console.log("🆔 Session started:", data.sessionId);
      setTimeout(() => {
        triggerWebSocket(data.sessionId, actualEmail, walletAddress);
      }, 250);

    } else {
      console.error('❌ Failed to start session:', data.error);
    }
  } catch (err) {
    console.error('Failed to start session:', err);
  }
};


  useEffect(() => {
    fetch('/api/payments/tiers')
      .then(res => res.json())
      .then(data => setSubscriptionTiers(data))
      .catch(err => console.error('Failed to fetch tiers:', err));
  }, []);

  useEffect(() => {
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
  const queryParam = walletAddress
    ? `walletAddress=${walletAddress}`
    : email
    ? `email=${email}`
    : null;

  if (!queryParam) return;

  fetch(`/api/payments/status?${queryParam}`)
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
}, [walletAddress, email]);

// ======================================================

//======================================================



  useEffect(() => {
    if (!listening) return;
    const timeout = setTimeout(() => {
      setListening(false);
    }, 600000); //10 minutes
    return () => clearTimeout(timeout);
  }, [listening]);

  const formatUsd = (sats) => {
    if (!btcPrice) return '(~$...)';
    const usd = (sats / 100000000) * btcPrice;
    return `(~$${usd.toFixed(2)})`;
  };

  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1rem' }}>
          Choose a Subscription Plan
        </h2>

        <PromoCodeForm />

        {existingSub?.active && (
          <div style={{ textAlign: 'center', color: 'green', marginBottom: '1rem' }}>
            Current Plan: <strong>{existingSub.type.toUpperCase()}</strong> —{' '}
            {existingSub.type === 'unlimited'
              ? `valid until ${new Date(existingSub.validUntil).toLocaleDateString()}`
              : `${existingSub.listingCount} listings remaining`}
            <br />
            {countdown && <span style={{ fontSize: '0.85rem', color: '#665' }}>{countdown}</span>}
          </div>
        )}
{emailReady ? (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
    {subscriptionTiers.map((plan) => (
      <div
        key={plan.type}
        onClick={() => handlePlanSelect(plan)}
        style={{
          border: selected?.type === plan.type ? '2px solid #2563eb' : '1px solid #ccc',
          borderRadius: '1rem',
          padding: '1.5rem',
          width: '250px',
          cursor: 'pointer',
          backgroundColor: selected?.type === plan.type ? '#eff6ff' : '#fff',
          boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}
      >
        {selected?.type === plan.type && (
          <span style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.75rem',
            color: 'green',
            fontSize: '1.25rem'
          }}>
            ✔
          </span>
        )}
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
        </h3>
        <p>{plan.sats.toLocaleString('en-US')} sats <span style={{ color: '#665' }}>{formatUsd(plan.sats)}</span></p>
        <p>{plan.durationDays} days</p>
        <p>{plan.listingCount === Infinity ? 'Unlimited' : plan.listingCount} listings</p>
      </div>
    ))}
  </div>
) : (
  <p style={{ textAlign: 'center', color: '#888' }}>⏳ Loading email…</p>
)}



        {selected && (
          <div style={{ textAlign: 'center' }}>
            <p className="mb-2">
              Send <strong>{selected.sats.toLocaleString('en-US')} sats</strong> to:
            </p>
            <code style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.85rem',
              background: '#f1f1f1',
              padding: '0.5rem',
              borderRadius: '0.5rem',
            }}>
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
          </div>
        )}



      </div>
    </div>
  );
};

export default Subscribe;
