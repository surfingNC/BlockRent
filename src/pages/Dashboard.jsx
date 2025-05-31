// src/pages/Dashboard.js
import React, { useEffect, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import LoanForm from '../components/LoanForm';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [username, setUsername] = useState(location.state?.username || sessionStorage.getItem('username'));
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');

    if (!token) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    fetch('http://localhost:5000/api/protected/dashboard', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        console.log('Protected data:', data);
        setAuthorized(true);
        setLoading(false);
      })
      .catch(() => {
        sessionStorage.clear(); // Clear session if token is invalid
        setAuthorized(false);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!authorized) return <Navigate to="/login" replace />;

  return (
    <div className="app-container">
      <h1>Welcome, {username || 'user'}!</h1>
      <p>Use the form below to apply for a Bitcoin-backed lease.</p>
      <LoanForm />
    </div>
  );
}

export default Dashboard;
