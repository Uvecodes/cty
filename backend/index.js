const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const app = express();
const PORT = process.env.PORT || 3001;

// Import routes
const authRoutes = require('./routes/auth');
const versesRoutes = require('./routes/verses');
const supportRoutes = require('./routes/support');
const shopRoutes = require('./routes/shop');
const pushRoutes = require('./routes/push');

// ===================================================
// CORS Configuration
// ===================================================
const allowedOrigins = [
  'https://tenderoots.com',
  process.env.FRONTEND_URL,
  
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5500',
  'http://localhost:5501',
  'http://localhost:3000',
].filter(Boolean);

// Trust Render's reverse proxy so req.ip reflects the real client IP
// Without this, all requests appear to come from the same internal proxy IP,
// which breaks per-IP rate limiting (all users share one counter).
app.set('trust proxy', 1);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error('CORS blocked for origin:', origin);
      callback(new Error('Origin not allowed: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Cron-Secret']
}));

app.options('*', cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ===================================================
// Request Logging
// ===================================================
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

// ===================================================
// Firebase Client Config Endpoint
// Serves safe client-side config from env variables
// ===================================================
app.get('/api/firebase-config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  const clientConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

  // Check for missing values
  const missing = Object.entries(clientConfig)
    .filter(([, val]) => !val)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('Missing Firebase client config values:', missing);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  res.json(clientConfig);
});

// ===================================================
// Mount Routes
// ===================================================
app.use('/api/auth', authRoutes);
app.use('/api/verses', versesRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/push', pushRoutes);

// ===================================================
// Health Check
// ===================================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ===================================================
// Error Handling
// ===================================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ===================================================
// Start Server
// ===================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`\n📋 Environment Check:`);
  console.log(`   - FRONTEND_URL:              ${process.env.FRONTEND_URL || '❌ Not set'}`);
  console.log(`   - FIREBASE_SERVICE_ACCOUNT_KEY: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - FIREBASE_CLIENT_CONFIG:   ${process.env.FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - RESEND_API_KEY:           ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - VAPID_PUBLIC_KEY:         ${process.env.VAPID_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - VAPID_PRIVATE_KEY:        ${process.env.VAPID_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - CRON_SECRET:              ${process.env.CRON_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`\n📍 Allowed CORS origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log(`\n💡 Waiting for requests...\n`);
});