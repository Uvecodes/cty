# Quick Start - Get Welcome Emails Working NOW

## 🚨 Most Likely Issues (Based on Your Problem)

### Problem: "Nothing showing in terminal" + "No email received"

**This means:**
1. ❌ Backend server is **NOT running**
2. ❌ `.env` file might be **missing** or **not configured**

---

## ✅ Fix in 3 Steps

### Step 1: Create `.env` File

**Location:** `backend/.env`

Create this file with your EmailJS credentials:

```env
EMAILJS_SERVICE_ID=your_service_id_here
EMAILJS_TEMPLATE_ID=your_template_id_here
EMAILJS_PRIVATE_KEY=your_private_api_key_here
EMAILJS_PUBLIC_KEY=your_public_key_here
PORT=3001
FRONTEND_ORIGIN=http://localhost:5500
```

**Don't have EmailJS credentials yet?**
- Sign up at: https://www.emailjs.com
- See `EMAILJS_SETUP.md` for detailed instructions

---

### Step 2: Install Dependencies (if not done)

```bash
cd backend
npm install
```

---

### Step 3: Start Backend Server

```bash
cd backend
npm start
```

**You should see:**
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

**If you see "❌ Missing" instead of "✅ Set":**
- Your `.env` file is missing or incomplete
- Go back to Step 1

---

## 🧪 Test It

1. **Keep the backend terminal open** (server must be running)

2. **Open your signup page** in a browser

3. **Register a new user**

4. **Check backend terminal** - you should see:
   ```
   📨 2024-xx-xx - POST /send-welcome
   📧 Received welcome email request: { email: '...', displayName: '...' }
   ✅ Welcome email sent to user@example.com
   ```

5. **Check email inbox** (and spam folder)

---

## ❌ Still Not Working?

### Check 1: Is backend running?
- Look at your terminal - do you see "Email backend running"?
- If not, run `npm start` in the backend folder

### Check 2: Does .env file exist?
- File location: `backend/.env`
- Open it - are all values filled in (not placeholders)?

### Check 3: Browser console errors?
- Press F12 in browser
- Go to Console tab
- Look for red errors
- Check Network tab - is the request going to backend?

### Check 4: Backend terminal errors?
- What errors do you see?
- Copy the error message

---

## 📞 Need More Help?

See `TROUBLESHOOTING.md` for detailed troubleshooting steps.


