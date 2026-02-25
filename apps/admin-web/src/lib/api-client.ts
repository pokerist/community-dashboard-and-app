/**
 * ===========================================
 * API CLIENT CONFIGURATION
 * ===========================================
 * 
 * Centralized API client with:
 * - Base URL configuration from environment
 * - Request/Response interceptors
 * - Error handling
 * - Authentication token management
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Backend in this workspace exposes routes at root (no global /api prefix).
// Can be overridden via VITE_API_BASE_URL.
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

/**
 * Create Axios instance with default configuration
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Request Interceptor
 * - Adds authentication token to all requests
 * - Logs requests in development
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`🔵 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * - Handles common response scenarios
 * - Logs responses in development
 * - Handles authentication errors
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (import.meta.env.DEV) {
      console.log(`🟢 API Response: ${response.config.url}`, response.data);
    }

    return response;
  },
  (error: AxiosError) => {
    // Log errors with useful details (avoid opaque "Object" console output)
    const status = error.response?.status;
    const data = error.response?.data as any;
    const backendMessage = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || data?.error;
    console.error(
      '❌ API Error:',
      {
        method: error.config?.method?.toUpperCase?.(),
        url: error.config?.url,
        status,
        message: backendMessage || error.message,
        data,
      },
    );

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Clear token and let the app decide how to handle re-authentication.
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    // Handle server errors
    if (error.response?.status === 500) {
      console.error('🔴 Server Error: Please contact support');
    }

    return Promise.reject(error);
  }
);

/**
 * Helper function to handle API errors consistently
 */
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;

    if (!axiosError.response || axiosError.code === 'ERR_NETWORK') {
      return `Cannot reach backend at ${API_BASE_URL}. Start the backend server and verify VITE_API_BASE_URL.`;
    }
    
    if (axiosError.response?.data?.message) {
      return Array.isArray(axiosError.response.data.message)
        ? axiosError.response.data.message.join(', ')
        : axiosError.response.data.message;
    }
    
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Helper function to set authentication token
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

/**
 * Helper function to remove authentication token
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

/**
 * Helper function to check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};

export default apiClient;
