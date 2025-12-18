# Troubleshooting Guide - Welcome Email Not Working

## Quick Checklist

### ✅ Step 1: Is the Backend Server Running?

**Check if you see this in your terminal:**
```
📧 Email backend running on http://localhost:3001
```

**If NOT running:**
1. Open a terminal/command prompt
2. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
3. Start the server:
   ```bash
   npm start
   ```

**You should see:**
```
📧 Email backend running on http://localhost:3001
📝 Using EmailJS for email sending

📋 Environment Check:
   - PORT: 3001
   - EMAILJS_SERVICE_ID: ✅ Set (or ❌ Missing)
   - EMAILJS_TEMPLATE_ID: ✅ Set (or ❌ Missing)
   - EMAILJS_PRIVATE_KEY: ✅ Set (or ❌ Missing)
   - EMAILJS_PUBLIC_KEY: ✅ Set (or ❌ Missing)

💡 Waiting for requests...
```

---

### ✅ Step 2: Check if .env File Exists

**Location:** `backend/.env`

**Does the file exist?**
- ❌ **NO** → You need to create it (see below)
- ✅ **YES** → Check if all values are filled in

**If .env file doesn't exist:**
1. Create a new file named `.env` in the `backend` folder
2. Copy this template:
   ```env
   EMAILJS_SERVICE_ID=your_service_id_here
   EMAILJS_TEMPLATE_ID=your_template_id_here
   EMAILJS_PRIVATE_KEY=your_private_api_key_here
   EMAILJS_PUBLIC_KEY=your_public_key_here
   PORT=3001
   FRONTEND_ORIGIN=http://localhost:5500
   ```
3. Replace all placeholder values with your actual EmailJS credentials
4. Save the file
5. **Restart the backend server** (stop with Ctrl+C, then run `npm start` again)

---

### ✅ Step 3: Check EmailJS Credentials

**If you see "❌ Missing" for any credential:**

1. **Get your EmailJS credentials:**
   - Go to https://dashboard.emailjs.com
   - Follow the setup instructions in `EMAILJS_SETUP.md`

2. **Verify all 4 values are in your .env file:**
   - `EMAILJS_SERVICE_ID` - from Email Services
   - `EMAILJS_TEMPLATE_ID` - from Email Templates
   - `EMAILJS_PRIVATE_KEY` - from Account > API Keys
   - `EMAILJS_PUBLIC_KEY` - from Account > General

3. **Restart the backend server** after updating .env

---

### ✅ Step 4: Check if Backend is Receiving Requests

**When you register a user, you should see in the backend terminal:**
```
📨 2024-xx-xx - POST /send-welcome
📧 Received welcome email request: { email: '...', displayName: '...' }
```

**If you DON'T see this:**
- The frontend is not reaching the backend
- Check if backend is running on port 3001
- Check browser console for errors
- Check CORS settings

---

### ✅ Step 5: Check Browser Console

**Open browser developer tools (F12) and check Console tab:**

**Look for errors like:**
- `Failed to fetch` → Backend not running or wrong URL
- `CORS error` → Backend CORS not configured correctly
- `Network error` → Backend server not accessible

**If you see email errors:**
- Check backend terminal for detailed error messages
- Verify EmailJS credentials are correct

---

### ✅ Step 6: Check EmailJS Dashboard

1. Go to https://dashboard.emailjs.com
2. Check **Email Services** - is your service connected?
3. Check **Email Templates** - does your template have the right variables?
4. Check **Usage** - have you exceeded the free tier limit (200/month)?

---

## Common Issues

### Issue 1: "Nothing showing in terminal"
**Problem:** Backend server is not running
**Solution:** Start the backend server (see Step 1)

### Issue 2: "No email received"
**Possible causes:**
1. Backend not running → Start it
2. .env file missing/incomplete → Create/fix it
3. EmailJS not configured → Get credentials
4. Email in spam folder → Check spam
5. EmailJS service not connected → Check dashboard

### Issue 3: "EmailJS not configured" error
**Problem:** Missing or incorrect .env file
**Solution:** 
1. Check .env file exists in `backend/` folder
2. Verify all 4 EmailJS values are set
3. Restart backend server

### Issue 4: "Cannot find module '@emailjs/nodejs'"
**Problem:** Package not installed
**Solution:**
```bash
cd backend
npm install
```

### Issue 5: Backend starts but no requests appear
**Possible causes:**
1. Frontend not calling the backend (check browser console)
2. Wrong port number
3. CORS blocking the request
4. Frontend running on different port than expected

---

## Testing Steps

1. **Start backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Verify server is running:**
   - Should see "Email backend running on http://localhost:3001"
   - Check environment variables show "✅ Set"

3. **Register a new user:**
   - Open signup page
   - Fill form and submit
   - Watch backend terminal for request logs

4. **Check logs:**
   - Backend terminal should show request received
   - Backend terminal should show email success/error
   - Browser console should show any frontend errors

5. **Check email:**
   - Check inbox
   - Check spam folder
   - Wait a few minutes (sometimes delayed)

---

## Still Not Working?

1. **Check backend terminal output** - what errors do you see?
2. **Check browser console** - any JavaScript errors?
3. **Verify .env file** - are all values filled in?
4. **Test EmailJS directly** - can you send email from EmailJS dashboard?
5. **Check EmailJS limits** - have you exceeded free tier?

## Get Help

If still stuck, gather this information:
- Backend terminal output (full error messages)
- Browser console errors
- Contents of .env file structure (NOT the actual keys, just which ones are set)
- EmailJS dashboard status (is service connected?)


