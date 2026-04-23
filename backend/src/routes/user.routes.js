const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

// Get all doctors (for dropdowns — any authenticated user)
router.get('/doctors', authenticate, ctrl.getDoctors);

// Permissions metadata — any authenticated user who can manage users can fetch
router.get('/permissions-meta', authenticate, requirePermission('manageUsers'), ctrl.getPermissionsMeta);

// Update my profile
router.put('/me', authenticate, ctrl.updateMyProfile);

// Admin routes — now gated by manageUsers permission
router.get('/', authenticate, requirePermission('manageUsers'), ctrl.getUsers);

router.post('/',
  authenticate,
  requirePermission('manageUsers'),
  [
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
    body('role').isIn(['DOCTOR', 'RECEPTIONIST', 'ADMIN']).withMessage('Invalid role'),
  ],
  validate,
  ctrl.createUser
);

router.get ('/:id', authenticate, requirePermission('manageUsers'), ctrl.getUser);
router.put ('/:id', authenticate, requirePermission('manageUsers'), ctrl.updateUser);
router.post('/:id/reset-password', authenticate, requirePermission('manageUsers'), ctrl.resetUserPassword);

module.exports = router;
