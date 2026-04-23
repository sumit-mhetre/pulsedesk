const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/clinic.controller');

// Super admin — get all clinics
router.get('/', authenticate, authorize('SUPER_ADMIN'), ctrl.getAllClinics);

// Super admin — create clinic
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

// Super admin — update clinic status/plan
router.patch('/:id/status', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinicStatus);

// Super admin — update any clinic
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), ctrl.updateClinic);

// Clinic — read own clinic info (any authed user)
router.get('/me', authenticate, ctrl.getMyClinic);

// Clinic — update own clinic (settings, name, etc) — requires manageSettings
router.put('/me', authenticate, requirePermission('manageSettings'), ctrl.updateClinic);

module.exports = router;
