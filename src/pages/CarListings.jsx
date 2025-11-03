import React, { useEffect, useState } from 'react';
import DealerCard from '../components/DealerCard';
import ApplyModal from '../components/ApplyModal';
import Header from '../components/Header';

function CarListings() {
  const [dealers, setDealers] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);

  useEffect(() => {
    fetch('/api/dealers')
      .then(res => res.json())
      .then(setDealers)
      .catch(err => console.error('Failed to fetch dealers', err));
  }, []);

  return (
    <div className="car-listings">
      <Header />
      <h1 className="text-2xl font-bold text-center mt-6 mb-4">Dealership Listings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
        {dealers.map(d => (
          <DealerCard key={d._id} dealer={d} onApply={setSelectedDealer} />
        ))}
      </div>

      {selectedDealer && (
        <ApplyModal dealer={selectedDealer} onClose={() => setSelectedDealer(null)} />
      )}
    </div>
  );
}

export default CarListings;
