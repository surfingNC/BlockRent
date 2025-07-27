// src/components/DashboardHeader.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

function DashboardHeader({ username }) {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    const token = localStorage.getItem('token');
    console.log('🪪 Token at logo click:', token);

    if (token) {
      try {
        const decoded = jwtDecode(token);
        const now = Math.floor(Date.now() / 1000);
        console.log('⏱️ Now:', now, '| Token Exp:', decoded.exp);

        if (decoded.exp && decoded.exp > now) {
          navigate('/dashboard');
          return;
        } else {
          console.warn('⚠️ Token expired.');
        }
      } catch (err) {
        console.error('❌ Failed to decode token:', err);
      }
    }

    navigate('/login');
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      <img
        src={process.env.PUBLIC_URL + '/BlockRentLogo2.png'}
        alt="BlockRent Logo"
        onClick={handleLogoClick}
        style={{
          height: '40px',
          width: 'auto',
          transform: 'scale(3.5)',
          transformOrigin: 'left center',
          display: 'block',
          cursor: 'pointer',
        }}
      />
    </header>
  );
}

export default DashboardHeader;
