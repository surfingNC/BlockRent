// src\components\WalletInfo.js
import React, { useEffect, useState } from 'react';

function WalletInfo({ address }) {
  const [balance, setBalance] = useState(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWalletInfo = async () => {
    if (!address || !window.unisat) return;

    try {
      setLoading(true);

      // Get balance in sats and convert to BTC
      const balanceInSats = await window.unisat.getBalance();
      const btc = parseFloat(balanceInSats.total) / 100000000;
      setBalance(btc);

      // Get current network
      const net = await window.unisat.getNetwork();
      setNetwork(net);

    } catch (error) {
      console.error('Failed to fetch wallet info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletInfo();
  }, [address]);

  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
      maxWidth: '500px'
    }}>
      <h3>Unisat Wallet Info</h3>

      <p><strong>Address:</strong> {address}</p>
      <p><strong>Network:</strong> {network || 'Loading...'}</p>
      <p><strong>Balance:</strong> {balance !== null ? `${balance} BTC` : 'Loading...'}</p>

      <button
        onClick={fetchWalletInfo}
        style={{
          marginTop: '12px',
          padding: '8px 16px',
          backgroundColor: '#f7931a',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Refresh Info
      </button>
    </div>
  );
}

export default WalletInfo;
