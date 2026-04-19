const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/super.controller');

// One-time setup (no auth needed)
router.post('/setup', ctrl.createSuperAdmin);

// Super admin dashboard
router.get('/dashboard', authenticate, authorize('SUPER_ADMIN'), ctrl.getDashboardStats);

module.exports = router;
