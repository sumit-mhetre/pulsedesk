// ── Env loading ────────────────────────────────────────────
// Local dev machines have a backend/.env.development file pointing at localhost.
// Production (Render) uses environment variables set in the dashboard (and/or .env).
// The .env.development file is gitignored so it can never leak.
const path = require('path');
const fs   = require('fs');

const envDevPath = path.resolve(__dirname, '..', '.env.development');
const envPath    = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envDevPath) && process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: envDevPath });
  console.log('📁 Loaded .env.development (local)');
} else {
  require('dotenv').config({ path: envPath });
}

const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');

const { apiLimiter, loginLimiter } = require('./middleware/ratelimit.middleware');
const { auditMiddleware }          = require('./middleware/audit.middleware');

const app = express();

// ── Security headers ───────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,  // allow Render to serve correctly
  contentSecurityPolicy: false,       // handled by frontend
}))
app.set('trust proxy', 1) // trust Render's proxy for correct IP

// ── CORS ───────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://pulsedesk-testing1.onrender.com',
    'https://pulsedesk-1.onrender.com',         // legacy frontend on Render
    'https://simplerxemr.com',                   // new production frontend (root)
    'https://www.simplerxemr.com',               // new production frontend (www)
    process.env.FRONTEND_URL,                    // override hook (env var)
  ].filter(Boolean),
  credentials: true,
}))

// ── General middleware ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(morgan('dev'))

// ── Rate limiting ──────────────────────────────────────────
app.use('/api', apiLimiter)
app.use('/api/auth/login', loginLimiter)

// ── Static uploads ─────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── Audit middleware (after auth, logs all mutations) ──────
app.use('/api', auditMiddleware)

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'))
app.use('/api/master',       require('./routes/masterdata.routes'))
app.use('/api/page-design',  require('./routes/pagedesign.routes'))
app.use('/api/templates',    require('./routes/template.routes'))
app.use('/api/reports',      require('./routes/reports.routes'))
app.use('/api/billing',      require('./routes/billing.routes'))
app.use('/api/prescriptions',require('./routes/prescription.routes'))
app.use('/api/lab-results', require('./routes/labResults.routes'))
app.use('/api/patients',     require('./routes/patient.routes'))
app.use('/api/appointments', require('./routes/appointment.routes'))
app.use('/api/clinics',      require('./routes/clinic.routes'))
app.use('/api/users',        require('./routes/user.routes'))
app.use('/api/super',        require('./routes/super.routes'))
app.use('/api/upload',       require('./routes/upload.routes'))
app.use('/api/documents',    require('./routes/medicalDocument.routes'))
app.use('/api/document-templates', require('./routes/medicalDocumentTemplate.routes'))
app.use('/api/ipd',          require('./routes/ipd.routes'))
app.use('/api/super',        require('./routes/superAdminIpd.routes'))

// ── Audit log route ────────────────────────────────────────
const { authenticate, authorize } = require('./middleware/auth.middleware')
const { getAuditLogs } = require('./middleware/audit.middleware')
app.get('/api/audit-logs', authenticate, authorize('ADMIN'), getAuditLogs)

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SimpleRx EMR API', version: '1.0.0' })
})

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n🚀 SimpleRx EMR API running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV}`)
  console.log(`   Security: Helmet ✅ | Rate Limiting ✅ | Audit Logs ✅`)
})
