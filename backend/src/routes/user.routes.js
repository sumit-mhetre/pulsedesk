const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

// Get all doctors (for dropdowns - any authenticated user)
router.get('/doctors', authenticate, ctrl.getDoctors);

// Update my profile
router.put('/me', authenticate, ctrl.updateMyProfile);

// Admin only routes
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), ctrl.getUsers);

router.post('/',
  authenticate,
  authorize('ADMIN'),
  [
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
    body('role').isIn(['DOCTOR', 'RECEPTIONIST', 'ADMIN']).withMessage('Invalid role'),
  ],
  validate,
  ctrl.createUser
);

router.get('/:id', authenticate, authorize('ADMIN'), ctrl.getUser);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.updateUser);
router.post('/:id/reset-password', authenticate, authorize('ADMIN'), ctrl.resetUserPassword);

module.exports = router;
