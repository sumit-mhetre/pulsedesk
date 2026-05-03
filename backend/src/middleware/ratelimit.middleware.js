const rateLimit = require('express-rate-limit')

// ── Login rate limiter - 20 FAILED attempts per 15 min per IP ──
// Successful logins do NOT count against this limit (skipSuccessfulRequests).
// A "success" is any response with HTTP status < 400.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                   // raised from 10 → 20
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many failed login attempts from this IP. Please wait 15 minutes or use "Forgot Password" to reset.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
})

// ── Forgot-password limiter - 5 requests per hour per IP ──
// Prevents email enumeration attacks & spam.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many password reset requests. Please wait an hour and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
})

// ── General API limiter - 300 requests per min per IP ─────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 300,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health', // don't limit health checks
})

// ── Patient/prescription create - 100 per 10 min ─────────
const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many create requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { loginLimiter, forgotPasswordLimiter, apiLimiter, createLimiter }
