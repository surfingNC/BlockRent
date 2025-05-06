import React from 'react';
import LoanForm from '../components/LoanForm';

function Dashboard({ username }) {
  return (
    <div className="app-container">
      <h1>Welcome, {username}!</h1>
      <p>Use the form below to apply for a Bitcoin-backed loan.</p>
      <LoanForm />
    </div>
  );
}

export default Dashboard;
