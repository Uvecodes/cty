// API Client for backend communication
// Handles API calls, token management, and error handling

const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://localhost:3001/api'
  : 'https://cty-7cyi.onrender.com/api';

/**
 * Get current user's Firebase ID token
 */
async function getAuthToken() {
  try {
    if (!firebase || !firebase.auth) {
      throw new Error('Firebase is not initialized');
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
      return null;
    }
    
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await getAuthToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization header if token is available
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };
  
  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return { success: true, data: await response.text() };
    }
    
    const data = await response.json();
    
    // Handle error responses
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * API methods
 */
const api = {
  /**
   * Register a new user
   */
  async register(email, password, name, age) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, age })
    });
  },
  
  /**
   * Login user
   */
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  
  /**
   * Request password reset
   */
  async forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
  
  /**
   * Verify current token
   */
  async verifyToken() {
    return apiRequest('/auth/verify', {
      method: 'GET'
    });
  },
  
  /**
   * Logout (if needed for server-side cleanup)
   */
  async logout() {
    return apiRequest('/auth/logout', {
      method: 'POST'
    });
  },
  
  /**
   * Get today's verse for authenticated user
   */
  async getTodayVerse() {
    return apiRequest('/verses/today', {
      method: 'GET'
    });
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, apiRequest, getAuthToken };
}
