const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/appointment.controller');

// Reads — any authenticated user can see the queue
router.get  ('/queue/today', authenticate, ctrl.getTodayQueue);
router.get  ('/queue/:date', authenticate, ctrl.getQueueByDate);

// Writes — manageQueue
router.get  ('/queue/next',   authenticate, requirePermission('manageQueue'), ctrl.callNext);
router.post ('/queue',        authenticate, requirePermission('manageQueue'), ctrl.addToQueue);
router.patch('/:id/status',   authenticate, requirePermission('manageQueue'), ctrl.updateTokenStatus);
router.patch('/:id/reorder',  authenticate, requirePermission('manageQueue'), ctrl.reorderToken);

module.exports = router;
