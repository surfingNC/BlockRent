// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader.js';
import '../styles/index.css';

function Dashboard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
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
        backgroundImage: `url(${process.env.PUBLIC_URL + '/backgroundFiller.PNG'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <DashboardHeader username={username} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 72px)',
        }}
      >
        <div className="app-container">
          <div
            style={{
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              alignItems: 'center',
              zIndex: 1,
            }}
          >
            <button onClick={() => navigate('/listings')} className="dashboard-button browse">
              Browse Listings
            </button>

            <button onClick={() => navigate('/list-your-home')} className="dashboard-button list">
              List Your Home for Rent
            </button>

            <button onClick={handleLogout} className="dashboard-button logout">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;