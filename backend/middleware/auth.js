const { auth } = require('../config/firebase-admin');

/**
 * Middleware to verify Firebase ID token
 * Extracts token from Authorization header and verifies it
 * Attaches decoded token to req.user
 */
async function verifyToken(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided. Please include Authorization: Bearer <token>' 
      });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token is missing' 
      });
    }

    // Verify the token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);

    // Attach user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      ...decodedToken
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    // Handle specific error types
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

module.exports = {
  verifyToken
};
