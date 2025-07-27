import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  console.log('🔐 Raw token:', token);

  if (!token) {
    console.warn('⛔ No token found. Redirecting to login.');
    return <Navigate to="/login" replace />;
  }

  try {
    const decoded = jwtDecode(token);
    console.log('🔍 Decoded token:', decoded);

    const now = Math.floor(Date.now() / 1000);
    const exp = decoded?.exp;

    if (!exp || exp < now) {
      console.warn('⛔ Token expired or missing exp. Redirecting to login.');
      localStorage.clear();
      return <Navigate to="/login" replace />;
    }

    // ✅ Token is valid — allow access
    return children;
  } catch (err) {
    console.error('⛔ Invalid token format or decode failed:', err);
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }
};

export default ProtectedRoute;
