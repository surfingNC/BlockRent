// Button.jsx
import React from 'react';
import './ui.css';

export default function Button({
  children,
  className = '',
  ...props
}) {
  return (
    <button
      className={`glass-btn ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}