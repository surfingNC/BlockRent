import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.jsx';
import Register from './pages/Register.js';
import './styles/index.css';
import VerifyEmail from './pages/VerifyEmail.js';
import ListingForm from './pages/ListingForm.jsx';
import Listings from './pages/Listings.jsx';
import Subscribe from './pages/Subscribe.jsx'; // ✅ Add this line

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/list-your-home" element={<ListingForm />} />
      <Route path="/listings" element={<Listings />} />
      <Route path="/subscribe" element={<Subscribe />} /> {/* ✅ Add this line */}
    </Routes>
  );
}

export default App;
