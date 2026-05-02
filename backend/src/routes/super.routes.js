const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/super.controller');

// One-time setup (no auth needed)
router.post('/setup', ctrl.createSuperAdmin);

// Super admin dashboard
router.get('/dashboard', authenticate, authorize('SUPER_ADMIN'), ctrl.getDashboardStats);

// Global activity feed (cross-clinic audit log) + filter option lookups
router.get('/activity',         authenticate, authorize('SUPER_ADMIN'), ctrl.getGlobalAuditLogs);
router.get('/activity/filters', authenticate, authorize('SUPER_ADMIN'), ctrl.getActivityFilters);

module.exports = router;
