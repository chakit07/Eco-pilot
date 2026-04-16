import axios from 'axios';

const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  
  // If we are on localhost, default to localhost:8000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return envUrl || 'http://localhost:8000';
  }

  // If envUrl is provided and is NOT a localhost URL, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // Fallback: Use the current protocol and hostname.
  // We use window.location.host which includes the port if present.
  const protocol = window.location.protocol;
  // If the protocol is https, we definitely shouldn't force http
  return `${protocol}//${window.location.host}`;
};

export const BACKEND_URL = getBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
