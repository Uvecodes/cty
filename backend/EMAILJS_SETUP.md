# EmailJS Backend Setup Instructions

## 📋 Quick Setup Guide

### Step 1: Install Dependencies

Run this command in the `backend` folder:

```bash
npm install
```

This will install the `@emailjs/nodejs` package.

---

### Step 2: Create `.env` File

Create a file named `.env` in the `backend` folder with the following content:

```env
# EmailJS Configuration
# Get these values from your EmailJS dashboard: https://dashboard.emailjs.com

# Service ID - Found in Email Services section
EMAILJS_SERVICE_ID=your_service_id_here

# Template ID - Found in Email Templates section
EMAILJS_TEMPLATE_ID=your_template_id_here

# Private Key (API Key) - Found in Account > API Keys section
EMAILJS_PRIVATE_KEY=your_private_api_key_here

# Public Key (User ID) - Found in Account > General section
EMAILJS_PUBLIC_KEY=your_public_key_here

# Server Configuration
PORT=3001

# Frontend Origin (optional, for CORS in production)
FRONTEND_ORIGIN=http://localhost:5500
```

**Replace all the placeholder values** with your actual EmailJS credentials.

---

### Step 3: Get Your EmailJS Credentials

1. **Sign up / Log in** to EmailJS: https://www.emailjs.com

2. **Create Email Service:**
   - Go to **Email Services** in dashboard
   - Click **Add New Service**
   - Choose **Gmail** (or your email provider)
   - Connect your personal email account
   - Copy your **Service ID** (e.g., `service_xxxxx`)

3. **Create Email Template:**
   - Go to **Email Templates** in dashboard
   - Click **Create New Template**
   - Template ID will be auto-generated (e.g., `template_xxxxx`)
   - Set up template with subject and body:
     ```
     Subject: Welcome to Catch Them Young!
     
     Body:
     Hi {{displayName}},
     
     Welcome to Catch Them Young! We're excited to have you join our community.
     
     Thanks for signing up!
     ```
   - Add template variables:
     - `{{displayName}}` - for user's name
     - `{{email}}` - for user's email (optional)
   - Save template and copy your **Template ID**

4. **Get API Keys:**
   - Go to **Account** → **General**
   - Copy your **Public Key** (User ID)
   - Go to **Account** → **API Keys**
   - Create a new API key or use existing one
   - Copy your **Private Key** (API Key)

5. **Update `.env` file** with all the values you copied

---

### Step 4: Start the Server

Run this command in the `backend` folder:

```bash
npm start
```

You should see:
```
📧 Email backend running on http://localhost:3001
📝 Using EmailJS for email sending
```

---

### Step 5: Test Registration

1. Open your frontend signup page
2. Fill out registration form with a real email address
3. Submit registration
4. Check backend console for email success/failure messages
5. Check the registered email inbox for welcome email

---

## ✅ What's Been Changed

- ✅ `backend/package.json` - Added `@emailjs/nodejs` package
- ✅ `backend/index.js` - Replaced Resend with EmailJS
- ✅ `.gitignore` - Already includes `.env` (your keys are safe)

## ⚠️ Important Notes

- **Never commit `.env` file** to version control (it's already in `.gitignore`)
- Keep your API keys secret and secure
- The backend will fail to start if `.env` file is missing or incomplete
- Check backend console for error messages if emails aren't sending

## 🔒 Security

All EmailJS credentials are stored in `.env` file which is:
- Not committed to git (in `.gitignore`)
- Only accessible on the server
- Never exposed to the frontend/browser

