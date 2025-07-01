import React, { useEffect, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import LoanForm from '../components/LoanForm';
import WalletInfo from '../components/WalletInfo';
import { normalizeSignature } from '../utils/normalizeSignature.js';
import { calculateCollateral } from '../utils/calculateCollateral.js';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [username] = useState(
    location.state?.username || sessionStorage.getItem('username')
  );
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(
    sessionStorage.getItem('walletAddress') || ''
  );

  const [creditScore, setCreditScore] = useState('');
  const [monthlyRentUSD, setMonthlyRentUSD] = useState('');
  const [btcUsdRate, setBtcUsdRate] = useState('');
  const [btcEstimate, setBtcEstimate] = useState(null);

  const API_URL = 'http://localhost:5000';

  // ✅ Check JWT auth
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/protected/dashboard`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setAuthorized(true);
        setLoading(false);
      })
      .catch(() => {
        sessionStorage.clear();
        setAuthorized(false);
        setLoading(false);
      });
  }, []);

  // ✅ Fetch BTC price on mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`${API_URL}/api/lease/btc-price`);
        const data = await res.json();
        if (data.price) {
          setBtcUsdRate(data.price);
        }
      } catch (err) {
        console.error('❌ Failed to fetch BTC price:', err);
      }
    };
    fetchPrice();
  }, []);

  // ✅ UniSat Wallet Connect
  const handleUnisatConnect = async () => {
    if (!window.unisat) {
      alert('UniSat Wallet not installed. Get it at https://unisat.io');
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        alert('You must be logged in to connect your wallet.');
        return;
      }

      const accounts = await window.unisat.requestAccounts();
      if (!accounts || accounts.length === 0) {
        alert('No accounts found in UniSat Wallet.');
        return;
      }
      const address = accounts[0];
      const pubkey = await window.unisat.getPublicKey();
      if (!pubkey) {
        alert('Failed to get public key from UniSat Wallet.');
        return;
      }

      const addrLower = address.toLowerCase();
      const isTaproot = addrLower.startsWith('bc1p');

      const challengeRes = await fetch(`${API_URL}/api/wallet/challenge`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!challengeRes.ok) throw new Error('Failed to get challenge from server');
      const { challenge } = await challengeRes.json();

      let signature;
      if (isTaproot) {
        signature = await window.unisat.signSchnorr(challenge);
        signature = signature.toLowerCase();
      } else {
        signature = await window.unisat.signMessage(challenge, 'ecdsa');
      }

      if (!signature) {
        alert('Signature was empty or invalid.');
        return;
      }

      const normalizedSignature = normalizeSignature(signature, isTaproot);

      const verifyRes = await fetch(`${API_URL}/api/wallet/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address,
          pubkey,
          challenge,
          signature: normalizedSignature,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'Wallet verification failed');
      }

      sessionStorage.setItem('walletAddress', address);
      setWalletAddress(address);
      alert('✅ Wallet connected successfully!');
    } catch (err) {
      console.error('❌ Wallet connect error:', err);
      alert(`Failed to connect wallet: ${err.message}`);
    }
  };

  const handleEstimate = () => {
    const result = calculateCollateral(
      parseInt(creditScore),
      parseFloat(monthlyRentUSD),
      parseFloat(btcUsdRate)
    );
    setBtcEstimate(result);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;
  if (!authorized) return <Navigate to="/login" replace />;

  return (
    <div className="app-container">
      <h1>Welcome, {username || 'User'}!</h1>
      <p>Use the form below to apply for a Bitcoin-backed lease.</p>

      <LoanForm />

      <div style={{ marginTop: '24px' }}>
        {!walletAddress ? (
          <button
            onClick={handleUnisatConnect}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f7931a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Connect UniSat Wallet
          </button>
        ) : (
          <WalletInfo address={walletAddress} />
        )}
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2>Bitcoin Collateral Estimator</h2>
        <input
          type="number"
          placeholder="Credit Score"
          value={creditScore}
          onChange={(e) => setCreditScore(e.target.value)}
        />
        <input
          type="number"
          placeholder="Monthly Rent (USD)"
          value={monthlyRentUSD}
          onChange={(e) => setMonthlyRentUSD(e.target.value)}
        />
        <input
          type="text"
          placeholder="BTC/USD Rate"
          value={btcUsdRate ? `$${Number(btcUsdRate).toLocaleString()}` : ''}
          disabled
        />

        <button onClick={handleEstimate}>Estimate BTC Required</button>
        {btcEstimate && (
          <p>
            Required Collateral: {btcEstimate.monthsRequired} months ≈{' '}
            {btcEstimate.btcRequired} BTC
          </p>
        )}
      </div>

      <button
        onClick={handleLogout}
        style={{
          marginTop: '20px',
          padding: '8px 16px',
          backgroundColor: 'black',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
