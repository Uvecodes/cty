# Diagnostic Checklist - Step by Step

## ✅ Verified: Your .env file exists and has credentials!

I've confirmed your `.env` file exists with:
- ✅ EMAILJS_SERVICE_ID
- ✅ EMAILJS_TEMPLATE_ID  
- ✅ EMAILJS_PRIVATE_KEY
- ✅ EMAILJS_PUBLIC_KEY

---

## 🔍 Now Let's Diagnose Why It's Not Working

### Step 1: Is the Backend Server Running?

**Open a terminal and run:**
```bash
cd backend
npm start
```

**What you should see:**
```
📧 Email backend running on http://localhost:3001
📝 Using EmailJS for email sending

📋 Environment Check:
   - PORT: 3001
   - EMAILJS_SERVICE_ID: ✅ Set
   - EMAILJS_TEMPLATE_ID: ✅ Set
   - EMAILJS_PRIVATE_KEY: ✅ Set
   - EMAILJS_PUBLIC_KEY: ✅ Set

💡 Waiting for requests...
```

**If you DON'T see this:**
- The server is not running
- **Solution:** Keep the terminal open and the server running

---

### Step 2: Test if Backend is Accessible

**Open your browser and go to:**
```
http://localhost:3001/health
```

**You should see JSON:**
```json
{
  "status": "ok",
  "message": "Backend is running",
  "emailjs": {
    "serviceId": "configured",
    "templateId": "configured",
    "privateKey": "configured",
    "publicKey": "configured"
  }
}
```

**If you see an error:**
- Backend is not running → Go back to Step 1

---

### Step 3: Check Browser Console

**When you register a user:**

1. **Open browser developer tools** (Press F12)
2. **Go to Console tab**
3. **Register a user**
4. **Look for errors:**
   - ❌ `Failed to fetch` → Backend not running or wrong URL
   - ❌ `CORS error` → Should be fixed now
   - ✅ `Welcome email triggered successfully` → Frontend is working!

---

### Step 4: Watch Backend Terminal

**When you register a user, you should see in backend terminal:**

```
📨 2024-xx-xx - POST /send-welcome
📧 Received welcome email request: { email: 'user@example.com', displayName: 'John' }
✅ Welcome email sent to user@example.com
```

**If you DON'T see this:**
- Frontend is not reaching the backend
- Check browser console for errors
- Verify backend is running (Step 1)

**If you see an ERROR:**
- Copy the full error message
- This will tell us what's wrong

---

### Step 5: Check EmailJS Dashboard

1. **Go to:** https://dashboard.emailjs.com
2. **Check Email Services:**
   - Is your service connected? (should show green/active)
   - Service ID matches your .env file?

3. **Check Email Templates:**
   - Does your template exist?
   - Template ID matches your .env file?
   - Does template have `{{displayName}}` variable?

4. **Check Usage:**
   - Have you exceeded 200 emails/month? (free tier limit)
   - Check if there are any errors in EmailJS dashboard

---

### Step 6: Verify Email Template Variables

**Your EmailJS template MUST have:**
- Variable: `{{displayName}}` (matches what we send)
- Optional: `{{email}}`

**Check your template:**
- Subject: `Welcome to Catch Them Young!`
- Body should include: `Hi {{displayName}},`

---

## 🚨 Common Issues & Fixes

### Issue: "Nothing showing in terminal"
**Problem:** Backend server not running  
**Fix:** Run `npm start` in backend folder (keep terminal open)

### Issue: Backend terminal shows nothing when registering
**Problem:** Frontend not reaching backend  
**Fixes:**
1. Check browser console for errors (F12)
2. Verify backend is running on port 3001
3. Check if frontend URL matches backend CORS settings

### Issue: Backend shows "❌ Missing" for credentials
**Problem:** .env file not loaded  
**Fixes:**
1. Restart backend server (Ctrl+C, then `npm start`)
2. Verify .env file is in `backend/` folder
3. Check for typos in variable names

### Issue: "Email error" in backend terminal
**Problem:** EmailJS API issue  
**Fixes:**
1. Check error message details
2. Verify EmailJS credentials are correct
3. Check EmailJS dashboard - is service connected?
4. Verify template ID and service ID match dashboard

### Issue: Email sent but not received
**Fixes:**
1. Check spam folder
2. Wait 1-2 minutes (can be delayed)
3. Check EmailJS dashboard for delivery status
4. Verify recipient email is correct

---

## 📝 Quick Test Steps

1. ✅ Start backend: `cd backend && npm start`
2. ✅ Test backend: Open http://localhost:3001/health in browser
3. ✅ Register user: Fill signup form and submit
4. ✅ Check backend terminal: Should see request logs
5. ✅ Check browser console: Should see success/error
6. ✅ Check email: Inbox and spam folder

---

## 🆘 Still Not Working?

**Gather this information:**

1. **Backend terminal output** (what do you see when server starts?)
2. **Backend terminal output** (what appears when you register?)
3. **Browser console errors** (F12 → Console tab)
4. **Browser network tab** (F12 → Network tab → check the request to /send-welcome)
5. **EmailJS dashboard status** (is service connected? any errors?)

---

## 🔧 What I Fixed

1. ✅ Fixed dotenv path loading (now uses absolute path)
2. ✅ Added better error logging (shows full error details)
3. ✅ Added health check endpoint (`/health`)
4. ✅ Improved CORS (allows all origins in development)
5. ✅ Added request logging (shows all incoming requests)

**Next Steps:**
1. Restart your backend server
2. Test the `/health` endpoint
3. Try registering again
4. Watch both backend terminal AND browser console

