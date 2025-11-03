import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.jsx';
import Register from './pages/Register.js';
import VerifyEmail from './pages/VerifyEmail.js';
import ListingForm from './pages/ListingForm.jsx';
import Listings from './pages/Listings.jsx';
import Subscribe from './pages/Subscribe.jsx';
import ManageListings from './pages/ManageListings.jsx';
import CarListings from './pages/CarListings.jsx';
import ListYourDealership from './pages/ListYourDealership.jsx';
import DealerDashboard from './pages/DealerDashboard.jsx';   
import ProtectedRoute from './components/ProtectedRoute.jsx';
import './styles/index.css';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/list-your-home"
        element={
          <ProtectedRoute>
            <ListingForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/listings"
        element={
          <ProtectedRoute>
            <Listings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/car-listings"
        element={
          <ProtectedRoute>
            <CarListings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/list-your-dealership"
        element={
          <ProtectedRoute>
            <ListYourDealership />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dealer-dashboard"
        element={
          <ProtectedRoute>
            <DealerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subscribe"
        element={
          <ProtectedRoute>
            <Subscribe />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-listings"
        element={
          <ProtectedRoute>
            <ManageListings />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
