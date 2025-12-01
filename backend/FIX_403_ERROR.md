# Fix: "API calls are disabled for non-browser applications" (403 Error)

## ✅ Problem Identified!

You're getting this error:
```
API calls are disabled for non-browser applications
```

This is because EmailJS blocks server-side API calls by default for security reasons.

---

## 🔧 Solution: Enable Non-Browser API Access

### Step 1: Go to EmailJS Dashboard

1. **Open:** https://dashboard.emailjs.com
2. **Log in** to your account

### Step 2: Navigate to API Keys Settings

1. Click on **"Account"** (usually in top-right corner)
2. Go to **"API Keys"** section
3. Look for the setting: **"Allow EmailJS API for non-browser applications"** or **"Enable non-browser API calls"**
4. **Toggle/Enable this setting**

### Step 3: Alternative Path (if above doesn't work)

1. Go to **Account** → **General** or **Settings**
2. Look for **"Security"** or **"API Settings"**
3. Find **"Non-browser API access"** or similar
4. **Enable it**

### Step 4: Save Changes

- Make sure to **save** your changes
- The setting should now be **enabled**

### Step 5: Restart Your Backend Server

1. Stop your backend server (Ctrl+C in terminal)
2. Restart it:
   ```bash
   npm start
   ```

### Step 6: Test Again

1. Register a new user
2. Check backend terminal - should now show success ✅
3. Check email inbox

---

## 📝 What This Setting Does

- **Default:** EmailJS only allows API calls from browsers (for security)
- **After enabling:** EmailJS allows API calls from Node.js servers (your backend)
- **Security:** Still uses your Private Key for authentication, so it's safe

---

## 🎯 Quick Summary

1. ✅ Go to: https://dashboard.emailjs.com
2. ✅ Account → API Keys (or Settings)
3. ✅ Enable "Allow non-browser API calls"
4. ✅ Save changes
5. ✅ Restart backend server
6. ✅ Test registration again

---

## ✅ After Enabling

You should see in your backend terminal:
```
✅ Welcome email sent to user@example.com
```

Instead of:
```
❌ Email error: API calls are disabled for non-browser applications
```

---

## 🆘 Still Not Working?

1. **Check EmailJS dashboard** - is the setting actually saved/enabled?
2. **Wait 1-2 minutes** - changes might take a moment to propagate
3. **Check EmailJS usage limits** - free tier is 200 emails/month
4. **Verify your Private Key** in .env matches the one in EmailJS dashboard
5. **Check EmailJS documentation** for any recent changes

---

## 📚 Reference

- EmailJS Dashboard: https://dashboard.emailjs.com
- EmailJS Documentation: https://www.emailjs.com/docs/

