// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/api/protected/dashboard`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setAuthorized(true);
        setLoading(false);
      })
      .catch(() => {
        sessionStorage.clear();
        setAuthorized(false);
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;
  if (!authorized) return <Navigate to="/login" replace />;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#f5f5f5',
      }}
    >
      <button
        onClick={() => navigate('/listings')}
        style={{
          padding: '12px 24px',
          backgroundColor: '#4CAF50',
          color: 'white',
          fontSize: '18px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          width: '220px',
        }}
      >
        Browse Listings
      </button>

      <button
        onClick={() => navigate('/list-your-home')}
        style={{
          padding: '12px 24px',
          backgroundColor: '#2196F3',
          color: 'white',
          fontSize: '18px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          width: '220px',
        }}
      >
        List Your Home for Rent
      </button>

      <button
        onClick={handleLogout}
        style={{
          marginTop: '20px',
          padding: '8px 16px',
          backgroundColor: 'black',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;
