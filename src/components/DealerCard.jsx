import React from 'react';

function DealerCard({ dealer, onApply }) {
  return (
    <div className="dealer-card border rounded-lg p-4 shadow-sm bg-white">
      <h3 className="text-lg font-semibold">{dealer.dealershipName}</h3>
      <p className="text-sm text-gray-600">{dealer.address}</p>
      <p className="text-sm text-gray-500 mt-1">
        Subscription: {dealer.subscriptionType} ({new Date(dealer.subscriptionValidUntil).toLocaleDateString()})
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        {dealer.images?.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Dealer ${i + 1}`}
            className="w-24 h-24 object-cover rounded-md"
          />
        ))}
      </div>

      {dealer.acceptingApplications ? (
        <button
          onClick={() => onApply(dealer)}
          className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
        >
          Apply with Bitcoin Holdings
        </button>
      ) : (
        <p className="mt-4 text-red-500 text-sm">Not accepting applications</p>
      )}
    </div>
  );
}

export default DealerCard;
