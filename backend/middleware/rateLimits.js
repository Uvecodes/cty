const { rateLimit } = require('express-rate-limit');

const jsonError = (message) => (_req, res) => {
  res.status(429).json({ error: 'Too many requests', message });
};

// POST /api/auth/login — blocks brute-force password attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many login attempts. Please wait 15 minutes and try again.')
});

// POST /api/auth/register — blocks mass account creation + EmailJS drain
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many accounts created from this IP. Please try again later.')
});

// POST /api/auth/forgot-password — blocks inbox flooding of real users
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many password reset requests. Please wait an hour and try again.')
});

// POST /send-welcome — blocks direct EmailJS quota drain
const welcomeEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many email requests from this IP.')
});

// POST /api/shop/verify-order, POST /api/support/verify-payment
// Blocks Flutterwave API probing
const paymentVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many payment verification requests. Please wait and try again.')
});

// GET /api/support/stats|activity|credits — blocks Firestore scraping
const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many requests. Please slow down.')
});

// GET /api/verses/today — limits authenticated Firestore churn
const versesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many verse requests. Please wait a moment.')
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  welcomeEmailLimiter,
  paymentVerifyLimiter,
  publicReadLimiter,
  versesLimiter
};
