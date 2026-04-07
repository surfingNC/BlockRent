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
    <header className="blockrent-header blockrent-header--login">
      <div className="blockrent-header-logo-link">
        <img
          src={process.env.PUBLIC_URL + '/BlockRentLogo2.png'}
          alt="BlockRent Logo"
          onClick={handleLogoClick}
          className="blockrent-header-logo"
        />
      </div>
    </header>
  );
}

export default DashboardHeader;