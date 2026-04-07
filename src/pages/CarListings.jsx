import React, { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import ApplyModal from '../components/ApplyModal';
import Lightbox from '../components/Lightbox';

function CarListings() {
  const [dealers, setDealers] = useState([]);
  const [zipInput, setZipInput] = useState('');
  const [radius, setRadius] = useState('25');
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [applyModal, setApplyModal] = useState({ open: false, dealer: null });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = '/api/dealers';

  const handleSearch = async () => {
    if (!zipInput.match(/^\d{5}$/)) {
      alert('Please enter a valid 5-digit ZIP code.');
      return;
    }

    try {
      setLoading(true);
      setStatus(`Searching dealerships within ${radius} miles of ${zipInput}...`);

      const res = await fetch(`${API_URL}/search?zip=${zipInput}&radius=${radius}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Search failed');

      setDealers(data.dealers || []);
      setStatus(
        data.dealers?.length
          ? `✅ Found ${data.dealers.length} dealership(s) within ${radius} miles.`
          : `No dealerships found within ${radius} miles of ${zipInput}.`
      );
    } catch (err) {
      console.error('Search error:', err);
      setStatus('❌ Failed to search dealerships.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setZipInput('');
    setDealers([]);
    setStatus('');
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-grid-overlay" />

      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div className="dashboard-container">
        <h2 className="section-title" style={{ textAlign: 'center' }}>
          Dealership Listings
        </h2>

        {/* SEARCH */}
        <div className="glass-card filter-bar" style={{ justifyContent: 'center' }}>
          <input
            type="text"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            placeholder="ZIP (e.g. 27609)"
            className="glass-input"
          />

          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="glass-select"
          >
            {[10, 25, 50, 100, 200].map((r) => (
              <option key={r} value={r}>
                Within {r} miles
              </option>
            ))}
          </select>

          <button onClick={handleSearch} disabled={loading} className="glass-btn">
            {loading ? 'Searching...' : 'Search'}
          </button>

          <button onClick={handleReset} className="glass-btn">
            Reset
          </button>
        </div>

        {status && (
          <p className="empty-text" style={{ textAlign: 'center', marginTop: '1rem' }}>
            {status}
          </p>
        )}

        {/* RESULTS */}
        <div className="listings-grid">
          {zipInput === '' ? (
            <p className="empty-text">
              Enter a ZIP code to view dealerships.
            </p>
          ) : dealers.length === 0 ? (
            <p className="empty-text">
              No dealerships found within {radius} miles.
            </p>
          ) : (
            dealers.map((dealer) => (
              <DealerCard
                key={dealer._id}
                dealer={dealer}
                zipRef={zipInput}
                setLightbox={setLightbox}
                openApply={() => {
                  if (dealer.acceptingApplications) {
                    setApplyModal({ open: true, dealer });
                  }
                }}
              />
            ))
          )}
        </div>

        {lightbox.open && (
          <Lightbox
            images={lightbox.images}
            index={lightbox.index}
            onClose={() => setLightbox({ open: false, images: [], index: 0 })}
          />
        )}

        {applyModal.open && (
          <ApplyModal
            dealer={applyModal.dealer}
            onClose={() => setApplyModal({ open: false, dealer: null })}
          />
        )}
      </div>
    </div>
  );
}

function DealerCard({ dealer, zipRef, setLightbox, openApply }) {
  const [currentImage, setCurrentImage] = useState(0);
  const inactive = dealer.acceptingApplications === false;

  const imageList =
    dealer.images ||
    dealer.imageUrls ||
    dealer.photos ||
    (dealer.imageUrl ? [dealer.imageUrl] : []);

  const hasImages = imageList && imageList.length > 0;

  const nextImage = () =>
    !inactive &&
    setCurrentImage((prev) => (prev + 1) % imageList.length);

  const prevImage = () =>
    !inactive &&
    setCurrentImage((prev) => (prev - 1 + imageList.length) % imageList.length);

  return (
    <div className="glass-card listing-card" style={{ opacity: inactive ? 0.6 : 1 }}>
      {inactive && (
        <div className="badge inactive">Not Accepting</div>
      )}

      {hasImages && (
        <div className="listing-image-container">
          <img
            src={imageList[currentImage]}
            alt={dealer.dealershipName}
            className="listing-image"
            onClick={() =>
              !inactive &&
              setLightbox({ open: true, images: imageList, index: currentImage })
            }
          />

          {imageList.length > 1 && !inactive && (
            <>
              <button onClick={prevImage} className="image-nav left">‹</button>
              <button onClick={nextImage} className="image-nav right">›</button>
            </>
          )}

          <div className="image-counter">
            {currentImage + 1}/{imageList.length}
          </div>
        </div>
      )}

      <h3>{dealer.dealershipName}</h3>
      <p>{dealer.address}</p>
      <p>ZIP: {dealer.zipCode}</p>

      <p className="distance-text">
        Subscription: <strong>active</strong>
      </p>

      <p>Email: {dealer.contactEmail}</p>

      <button
        onClick={openApply}
        disabled={inactive}
        className="glass-btn"
      >
        {inactive ? 'Applications Closed' : 'Apply for Lease'}
      </button>
    </div>
  );
}


export default CarListings;