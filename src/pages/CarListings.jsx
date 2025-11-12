import React, { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import ApplyModal from '../components/ApplyModal'; // ✅ use your existing UniSat modal

function CarListings() {
  const [dealers, setDealers] = useState([]);
  const [zipInput, setZipInput] = useState('');
  const [radius, setRadius] = useState('25');
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [applyModal, setApplyModal] = useState({ open: false, dealer: null });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = '/api/dealers';

  // 🔍 Search dealerships by ZIP + radius
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
          ? `✅ Found ${data.dealers.length} dealership(s) within ${radius} miles of ${zipInput}.`
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div style={{ padding: '2rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 'bold' }}>
          Dealership Listings
        </h2>

        {/* 🔍 Search Controls */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <input
            type="text"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            placeholder="ZIP (e.g. 27609)"
            style={{
              padding: '0.5rem',
              marginRight: '0.5rem',
              width: '100px',
              textAlign: 'center',
            }}
          />
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            style={{ padding: '0.5rem', marginRight: '0.5rem' }}
          >
            {[10, 25, 50, 100, 200].map((r) => (
              <option key={r} value={r}>
                Within {r} miles
              </option>
            ))}
          </select>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={handleReset}
            style={{
              marginLeft: '0.75rem',
              background: 'none',
              border: 'none',
              color: '#555',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        {/* 🏁 Status message */}
        {status && <p style={{ textAlign: 'center', marginTop: '1rem' }}>{status}</p>}

        {/* 🚗 Dealer Listings */}
        {zipInput === '' ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>
            Please enter a ZIP code and click "Search" to view dealerships nearby.
          </p>
        ) : dealers.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>
            No dealerships found within {radius} miles of ZIP {zipInput}.
          </p>
        ) : (
          dealers.map((dealer, index) => (
            <div key={dealer._id}>
              <DealerCard
                dealer={dealer}
                zipRef={zipInput}
                setLightbox={setLightbox}
                openApply={() => setApplyModal({ open: true, dealer })}
              />
              {index < dealers.length - 1 && <hr style={{ margin: '2rem 0' }} />}
            </div>
          ))
        )}

        {/* 🖼 Lightbox */}
        {lightbox.open && (
          <Lightbox
            images={lightbox.images}
            index={lightbox.index}
            setLightbox={setLightbox}
          />
        )}

        {/* 💬 Application Modal (UniSat) */}
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

  // Support different image field formats (imageUrls, images, photos, etc.)
  const imageList =
    dealer.imageUrls ||
    dealer.images ||
    dealer.photos ||
    (dealer.imageUrl ? [dealer.imageUrl] : []);

  const hasImages = imageList && imageList.length > 0;

  const nextImage = () =>
    setCurrentImage((prev) => (prev + 1) % (imageList?.length || 1));
  const prevImage = () =>
    setCurrentImage(
      (prev) => (prev - 1 + (imageList?.length || 1)) % (imageList?.length || 1)
    );

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        background: '#fff',
      }}
    >
      {hasImages && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '250px',
            overflow: 'hidden',
            marginBottom: '0.75rem',
          }}
        >
          <img
            src={imageList[currentImage]}
            alt={dealer.dealershipName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            onClick={() =>
              setLightbox({ open: true, images: imageList, index: currentImage })
            }
          />
          {imageList.length > 1 && (
            <>
              <button
                onClick={prevImage}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '5px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                }}
              >
                &lt;
              </button>
              <button
                onClick={nextImage}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '5px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                }}
              >
                &gt;
              </button>
            </>
          )}
          <div style={{ textAlign: 'center', marginTop: '5px' }}>
            {currentImage + 1}/{imageList.length} photos
          </div>
        </div>
      )}

      <h3>{dealer.dealershipName}</h3>
      <p>{dealer.address}</p>
      <p>ZIP: {dealer.zipCode}</p>
      {dealer.distance !== undefined && (
        <p style={{ fontStyle: 'italic', color: '#555' }}>
          Approx. {dealer.distance} miles from {zipRef}
        </p>
      )}
      <p>Subscription: {dealer.subscriptionType}</p>
      <p>Email: {dealer.contactEmail}</p>

      <button
        onClick={openApply}
        style={{
          marginTop: '10px',
          background: '#f59e0b',
          color: 'white',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Apply for Lease
      </button>
    </div>
  );
}

function Lightbox({ images, index, setLightbox }) {
  const [current, setCurrent] = useState(index);
  const next = () => setCurrent((prev) => (prev + 1) % images.length);
  const prev = () => setCurrent((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => setLightbox({ open: false, images: [], index: 0 })}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          fontSize: '24px',
          color: 'white',
          background: 'none',
          border: 'none',
        }}
      >
        ×
      </button>
      <button
        onClick={prev}
        style={{
          position: 'absolute',
          left: '20px',
          color: 'white',
          fontSize: '24px',
          background: 'none',
          border: 'none',
        }}
      >
        &lt;
      </button>
      <img
        src={images[current]}
        alt="Dealer"
        style={{ maxWidth: '90%', maxHeight: '90%' }}
      />
      <button
        onClick={next}
        style={{
          position: 'absolute',
          right: '20px',
          color: 'white',
          fontSize: '24px',
          background: 'none',
          border: 'none',
        }}
      >
        &gt;
      </button>
    </div>
  );
}

export default CarListings;
