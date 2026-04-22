const rateLimit = require('express-rate-limit')

// ── Login rate limiter — 10 attempts per 15 min per IP ────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
})

// ── General API limiter — 300 requests per min per IP ─────
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

// ── Patient/prescription create — 100 per 10 min ─────────
const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many create requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { loginLimiter, apiLimiter, createLimiter }
