// src/components/SubscriptionPlanCard.jsx
import React from 'react';

const SubscriptionPlanCard = ({ plan, selected, onSelect, formatUsd }) => {
  const isSelected = selected?.type === plan.type;

  return (
    <div
      onClick={() => onSelect(plan)}
      style={{
        border: isSelected ? '2px solid #2563eb' : '1px solid #ccc',
        borderRadius: '1rem',
        padding: '1.5rem',
        width: '250px',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eff6ff' : '#fff',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
    >
      {isSelected && (
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
      <p>
        {plan.sats.toLocaleString('en-US')} sats{' '}
        <span style={{ color: '#665' }}>{formatUsd(plan.sats)}</span>
      </p>
      <p>{plan.durationDays} days</p>
      <p>{plan.listingCount === Infinity ? 'Unlimited' : plan.listingCount} listings</p>
    </div>
  );
};

export default SubscriptionPlanCard;
