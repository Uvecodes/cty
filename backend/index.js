const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const emailjs = require('@emailjs/nodejs');
const app = express();
const PORT = process.env.PORT || 3001;

// Import routes
const authRoutes = require('./routes/auth');
const versesRoutes = require('./routes/verses');
const supportRoutes = require('./routes/support');
const shopRoutes = require('./routes/shop');

// ===================================================
// CORS Configuration
// ===================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5500',
  'http://localhost:5501',
  'http://localhost:3000',
].filter(Boolean);

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
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// ===================================================
// Request Logging
// ===================================================
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===================================================
// Firebase Client Config Endpoint
// Serves safe client-side config from env variables
// ===================================================
app.get('/api/firebase-config', (req, res) => {
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

// ===================================================
// EmailJS Initialization
// ===================================================
if (!process.env.EMAILJS_PRIVATE_KEY || !process.env.EMAILJS_PUBLIC_KEY) {
  console.warn('⚠️  WARNING: EmailJS credentials not found in .env file');
} else {
  emailjs.init({
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
    publicKey: process.env.EMAILJS_PUBLIC_KEY
  });
  console.log('✅ EmailJS initialized successfully');
}

// ===================================================
// Health Check
// ===================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    firebase: {
      serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'configured' : 'missing',
      clientConfig: process.env.FIREBASE_API_KEY ? 'configured' : 'missing'
    },
    emailjs: {
      serviceId: process.env.EMAILJS_SERVICE_ID ? 'configured' : 'missing',
      templateId: process.env.EMAILJS_TEMPLATE_ID ? 'configured' : 'missing',
      privateKey: process.env.EMAILJS_PRIVATE_KEY ? 'configured' : 'missing',
      publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'configured' : 'missing'
    }
  });
});

// ===================================================
// Send Welcome Email
// ===================================================
app.post('/send-welcome', async (req, res) => {
  console.log('📧 Received welcome email request:', req.body);
  const { email, displayName } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
    console.error('❌ EmailJS not configured - check .env file');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      {
        displayName: displayName || 'there',
        email: email
      }
    );

    console.log('✅ Welcome email sent to', email);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Email error:', err);

    let errorMessage = err.message || 'Failed to send email';
    if (err.status === 403 && err.text && err.text.includes('non-browser')) {
      errorMessage = 'Enable non-browser API calls in EmailJS dashboard';
      console.error('⚠️  Go to https://dashboard.emailjs.com → Account → API Keys → Enable "Allow non-browser API calls"');
    }

    res.status(500).json({ error: 'Failed to send email', details: errorMessage });
  }
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
  console.log(`   - EMAILJS:                  ${process.env.EMAILJS_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - RESEND_API_KEY:           ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`\n📍 Allowed CORS origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log(`\n💡 Waiting for requests...\n`);
});