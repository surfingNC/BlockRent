import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}
    >
      {/* === Logo (clickable, unchanged) === */}
      <Link
        to="/"
        style={{
          position: 'absolute',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
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

      {/* === Centered Tagline === */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '1.25rem',   // larger text
          fontWeight: '700',     // bold
          color: '#000000',      // black
          letterSpacing: '0.4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none', // doesn’t block logo click
        }}
      >
        Replace Abritrary Credit Scores With Bitcoin Savings
      </div>
    </header>
  );
}

export default Header;
