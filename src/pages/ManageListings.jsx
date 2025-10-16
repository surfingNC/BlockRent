// src/pages/ManageListings.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader.js';

function ManageListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/managelistings/my-listings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
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
    const confirm = window.confirm('Are you sure you want to delete this listing?');
    if (!confirm) return;

    try {
      const res = await fetch(`http://localhost:5000/api/managelistings/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to delete listing');
      setListings((prev) => prev.filter((l) => l._id !== id));
      alert('Listing deleted successfully');
    } catch (err) {
      console.error(err);
      alert('Error deleting listing');
    }
  };

  if (loading) return <p>Loading your listings...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL + '/backgroundFiller.PNG'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <DashboardHeader username={localStorage.getItem('username') || ''} />
      <div className="app-container">
        <div className="login-box" style={{ maxWidth: '800px', margin: '2rem auto' }}>
          <h2 style={{ textAlign: 'center' }}>Manage Your Listings</h2>

          {listings.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>
              You have no listings yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {listings.map((listing) => (
                <li
                  key={listing._id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    padding: '1rem',
                    background: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <h3>{listing.streetAddress}</h3>
                  <p>
                    <strong>State:</strong> {listing.state} | <strong>ZIP:</strong>{' '}
                    {listing.zipCode}
                  </p>
                  <p>{listing.description}</p>
                  <p>
                    <strong>Contact:</strong> {listing.contactEmail}
                  </p>
                  {listing.images && listing.images.length > 0 && (
                    <img
                      src={listing.images[0]}
                      alt="Listing"
                      style={{
                        width: '100%',
                        maxHeight: '200px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                  )}

                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(listing._id)}
                      style={{
                        backgroundColor: '#cc0000',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button
              onClick={() => navigate('/list-your-home')}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              + Add New Listing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManageListings;
