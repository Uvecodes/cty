// ===================================================
// API Base URL — auto-detects environment
// ===================================================
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://cty-7cyi.onrender.com';


// ===================================================
// Firebase Config — fetched from your backend
// ===================================================
async function initFirebase() {
  // If Firebase is already initialized, notify and return
  if (firebase.apps.length) {
    window.dispatchEvent(new CustomEvent('firebase-ready'));
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/firebase-config`);

    if (!response.ok) {
      throw new Error('Failed to fetch Firebase config');
    }

    const config = await response.json();
    firebase.initializeApp(config);
    window.dispatchEvent(new CustomEvent('firebase-ready'));
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    showToast('App failed to initialize. Please refresh.', 'error');
  }
}


// ===================================================
// Toast Notification System
// ===================================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  if (toast.timeoutId) clearTimeout(toast.timeoutId);

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  toast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}


// ===================================================
// Register Function
// ===================================================
async function register(event) {
  event.preventDefault();

  if (!navigator.onLine) {
    showToast('Sorry, you are currently offline');
    return;
  }

  const name = document.getElementById('fullName').value.trim();
  const age = document.getElementById('age').value;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  // Validation
  if (!name || !age || !email || !password || !confirmPassword) {
    showToast('Please fill all fields.');
    return;
  }
  if (password !== confirmPassword) {
    showToast('Passwords do not match.');
    return;
  }
  if (age < 4 || age > 17) {
    showToast('Age must be between 4 and 17.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, age: parseInt(age) })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Registration failed');

    // Sign in with custom token from backend
    const auth = firebase.auth();
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const userCredential = await auth.signInWithCustomToken(data.token);

    // Trigger welcome email (non-blocking)
    fetch(`${API_BASE}/send-welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userCredential.user.email, displayName: name })
    }).catch(() => {}); // Silent fail — email is non-critical

    showToast('Registered and logged in!');
    setTimeout(() => {
      window.location.href = '../dashboard-files/dashboard.html';
    }, 1500);

  } catch (error) {
    console.error('Registration error:', error);
    showToast(error.message || 'Registration failed. Please try again.', 'error');
  }
}


// ===================================================
// Login Function
// ===================================================
async function login(event) {
  event.preventDefault();

  if (!navigator.onLine) {
    showToast('Sorry, you are currently offline');
    return;
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Login failed');

    // Sign in with custom token from backend
    const auth = firebase.auth();
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithCustomToken(data.token);

    showToast('Logged in!', 'success');
    window.location.href = '../dashboard-files/dashboard.html';

  } catch (error) {
    console.error('Login error:', error);
    showToast(error.message || 'Login failed. Please check your credentials.', 'error');
  }
}


// ===================================================
// Forgot Password Function
// ===================================================
async function forgotPassword() {
  const email = prompt('Please enter your email address to reset your password:');

  if (!email) {
    showToast('Email is required');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Password reset failed');

    showToast(data.message || 'Password reset email sent!');
  } catch (error) {
    console.error('Password reset error:', error);
    showToast(error.message || 'An error occurred. Please try again.', 'error');
  }
}


// ===================================================
// Logout Function
// ===================================================
async function logout() {
  try {
    await firebase.auth().signOut();
    showToast('Logged out!');
    window.location.href = '../index.html';
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Logout failed. Please try again.', 'error');
  }
}


// ===================================================
// Auth State Monitor
// ===================================================
function setupAuthMonitor() {
  firebase.auth().onAuthStateChanged((user) => {
    const status = document.getElementById('userInfo');
    if (user) {
      if (status) status.innerText = `Logged in as: ${user.email}`;
    } else {
      if (window.location.pathname.includes('dashboard')) {
        window.location.href = '../index.html';
      }
    }
  });
}


// ===================================================
// Event Listeners
// ===================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Firebase first (fetches config from backend)
  await initFirebase();

  // Then set up auth monitor and form listeners
  setupAuthMonitor();

  const signupForm = document.getElementById('signupForm');
  if (signupForm) signupForm.addEventListener('submit', register);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', login);

  const forgotPasswordLink = document.getElementById('forgotPassword');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      forgotPassword();
    });
  }
});