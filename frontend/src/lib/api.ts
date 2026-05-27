import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token if available in local storage / authStore
api.interceptors.request.use(
  (config) => {
    const authState = localStorage.getItem('auth-storage');
    if (authState) {
      try {
        const parsed = JSON.parse(authState);
        const token = parsed?.state?.token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors globally via Sonner toast
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred.';
    const status = error.response?.status;

    if (status === 500) {
      toast.error(`Server Error (500): ${message}`);
    } else if (status === 401) {
      toast.error('Session expired. Please log in again.');
      // Optionally redirect to login or clear auth state
    } else if (status === 403) {
      toast.error('Forbidden: You do not have permission to access this resource.');
    } else if (error.code === 'ERR_NETWORK') {
      // Don't spam toasts for network disconnect if hooks handle fallback, but log it
      console.warn('API is unreachable. Running in offline/demo mode.');
    } else if (status === 404) {
      // Ignore 404s globally (expected for things like checking if a work order exists)
    } else {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);
