require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// ── Middleware ─────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'||'https://pulsedesk-1.onrender.com/login',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Static uploads ─────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes ─────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/master', require('./routes/masterdata.routes'));
app.use('/api/templates', require('./routes/template.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/billing', require('./routes/billing.routes'));
app.use('/api/prescriptions', require('./routes/prescription.routes'));
app.use('/api/patients',     require('./routes/patient.routes'));
app.use('/api/appointments', require('./routes/appointment.routes'));
app.use('/api/clinics', require('./routes/clinic.routes'));
app.use('/api/users',   require('./routes/user.routes'));
app.use('/api/super',   require('./routes/super.routes'));

// ── Health check ───────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'PulseDesk API', version: '1.0.0' });
});

// ── 404 handler ────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ───────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 PulseDesk API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});
