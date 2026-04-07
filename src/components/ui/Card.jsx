// Card.jsx
import React from 'react';
import './ui.css';

export default function Card({ children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {children}
    </div>
  );
}