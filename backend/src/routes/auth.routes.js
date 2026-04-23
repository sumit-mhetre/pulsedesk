const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { forgotPasswordLimiter } = require('../middleware/ratelimit.middleware');
const ctrl = require('../controllers/auth.controller');

router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  ctrl.login
);

router.post('/refresh', ctrl.refreshToken);
router.post('/logout',  ctrl.logout);
router.get ('/me', authenticate, ctrl.getMe);

router.put('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  ctrl.changePassword
);

// Self-service password reset
router.post('/forgot-password',
  forgotPasswordLimiter,
  [ body('email').isEmail().withMessage('Valid email required') ],
  validate,
  ctrl.forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Token required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  ctrl.resetPassword
);

module.exports = router;
