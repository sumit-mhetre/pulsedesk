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

// Create clinic (admin user is OPTIONAL — see controller for the wantsAdmin logic)
router.post('/',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('Clinic name required'),
    // Admin fields validated conditionally inside the controller — here we only ensure
    // that if any are sent, they're typed correctly.
    body('adminEmail').optional({ checkFalsy: true }).isEmail().withMessage('Valid admin email required'),
    body('adminPassword').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Password min 6 characters'),
  ],
  validate,
  ctrl.createClinic
);

// Update clinic status/plan
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinicStatus);

// Get clinic detail (with users)
router.get('/:id',          authenticate, authorize('SUPER_ADMIN'), ctrl.getClinicDetail);

// Get clinic stats (per-clinic, date-range filterable)
router.get('/:id/stats',    authenticate, authorize('SUPER_ADMIN'), ctrl.getClinicStats);

// Get clinic audit logs (paginated)
router.get('/:id/audit-logs', authenticate, authorize('SUPER_ADMIN'), ctrl.getClinicAuditLogs);

// Reset admin password (returns plaintext temp password)
router.post('/:id/reset-admin-password',
  authenticate, authorize('SUPER_ADMIN'), ctrl.resetAdminPassword);

// Super-admin: create / update user inside a specific clinic.
// Reuses user controller methods which honor `req.params.clinicId` for super admin.
const userCtrl = require('../controllers/user.controller');
router.post('/:clinicId/users',
  authenticate, authorize('SUPER_ADMIN'), userCtrl.createUser);
router.patch('/:clinicId/users/:id',
  authenticate, authorize('SUPER_ADMIN'), userCtrl.updateUser);

// Super-admin: master data per clinic
const mdCtrl = require('../controllers/masterdata.controller');
router.get('/:clinicId/master-data-counts',
  authenticate, authorize('SUPER_ADMIN'), mdCtrl.getMasterDataCounts);
router.post('/:clinicId/seed-master-data',
  authenticate, authorize('SUPER_ADMIN'), mdCtrl.seedMasterData);

// Update any clinic by id
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinic);

module.exports = router;
