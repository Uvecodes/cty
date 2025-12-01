// Minimal email backend with EmailJS
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const emailjs = require('@emailjs/nodejs');

const app = express();
const PORT = process.env.PORT || 3001;

// // Security: Only allow your frontend origin
// app.use(cors({
//   origin: process.env.FRONTEND_ORIGIN
// }));

// CORS - allow all origins in development for easier testing
app.use(cors({
  origin: true, // Allow all origins (change this in production)
  credentials: false
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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

app.listen(PORT, () => {
  console.log(`📧 Email backend running on http://localhost:${PORT}`);
  console.log(`📝 Using EmailJS for email sending`);
  console.log(`\n📋 Environment Check:`);
  console.log(`   - PORT: ${PORT}`);
  console.log(`   - EMAILJS_SERVICE_ID: ${process.env.EMAILJS_SERVICE_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - EMAILJS_TEMPLATE_ID: ${process.env.EMAILJS_TEMPLATE_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - EMAILJS_PRIVATE_KEY: ${process.env.EMAILJS_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - EMAILJS_PUBLIC_KEY: ${process.env.EMAILJS_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`\n💡 Waiting for requests...\n`);
});