import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import PrePurchase from './pages/PrePurchase';
import PostPurchase from './pages/PostPurchase';
import ImpactDashboard from './pages/ImpactDashboard';
import MobileCamera from './pages/MobileCamera';
import MobileScanner from './pages/MobileScanner';

import api, { API_BASE_URL } from '@/lib/api';

const API = API_BASE_URL;

export { api };

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pre-purchase"
            element={
              <ProtectedRoute>
                <PrePurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post-purchase"
            element={
              <ProtectedRoute>
                <PostPurchase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/impact"
            element={
              <ProtectedRoute>
                <ImpactDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/mobile-upload/:sessionId" element={<MobileCamera />} />
          <Route path="/mobile-scanner/:sessionId" element={<MobileScanner />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
