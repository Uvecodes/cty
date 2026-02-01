const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, db, admin } = require('../config/firebase-admin');
const { verifyToken } = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      errors: errors.array() 
    });
  }
  next();
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('age').isInt({ min: 4, max: 17 }).withMessage('Age must be between 4 and 17'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password, name, age } = req.body;

    // Check if user already exists
    try {
      await auth.getUserByEmail(email);
      return res.status(400).json({ 
        error: 'Email already in use',
        message: 'This email is already registered' 
      });
    } catch (error) {
      // User doesn't exist, which is what we want
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    // Save additional user data to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name,
      age: parseInt(age),
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      contentState: {} // Initialize empty content state
    }, { merge: true });

    // Generate custom token for the user
    const customToken = await auth.createCustomToken(userRecord.uid);

    console.log(`✅ User registered: ${email} (${userRecord.uid})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: customToken,
      uid: userRecord.uid,
      email: userRecord.email
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    let message = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-exists') {
      message = 'This email is already registered.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Please enter a valid email address.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password must be at least 6 characters.';
    }

    res.status(400).json({
      error: 'Registration failed',
      message: message
    });
  }
});

/**
 * POST /api/auth/login
 * Login existing user
 * Uses Firebase REST API to verify password before generating custom token
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const apiKey = process.env.FIREBASE_API_KEY;

    if (!apiKey) {
      console.error('FIREBASE_API_KEY not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Firebase API key not configured'
      });
    }

    // Verify password using Firebase REST API
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    
    let firebaseResponse;
    try {
      firebaseResponse = await axios.post(firebaseAuthUrl, {
        email: email,
        password: password,
        returnSecureToken: true
      });
    } catch (firebaseError) {
      // Handle Firebase Auth errors
      if (firebaseError.response) {
        const errorCode = firebaseError.response.data?.error?.message;
        
        if (errorCode === 'EMAIL_NOT_FOUND' || errorCode === 'INVALID_PASSWORD' || errorCode === 'INVALID_EMAIL') {
          return res.status(401).json({
            error: 'Invalid credentials',
            message: 'Email or password is incorrect'
          });
        }
        
        if (errorCode === 'USER_DISABLED') {
          return res.status(403).json({
            error: 'Account disabled',
            message: 'This account has been disabled'
          });
        }
        
        console.error('Firebase Auth error:', errorCode);
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid credentials'
        });
      }
      
      throw firebaseError;
    }

    // Password verified successfully, get user record
    const uid = firebaseResponse.data.localId;
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch (error) {
      console.error('Error getting user record:', error);
      return res.status(500).json({
        error: 'Login failed',
        message: 'An error occurred while retrieving user information'
      });
    }

    // Generate custom token for the user
    const customToken = await auth.createCustomToken(uid);

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    console.log(`✅ User login: ${email} (${uid})`);

    res.json({
      success: true,
      message: 'Login successful',
      token: customToken,
      uid: uid,
      email: userRecord.email,
      user: {
        name: userData.name || userRecord.displayName,
        age: userData.age,
        email: userRecord.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login. Please try again.'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if user exists for security
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        });
      }
      throw error;
    }

    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email, {
      url: process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:5500/frontend/authentication/login.html',
      handleCodeInApp: false
    });

    // TODO: Send email with reset link using your email service
    // For now, we'll just return success
    // You can integrate with your existing email service here
    
    console.log(`✅ Password reset link generated for: ${email}`);
    console.log(`Reset link: ${resetLink}`); // Remove this in production

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify current token
 */
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.emailVerified
    }
  });
});

/**
 * POST /api/auth/logout
 * Logout (mainly for server-side session cleanup if needed)
 * Note: Firebase Client SDK handles logout on frontend
 */
router.post('/logout', verifyToken, (req, res) => {
  // Firebase doesn't require server-side logout for ID tokens
  //  note This endpoint is here for future use if needed
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
