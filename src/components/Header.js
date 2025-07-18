// src/components/Header.js
import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
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
      <Link to="/">
        <img
          src={process.env.PUBLIC_URL + '/BlockRentLogo2.png'}
          alt="BlockRent Logo"
          style={{
            height: '40px',
            width: 'auto',
            transform: 'scale(3.5)',
            transformOrigin: 'left center',
            display: 'block',
          }}
        />
      </Link>
    </header>
  );
}

export default Header;