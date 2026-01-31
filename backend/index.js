// Minimal email backend with EmailJS
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

// CORS configuration
// const frontendUrl = process.env.FRONTEND_URL || '*';
// app.use(cors({
//   origin: frontendUrl === '*' ? true : frontendUrl,
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(express.json());


// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,                    // Production URL from env variable
  'http://127.0.0.1:5500',                     // Local dev (Live Server)
  'http://localhost:5500',                      // Local dev (alternate)
  'http://localhost:3000',                      // Local dev (if using a dev server)
].filter(Boolean);                             // Removes undefined/null entries

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, same-origin, etc.)
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

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());





// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/verses', versesRoutes);

// Initialize EmailJS with credentials from environment variables
if (!process.env.EMAILJS_PRIVATE_KEY || !process.env.EMAILJS_PUBLIC_KEY) {
  console.warn('⚠️  WARNING: EmailJS credentials not found in .env file');
  console.warn('⚠️  Email sending will fail. Please check your .env file.');
} else {
  emailjs.init({
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
    publicKey: process.env.EMAILJS_PUBLIC_KEY
  });
  console.log('✅ EmailJS initialized successfully');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    emailjs: {
      serviceId: process.env.EMAILJS_SERVICE_ID ? 'configured' : 'missing',
      templateId: process.env.EMAILJS_TEMPLATE_ID ? 'configured' : 'missing',
      privateKey: process.env.EMAILJS_PRIVATE_KEY ? 'configured' : 'missing',
      publicKey: process.env.EMAILJS_PUBLIC_KEY ? 'configured' : 'missing'
    }
  });
});

// POST /send-welcome
app.post('/send-welcome', async (req, res) => {
  console.log('📧 Received welcome email request:', req.body);
  const { email, displayName } = req.body;

  // Basic validation
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Validate EmailJS is configured
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
    console.error('❌ Full error details:', JSON.stringify(err, null, 2));
    
    // Provide helpful message for 403 error
    let errorMessage = err.message || 'Failed to send email';
    if (err.status === 403 && err.text && err.text.includes('non-browser')) {
      errorMessage = 'API calls disabled for non-browser applications. Please enable in EmailJS dashboard: Account > API Keys > Enable for non-browser';
      console.error('\n⚠️  SOLUTION: Go to https://dashboard.emailjs.com → Account → API Keys → Enable "Allow non-browser API calls"\n');
    }
    
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: errorMessage,
      emailjsError: err.status === 403 ? 'Enable non-browser API in EmailJS dashboard' : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📧 Email service: ${process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🔐 Auth routes: /api/auth/*`);
  console.log(`\n📋 Environment Check:`);
  console.log(`   - PORT: ${PORT}`);
  console.log(`   - FRONTEND_URL: ${process.env.FRONTEND_URL || 'Not set (allowing all origins)'}`);
  console.log(`   - FIREBASE_SERVICE_ACCOUNT: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`\n💡 Waiting for requests...\n`);
});



// backend/index.js
// require('dotenv').config();
// const { Resend } = require('resend');
// const resend = new Resend(process.env.RESEND_API_KEY); // ← from .env, secure

// app.post('/send-welcome', async (req, res) => {
//   const { email, displayName } = req.body;

//   // ... validation ...

//   await resend.emails.send({
//     from: 'onrender.com', // verify this in Resend
//     to: email,
//     subject: 'Welcome to Catch Them Young!',
//     html: `<p>Hi ${displayName}! ... </p>`
//   });

//   res.json({ success: true });
// });