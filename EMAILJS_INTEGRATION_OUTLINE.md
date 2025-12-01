# EmailJS Integration Outline for Welcome Email

## Overview
This outline explains how to replace the Resend backend email service with EmailJS, which works directly from the frontend without requiring domain verification or a separate backend server.

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

### 1.4 Get Public Key (User ID)
- Go to **Account** → **General**
- Copy your **Public Key** (User ID) - looks like: `xxxxxxxxxxxxx`

---

## Step 2: Add EmailJS SDK to HTML

### File: `authentication/signup.html`

**Location**: Add before the `auth.js` script tag (around line 104)

**Code to add**:
```html
<!-- EmailJS SDK -->
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>

<!-- Your auth logic (external) -->
<script src="./auth.js"></script>
```

---

## Step 3: Initialize EmailJS in auth.js

### File: `authentication/auth.js`

**Location**: After Firebase initialization (after line 70)

**Code to add**:
```javascript
// Initialize EmailJS with your Public Key
emailjs.init("YOUR_PUBLIC_KEY_HERE"); // Replace with your actual Public Key from EmailJS dashboard
```

---

## Step 4: Create Welcome Email Function

### File: `authentication/auth.js`

**Location**: Add this function before the `register` function (around line 233)

**Code to add**:
```javascript
// Send welcome email via EmailJS
async function sendWelcomeEmail(userEmail, displayName) {
  try {
    const response = await emailjs.send(
      'YOUR_SERVICE_ID',      // Replace with your EmailJS Service ID
      'YOUR_TEMPLATE_ID',     // Replace with your EmailJS Template ID
      {
        displayName: displayName,
        email: userEmail
      }
    );
    
    console.log('✅ Welcome email sent successfully:', response.status);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
}
```

---

## Step 5: Replace Backend Call in Register Function

### File: `authentication/auth.js`

**Location**: Lines 281-300 (replace the entire backend fetch block)

**Current code to replace**:
```javascript
// ✅ Trigger welcome email via your backend (non-blocking)
try {
  const emailResponse = await fetch('http://localhost:3001/send-welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      displayName: name
    })
  });

  if (!emailResponse.ok) {
    console.warn('Email service returned error:', emailResponse.status);
  } else {
    console.log('Welcome email triggered successfully');
  }
} catch (emailError) {
  // Log but don't stop registration — email is secondary
  console.error('Failed to trigger welcome email:', emailError);
}
```

**Replace with**:
```javascript
// ✅ Send welcome email via EmailJS (non-blocking)
sendWelcomeEmail(user.email, name).then(result => {
  if (result.success) {
    console.log('Welcome email sent successfully');
  } else {
    console.warn('Welcome email failed, but registration succeeded');
  }
}).catch(err => {
  // Email failure doesn't stop registration
  console.error('Email sending error:', err);
});
```

---

## Step 6: Configuration Values to Replace

You'll need to replace these placeholders in `auth.js`:

1. **`YOUR_PUBLIC_KEY_HERE`** (in emailjs.init)
   - Found in: EmailJS Dashboard → Account → General → Public Key

2. **`YOUR_SERVICE_ID`** (in sendWelcomeEmail function)
   - Found in: EmailJS Dashboard → Email Services → Your Service → Service ID

3. **`YOUR_TEMPLATE_ID`** (in sendWelcomeEmail function)
   - Found in: EmailJS Dashboard → Email Templates → Your Template → Template ID

---

## Step 7: Testing

### 7.1 Test Registration
1. Fill out signup form with a real email address
2. Submit registration
3. Check browser console for email success/failure messages
4. Check the registered email inbox for welcome email

### 7.2 Verify Email Delivery
- Check spam folder if not in inbox
- Verify email content matches your template
- Confirm user name appears correctly

---

## Step 8: Optional - Backend Cleanup

Since EmailJS works from the frontend, you can optionally:

1. **Remove backend server** (if not needed for other features):
   - Stop the Node.js backend server
   - Delete or archive `backend/` folder

2. **Or keep backend** for future features:
   - Just don't use it for emails anymore

---

## Advantages of EmailJS Approach

✅ **No domain verification required**
✅ **No backend server needed** - works directly from browser
✅ **Free tier**: 200 emails/month
✅ **Easy setup** - just add SDK and configure
✅ **Uses your personal email** as sender
✅ **Non-blocking** - registration succeeds even if email fails

---

## Important Notes

⚠️ **EmailJS free tier limits**:
- 200 emails/month
- Emails sent from EmailJS domain (but reply-to can be your email)

⚠️ **Security**:
- Public Key is exposed in frontend code (this is normal for EmailJS)
- EmailJS handles rate limiting and security

⚠️ **Production considerations**:
- For higher volumes, consider EmailJS paid plan
- Or migrate back to Resend once you have a domain

---

## Troubleshooting

### Email not sending?
- Check browser console for errors
- Verify Service ID, Template ID, and Public Key are correct
- Check EmailJS dashboard for service status
- Verify email service connection in EmailJS dashboard

### Email going to spam?
- This is common with free email services
- Users may need to check spam folder
- Consider upgrading to paid plan for better deliverability

