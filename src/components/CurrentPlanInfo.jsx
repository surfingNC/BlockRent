// src/components/CurrentPlanInfo.jsx
import React from 'react';

const CurrentPlanInfo = ({ existingSub, countdown }) => {
  if (!existingSub?.active) return null;

  return (
    <div style={{ textAlign: 'center', color: 'green', marginBottom: '1rem' }}>
      Current Plan: <strong>{existingSub.type.toUpperCase()}</strong> —{' '}
      {existingSub.type === 'unlimited'
        ? `valid until ${new Date(existingSub.validUntil).toLocaleDateString()}`
        : `${existingSub.listingCount} listings remaining`}
      <br />
      {countdown && (
        <span style={{ fontSize: '0.85rem', color: '#665' }}>{countdown}</span>
      )}
    </div>
  );
};

export default CurrentPlanInfo;
