# EmailJS Backend Integration Outline (Secure)

## Overview
This outline explains how to integrate EmailJS in your Node.js backend server, keeping all API keys secure on the server side. The frontend will continue to call your backend endpoint, but now it will use EmailJS instead of Resend.

---

## Step 1: EmailJS Account Setup

### 1.1 Create Account
- Visit: https://www.emailjs.com
- Sign up for free account (200 emails/month free tier)

### 1.2 Add Email Service
- Go to **Email Services** in dashboard
- Click **Add New Service**
- Choose **Gmail** (or your email provider)
- Connect your personal email account
- Save your **Service ID** (e.g., `service_xxxxx`)

### 1.3 Create Email Template
- Go to **Email Templates** in dashboard
- Click **Create New Template**
- Template ID will be auto-generated (e.g., `template_xxxxx`)
- Set up template:
  ```
  Subject: Welcome to Catch Them Young!
  
  Body:
  Hi {{displayName}},
  
  Welcome to Catch Them Young! We're excited to have you join our community.
  
  Thanks for signing up!
  ```
- Map template variables:
  - `{{displayName}}` - will receive user's name
  - `{{email}}` - will receive user's email (optional)
- Save template and note your **Template ID**

### 1.4 Get API Keys
- Go to **Account** → **General**
- Copy your **Public Key** (User ID) - looks like: `xxxxxxxxxxxxx`
- Note: For backend, you'll need the **Private Key** (API Key) which is different
- Go to **Account** → **API Keys**
- Create a new API key or use existing one
- Copy your **Private Key** (API Key) - this is what you'll use in backend

---

## Step 2: Install EmailJS Node.js Package

### File: `backend/package.json`

**Action**: Update dependencies to include EmailJS Node.js SDK

**Current dependencies**:
```json
"dependencies": {
  "express": "^4.19.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "resend": "^3.2.0"
}
```

**Command to run** (in backend folder):
```bash
npm install @emailjs/nodejs
```

**After installation**, dependencies should include:
```json
"dependencies": {
  "express": "^4.19.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "resend": "^3.2.0",  // Can keep or remove later
  "@emailjs/nodejs": "^x.x.x"
}
```

---

## Step 3: Create .env File

### File: `backend/.env` (create new file)

**Action**: Create environment variables file to store EmailJS credentials securely

**Important**: Add `.env` to `.gitignore` if not already there!

**File content**:
```env
# EmailJS Configuration
EMAILJS_SERVICE_ID=your_service_id_here
EMAILJS_TEMPLATE_ID=your_template_id_here
EMAILJS_PRIVATE_KEY=your_private_api_key_here
EMAILJS_PUBLIC_KEY=your_public_key_here

# Server Configuration
PORT=3001

# Frontend Origin (optional, for CORS)
FRONTEND_ORIGIN=http://localhost:5500
```

**Replace placeholders**:
- `your_service_id_here` → Your EmailJS Service ID
- `your_template_id_here` → Your EmailJS Template ID
- `your_private_api_key_here` → Your EmailJS Private Key (API Key)
- `your_public_key_here` → Your EmailJS Public Key (User ID)

---

## Step 4: Update Backend Code

### File: `backend/index.js`

### 4.1 Replace Resend Import with EmailJS

**Current code** (line 5):
```javascript
const { Resend } = require('resend');
```

**Replace with**:
```javascript
const emailjs = require('@emailjs/nodejs');
```

### 4.2 Remove Resend Initialization

**Current code** (line 8):
```javascript
const resend = new Resend(process.env.re_BQ1CsSYe_82qQLXzCxNDHq2k4H25BmFvr);
```

**Remove this line entirely** (delete it)

### 4.3 Initialize EmailJS

**Location**: Add after `app.use(express.json());` (around line 25)

**Code to add**:
```javascript
// Initialize EmailJS with Private Key from environment
emailjs.init({
  privateKey: process.env.EMAILJS_PRIVATE_KEY, // API Key from .env
  publicKey: process.env.EMAILJS_PUBLIC_KEY    // Public Key from .env
});
```

### 4.4 Replace Email Sending Logic

**Current code** (lines 36-42):
```javascript
await resend.emails.send({
  from: 'welcome@yourdomain.com', // verify this domain in Resend
  to: email,
  subject: 'Welcome to Our App!',
  html: `<p>Hi ${displayName || 'there'},<br>Thanks for joining!</p>`
});
```

