// src/components/DealerCard.jsx
import React from 'react';

function DealerCard({ dealer, onApply }) {
  const inactive = dealer.acceptingApplications === false;

  return (
    <div
      className="rounded-lg shadow-md overflow-hidden border transition-all"
      style={{
        opacity: inactive ? 0.6 : 1,
        pointerEvents: inactive ? 'none' : 'auto',
        position: 'relative',
      }}
    >
      {/* Inactive ribbon */}
      {inactive && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: -30,
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '4px 40px',
            transform: 'rotate(-45deg)',
            fontSize: '0.75rem',
            fontWeight: '600',
          }}
        >
          Not Accepting
        </div>
      )}

      {/* Dealer Image */}
      {dealer.images?.length > 0 ? (
        <img
          src={dealer.images[0]}
          alt={dealer.dealershipName}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-500">
          No Image
        </div>
      )}

      <div className="p-4">
        <h3 className="text-lg font-bold">{dealer.dealershipName}</h3>
        <p className="text-sm text-gray-600">{dealer.address}</p>
        <p className="text-sm text-gray-500">
          ZIP: {dealer.zipCode}
        </p>

        <button
          className={`mt-3 w-full py-2 rounded text-white ${
            inactive ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'
          }`}
          disabled={inactive}
          onClick={() => !inactive && onApply(dealer)}
        >
          {inactive ? 'Applications Closed' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

export default DealerCard;
