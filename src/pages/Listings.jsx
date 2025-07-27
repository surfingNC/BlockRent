import React, { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';

function Listings() {
  const [filtered, setFiltered] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [radius, setRadius] = useState('25');
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [applyModal, setApplyModal] = useState({ open: false, listing: null });

  const API_URL = 'http://localhost:5000';

  const fetchListings = async (zip = '', state = '') => {
    try {
      const query = new URLSearchParams();
      if (zip) query.append('zip', zip);
      const res = await fetch(`${API_URL}/api/listings?${query}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch listings');

      let results = data;

      if (state) {
        results = results.filter((l) => l.state === state);
      }

      // Filter by distance radius
      results = results.filter(
        (l) => typeof l.distance === 'number' && l.distance <= parseInt(radius)
      );

      setFiltered(results);
    } catch (err) {
      console.error('Error fetching listings:', err);
      alert(err.message || 'Failed to load listings');
    }
  };

  const handleFilterChange = (e) => {
    const state = e.target.value;
    setSelectedState(state);
    if (zipInput.match(/^\d{5}$/)) {
      fetchListings(zipInput, state);
    }
  };

  const handleZipSort = () => {
    if (!zipInput.match(/^\d{5}$/)) {
      alert('Please enter a valid 5-digit ZIP code.');
      return;
    }
    fetchListings(zipInput, selectedState);
  };

  const handleApplySubmit = async (applicantName, applicantEmail, messageText, listing) => {
    try {
      if (!window.unisat) return alert('UniSat Wallet not installed.');
      const accounts = await window.unisat.requestAccounts();
      if (!accounts || accounts.length === 0) return alert('No UniSat accounts found.');
      const balance = await window.unisat.getBalance();

      const token = localStorage.getItem('token');

      const res = await fetch(`${API_URL}/api/listings/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId: listing._id,
          applicantName,
          walletAddress: accounts[0],
          balance: balance.total,
          applicantEmail,
          messageText,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Application failed');
      alert('Application submitted successfully.');
      setApplyModal({ open: false, listing: null });
    } catch (err) {
      console.error('Apply error:', err);
      alert(err.message);
    }
  };

  return (
    <div>
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div style={{ padding: '2rem' }}>
        <h2>Available Listings</h2>

        {/* Filter UI */}
        <div style={{ marginBottom: '1.5rem' }}>
          <select
            value={selectedState}
            onChange={handleFilterChange}
            style={{ padding: '0.5rem', fontSize: '1rem', marginRight: '1rem' }}
          >
            <option value="">All States</option>
            {[ 'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
              'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
              'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
              'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
              'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
            ].map((abbr) => (
              <option key={abbr} value={abbr}>{abbr}</option>
            ))}
          </select>

          <input
            type="text"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            placeholder="ZIP (e.g. 28405)"
            style={{ padding: '0.5rem', marginRight: '0.5rem', width: '100px' }}
          />

          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            style={{ padding: '0.5rem', marginRight: '0.5rem' }}
          >
            {[5, 10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>
                Within {r} miles
              </option>
            ))}
          </select>

          <button onClick={handleZipSort} style={{ padding: '0.5rem 1rem' }}>
            Search
          </button>
        </div>

        {/* Listings */}
        {zipInput === '' ? (
          <p style={{ marginTop: '2rem', color: '#888' }}>
            Please enter a ZIP code and click "Search" to view listings nearby.
          </p>
        ) : (
          <>
            {filtered.length === 0 ? (
              <p style={{ marginTop: '2rem', color: '#888' }}>
                No listings found within {radius} miles of ZIP {zipInput}
                {selectedState && ` in ${selectedState}`}.
              </p>
            ) : (
              filtered.map((listing, index) => (
                <div key={listing._id}>
                  <ListingCard
                    listing={listing}
                    zipRef={zipInput}
                    setLightbox={setLightbox}
                    openApply={() => setApplyModal({ open: true, listing })}
                  />
                  {index < filtered.length - 1 && <hr style={{ margin: '2rem 0' }} />}
                </div>
              ))
            )}
          </>
        )}

        {lightbox.open && (
          <Lightbox
            images={lightbox.images}
            index={lightbox.index}
            setLightbox={setLightbox}
          />
        )}
        {applyModal.open && (
          <ApplyForm
            listing={applyModal.listing}
            onSubmit={handleApplySubmit}
            onClose={() => setApplyModal({ open: false, listing: null })}
          />
        )}
      </div>
    </div>
  );
}

function ListingCard({ listing, zipRef, setLightbox, openApply }) {
  const [currentImage, setCurrentImage] = useState(0);

  const nextImage = () => setCurrentImage((prev) => (prev + 1) % listing.imageUrls.length);
  const prevImage = () => setCurrentImage((prev) => (prev - 1 + listing.imageUrls.length) % listing.imageUrls.length);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', backgroundColor: '#fff' }}>
      {listing.imageUrls && listing.imageUrls.length > 0 && (
        <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden' }}>
          <img
            src={listing.imageUrls[currentImage]}
            alt="Property"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => setLightbox({ open: true, images: listing.imageUrls, index: currentImage })}
          />
          <button onClick={prevImage} style={{ position: 'absolute', top: '50%', left: '5px' }}>&lt;</button>
          <button onClick={nextImage} style={{ position: 'absolute', top: '50%', right: '5px' }}>&gt;</button>
          <div style={{ textAlign: 'center', marginTop: '5px' }}>
            {currentImage + 1}/{listing.imageUrls.length} photos
          </div>
        </div>
      )}
      <h3>{listing.streetAddress}</h3>
      <p>Zip: {listing.zipCode} | State: {listing.state}</p>
      {listing.distance !== undefined && !isNaN(listing.distance) && (
        <p style={{ fontStyle: 'italic', color: '#555' }}>
          Approx. {listing.distance} miles from {zipRef}
        </p>
      )}
      <p>{listing.description}</p>
      <p>Contact: {listing.contactEmail}</p>
      <p>Price: ${listing.price} / month</p>
      <button onClick={openApply} style={{ marginTop: '10px' }}>Apply for Rent</button>
    </div>
  );
}

function ApplyForm({ listing, onSubmit, onClose }) {
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(applicantName, applicantEmail, messageText, listing);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <form onSubmit={handleSubmit}
        style={{ background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
        <h2>Apply for {listing.streetAddress}</h2>
        <input type="text" placeholder="Your Name" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required />
        <input type="email" placeholder="Your Email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} required />
        <textarea placeholder="Message about yourself" value={messageText} onChange={(e) => setMessageText(e.target.value)} required></textarea>
        <button type="submit">Submit Application</button>
        <button type="button" onClick={onClose} style={{ marginLeft: '10px' }}>Cancel</button>
      </form>
    </div>
  );
}

function Lightbox({ images, index, setLightbox }) {
  const [current, setCurrent] = useState(index);

  const next = () => setCurrent((prev) => (prev + 1) % images.length);
  const prev = () => setCurrent((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <button onClick={() => setLightbox({ open: false, images: [], index: 0 })}
        style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '24px', color: 'white', background: 'none', border: 'none' }}>×</button>
      <button onClick={prev}
        style={{ position: 'absolute', top: '50%', left: '20px', fontSize: '24px', color: 'white', background: 'none', border: 'none' }}>&lt;</button>
      <img src={images[current]} alt="Property" style={{ maxWidth: '90%', maxHeight: '90%' }} />
      <button onClick={next}
        style={{ position: 'absolute', top: '50%', right: '20px', fontSize: '24px', color: 'white', background: 'none', border: 'none' }}>&gt;</button>
    </div>
  );
}

export default Listings;