**Replace with**:
```javascript
await emailjs.send(
  process.env.EMAILJS_SERVICE_ID,  // Service ID from .env
  process.env.EMAILJS_TEMPLATE_ID, // Template ID from .env
  {
    displayName: displayName || 'there',
    email: email
  }
);
```

---

## Step 5: Complete Updated Backend Code

### File: `backend/index.js` (Complete replacement)

**Full updated code structure**:
```javascript
// Minimal email backend with EmailJS
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const emailjs = require('@emailjs/nodejs');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_ORIGIN // from .env if set
  ].filter(Boolean), // removes undefined values
  credentials: false
}));

app.use(express.json());

// Initialize EmailJS
emailjs.init({
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
  publicKey: process.env.EMAILJS_PUBLIC_KEY
});

// POST /send-welcome
app.post('/send-welcome', async (req, res) => {
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
    console.error('❌ Email error:', err.message);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`📧 Email backend running on http://localhost:${PORT}`);
  console.log(`📝 Using EmailJS for email sending`);
});
```

---

## Step 6: Update .gitignore (IMPORTANT!)

### File: `backend/.gitignore` (create if doesn't exist, or update existing)

**Action**: Ensure `.env` file is not committed to version control

**File content**:
```
node_modules/
.env
*.log
.DS_Store
```

---

## Step 7: No Frontend Changes Needed!

✅ **Good news**: Your frontend code in `authentication/auth.js` already calls the backend endpoint correctly (lines 283-300). No changes needed!

The frontend will continue to make the same API call:
```javascript
const emailResponse = await fetch('http://localhost:3001/send-welcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: user.email,
    displayName: name
  })
});
```

---

## Step 8: Testing

### 8.1 Install Dependencies
```bash
cd backend
npm install
```

### 8.2 Start Backend Server
```bash
npm start
```

You should see:
```
📧 Email backend running on http://localhost:3001
📝 Using EmailJS for email sending
```

### 8.3 Test Registration
1. Open your frontend signup page
2. Fill out registration form with real email
3. Submit registration
4. Check backend console for email success/failure
5. Check registered email inbox for welcome email

---

## Step 9: Optional - Remove Resend Package

After confirming EmailJS works, you can remove Resend:

```bash
cd backend
npm uninstall resend
```

---

## Advantages of Backend Approach

✅ **Secure**: API keys never exposed to frontend
✅ **Centralized**: All email logic in one place
✅ **Flexible**: Easy to switch email providers later
✅ **Rate limiting**: Can add rate limiting on backend
✅ **Logging**: Better logging and error tracking
✅ **No domain verification**: EmailJS doesn't require domain verification

---

## Security Best Practices

🔒 **Never commit `.env` file** to version control
🔒 **Use environment variables** for all sensitive data
🔒 **Add `.env` to `.gitignore`**
🔒 **Use different keys** for development and production
🔒 **Restrict CORS** to only your frontend domain in production

---

## Troubleshooting

### Backend won't start?
- Check that `.env` file exists in `backend/` folder
- Verify all environment variables are set in `.env`
- Check that EmailJS package is installed: `npm list @emailjs/nodejs`

### Email not sending?
- Check backend console for error messages
- Verify EmailJS credentials in `.env` file are correct
- Check EmailJS dashboard to ensure service is connected
- Verify template variables match what you're sending

### Environment variables not loading?
- Ensure `require('dotenv').config()` is called at the top
- Check `.env` file is in `backend/` folder (same folder as `index.js`)
- Verify `.env` file syntax (no spaces around `=`, no quotes needed)

---

## Production Considerations

### Environment Variables in Production

When deploying:
- Set environment variables in your hosting platform (Heroku, Vercel, Railway, etc.)
- Never hardcode keys in production code
- Use different EmailJS account/keys for production if possible

### CORS for Production

Update CORS in `backend/index.js`:
```javascript
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'https://yourdomain.com',
  credentials: false
}));
```

---

## Summary of Changes

### Files to Modify:
1. ✅ `backend/package.json` - Add EmailJS dependency
2. ✅ `backend/index.js` - Replace Resend with EmailJS
3. ✅ `backend/.env` - Add EmailJS credentials (CREATE NEW)
4. ✅ `backend/.gitignore` - Ensure .env is ignored (CREATE/UPDATE)

### Files That DON'T Need Changes:
- ❌ `authentication/auth.js` - Already calls backend correctly
- ❌ `authentication/signup.html` - No frontend changes needed

### Steps to Complete:
1. Create EmailJS account and get credentials
2. Install EmailJS Node.js package
3. Create `.env` file with credentials
4. Update backend code
5. Test email sending
6. Remove Resend (optional)

