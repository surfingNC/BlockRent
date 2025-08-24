// src/components/PaymentQRCode.jsx
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const Spinner = () => (
  <div className="spinner" style={{ margin: '1rem auto' }}>
    <div
      style={{
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #2563eb',
        borderRadius: '50%',
        width: '28px',
        height: '28px',
        animation: 'spin 1s linear infinite',
        margin: '0 auto',
      }}
    />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const PaymentQRCode = ({ selected, listening, pendingTxDetected, btcAddress }) => {
  if (!selected) return null;

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
        Send <strong>{selected.sats.toLocaleString('en-US')} sats</strong> to:
      </p>

      <code
        style={{
          display: 'block',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          background: '#f1f1f1',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          wordBreak: 'break-all',
        }}
      >
        {btcAddress}
      </code>

      <QRCodeCanvas
        value={`bitcoin:${btcAddress}?amount=${selected.sats / 100000000}`}
        size={160}
      />

      {pendingTxDetected && (
        <div style={{ marginTop: '1rem' }}>
          <Spinner />
          <p style={{ fontSize: '0.9rem', color: '#2563eb', marginTop: '0.5rem' }}>
            Payment detected — awaiting confirmation...
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentQRCode;
