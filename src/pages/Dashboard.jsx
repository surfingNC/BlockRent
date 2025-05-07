import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import LoanForm from '../components/LoanForm';

function Dashboard() {
  const location = useLocation();
  const username = location.state?.username;

  if (!username) return <Navigate to="/" />;

  return (
    <div className="app-container">
      <h1>Welcome, {username}!</h1>
      <p>Use the form below to apply for a Bitcoin-backed loan.</p>
      <LoanForm />
    </div>
  );
}

export default Dashboard;