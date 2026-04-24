const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/clinic.controller');

// NOTE: specific paths (`/me`) MUST come before `:id` wildcard routes.
// Otherwise `GET /me` and `PUT /me` match the `/:id` handler with id="me"
// and demand SUPER_ADMIN rights.

// ── Clinic (self) routes — any authenticated user ─────────
router.get('/me', authenticate, ctrl.getMyClinic);
router.put('/me', authenticate, requirePermission('manageSettings'), ctrl.updateClinic);

// ── Super admin routes ────────────────────────────────────
// Get all clinics
router.get('/', authenticate, authorize('SUPER_ADMIN'), ctrl.getAllClinics);

// Create clinic
router.post('/',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Clinic name required'),
    body('adminName').notEmpty().withMessage('Admin name required'),
    body('adminEmail').isEmail().withMessage('Valid admin email required'),
    body('adminPassword').isLength({ min: 6 }).withMessage('Password min 6 characters'),
  ],
  validate,
  ctrl.createClinic
);

// Update clinic status/plan
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinicStatus);

// Update any clinic by id
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinic);

module.exports = router;
