import React, { useMemo, useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import Lightbox from '../components/Lightbox';

function Listings() {
  const [filtered, setFiltered] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [radius, setRadius] = useState('25');
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [applyModal, setApplyModal] = useState({ open: false, listing: null });
  const [priceSort, setPriceSort] = useState('none');

  const API_URL = 'http://localhost:5000';

  const fetchListings = async (zip = '', state = '') => {
    try {
      const query = new URLSearchParams();
      if (zip) query.append('zip', zip);
      const res = await fetch(`${API_URL}/api/listings?${query}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to fetch listings');

      let results = data;

      if (state) results = results.filter((l) => l.state === state);

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

  const visibleListings = useMemo(() => {
    const arr = [...filtered];

    const toNumber = (v) => {
      const n = Number(String(v ?? '').replace(/[$,]/g, ''));
      return Number.isFinite(n) ? n : null;
    };

    if (priceSort === 'low') {
      arr.sort((a, b) => (toNumber(a.price) ?? 999999) - (toNumber(b.price) ?? 999999));
    } else if (priceSort === 'high') {
      arr.sort((a, b) => (toNumber(b.price) ?? -1) - (toNumber(a.price) ?? -1));
    }

    return arr;
  }, [filtered, priceSort]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-grid-overlay" />

      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div className="dashboard-container">
        <h2 className="section-title">Available Listings</h2>

        {/* FILTER BAR */}
        <div className="glass-card filter-bar">
          <select value={selectedState} onChange={handleFilterChange} className="glass-select">
            <option value="">All States</option>
            {[
              'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
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
            className="glass-input"
          />

          <select value={radius} onChange={(e) => setRadius(e.target.value)} className="glass-select">
            {[5, 10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>Within {r} miles</option>
            ))}
          </select>

          <button onClick={handleZipSort} className="glass-btn">
            Search
          </button>
        </div>

        {/* SORT */}
        <div className="sort-row">
          <span>Sort by:</span>
          <select
            value={priceSort}
            onChange={(e) => setPriceSort(e.target.value)}
            className="glass-select"
          >
            <option value="none">Recommended</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
          </select>
        </div>

        {/* LISTINGS */}
        <div className="listings-grid">
          {zipInput === '' ? (
            <p className="empty-text">
              Please enter a ZIP code and click "Search" to view listings nearby.
            </p>
          ) : visibleListings.length === 0 ? (
            <p className="empty-text">
              No listings found within {radius} miles of ZIP {zipInput}.
            </p>
          ) : (
            visibleListings.map((listing) => (
              <ListingCard
                key={listing._id}
                listing={listing}
                zipRef={zipInput}
                setLightbox={setLightbox}
                openApply={() => setApplyModal({ open: true, listing })}
              />
            ))
          )}
        </div>

        {lightbox.open && (
          <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox({ open: false, images: [], index: 0 })}/>
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

  const nextImage = () =>
    setCurrentImage((prev) => (prev + 1) % listing.imageUrls.length);

  const prevImage = () =>
    setCurrentImage((prev) => (prev - 1 + listing.imageUrls.length) % listing.imageUrls.length);

  return (
    <div className="glass-card listing-card">
      {listing.imageUrls?.length > 0 && (
        <div className="listing-image-container">
          <img
            src={listing.imageUrls[currentImage]}
            alt="Property"
            className="listing-image"
            onClick={() =>
              setLightbox({ open: true, images: listing.imageUrls, index: currentImage })
            }
          />

          <button onClick={prevImage} className="image-nav left">‹</button>
          <button onClick={nextImage} className="image-nav right">›</button>

          <div className="image-counter">
            {currentImage + 1}/{listing.imageUrls.length}
          </div>
        </div>
      )}

      <h3>{listing.streetAddress}</h3>
      <p>Zip: {listing.zipCode} | State: {listing.state}</p>

      {listing.distance !== undefined && (
        <p className="distance-text">
          Approx. {listing.distance} miles from {zipRef}
        </p>
      )}

      <p>{listing.description}</p>
      <p>Contact: {listing.contactEmail}</p>
      <p className="price">${listing.price} / month</p>

      <button onClick={openApply} className="glass-btn">
        Apply for Rent
      </button>
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
    <div className="modal-overlay">
      <form onSubmit={handleSubmit} className="glass-card modal-card">
        <h2>Apply for {listing.streetAddress}</h2>

        <input
          className="glass-input"
          placeholder="Your Name"
          value={applicantName}
          onChange={(e) => setApplicantName(e.target.value)}
          required
        />

        <input
          className="glass-input"
          type="email"
          placeholder="Your Email"
          value={applicantEmail}
          onChange={(e) => setApplicantEmail(e.target.value)}
          required
        />

        <textarea
          className="glass-input"
          placeholder="Message about yourself"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          required
        />

        <div className="modal-actions">
          <button type="submit" className="glass-btn">Submit</button>
          <button type="button" onClick={onClose} className="glass-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}



export default Listings;