import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/LoginHeader.css';

function Header({ showTagline = false }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logoSrc = process.env.PUBLIC_URL + '/BlockRentLogo2.png';

  return (
    <header
      className={`blockrent-header 
        blockrent-header--login
        ${scrolled ? 'blockrent-header--scrolled' : ''}
      `}
    >
      {/* Glow */}
      <div className="blockrent-header-login-glow" />

      {/* Logo */}
      <Link to="/" className="blockrent-header-logo-link">
        <img
          src={logoSrc}
          alt="BlockRent Logo"
          className="blockrent-header-logo"
        />
      </Link>

      {/* Tagline (ONLY when enabled) */}
      {showTagline && (
        <div className="blockrent-header-tagline">
          Subsidize Credit Scores With Bitcoin Savings
        </div>
      )}
    </header>
  );
}

export default Header;