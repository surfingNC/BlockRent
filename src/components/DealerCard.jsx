import React from 'react';

function DealerCard({ dealer, onApply }) {
  const {
    dealershipName,
    address,
    zipCode,
    contactEmail,
    images = [],
    subscriptionType,
    acceptingApplications,
  } = dealer;

  const firstImage =
    images && images.length > 0
      ? images[0]
      : 'https://via.placeholder.com/400x250?text=No+Image';

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* 🖼️ Dealer Image */}
      <img
        src={firstImage}
        alt={dealershipName}
        className="w-full h-48 object-cover"
      />

      {/* 🏢 Dealer Info */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-1">{dealershipName}</h2>

        <p className="text-gray-600 text-sm">{address}</p>
        {zipCode && <p className="text-gray-600 text-sm">ZIP: {zipCode}</p>}

        <p className="text-gray-500 text-xs mt-2">
          Subscription: {subscriptionType?.toUpperCase() || 'N/A'}
        </p>

        {/* 📨 Contact Email */}
        <p className="text-gray-600 text-xs mt-1 truncate">
          <span className="font-medium">Email:</span> {contactEmail}
        </p>

        {/* 🟢 Apply Button */}
        {acceptingApplications ? (
          <button
            onClick={() => onApply(dealer)}
            className="mt-3 w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600"
          >
            Apply for Rent
          </button>
        ) : (
          <p className="mt-3 text-red-500 text-sm text-center">
            Not accepting applications
          </p>
        )}
      </div>
    </div>
  );
}

export default DealerCard;
