// src/pages/ManageListings.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';

function ManageListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(
          'http://localhost:5000/api/managelistings/my-listings',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error('Failed to fetch listings');

        const data = await res.json();
        setListings(data);
      } catch (err) {
        console.error(err);
        setError('Error loading listings');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [token]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this listing?'
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/managelistings/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error('Failed to delete listing');

      setListings((prev) => prev.filter((l) => l._id !== id));
    } catch (err) {
      console.error(err);
      alert('Error deleting listing');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <DashboardHeader />
        <div className="dashboard-main">
          <p>Loading your listings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <DashboardHeader />
        <div className="dashboard-main">
          <p style={{ color: 'red' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      {/* BTC PARTICLES */}
      <div className="btc-particles">
        {[...Array(12)].map((_, i) => (
          <span key={i} className="btc-particle">₿</span>
        ))}
      </div>

      {/* Glow + Grid */}
      <div className="dashboard-glow glow-1" />
      <div className="dashboard-glow glow-2" />
      <div className="dashboard-grid-overlay" />

      <DashboardHeader username={localStorage.getItem('username') || ''} />

      <div className="dashboard-main">

        <h2 className="section-title">Manage Your Listings</h2>

        {listings.length === 0 ? (
          <div className="glass-card center">
            <p>You have no listings yet.</p>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => (
              <div key={listing._id} className="glass-card listing-card">

                <h3>{listing.streetAddress}</h3>

                <p className="muted">
                  {listing.state} • {listing.zipCode}
                </p>

                <p>{listing.description}</p>

                <p className="muted">
                  Contact: {listing.contactEmail}
                </p>

                {listing.images?.length > 0 && (
                  <img
                    src={listing.images[0]}
                    alt="Listing"
                    className="listing-image"
                  />
                )}

                <div className="listing-actions">
                  <button
                    className="glass-btn danger"
                    onClick={() => handleDelete(listing._id)}
                  >
                    Delete
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

        <div className="center" style={{ marginTop: '2rem' }}>
          <button
            className="glass-btn primary"
            onClick={() => navigate('/list-your-home')}
          >
            + Add New Listing
          </button>
        </div>

      </div>
    </div>
  );
}

export default ManageListings;