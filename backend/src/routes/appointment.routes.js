const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/appointment.controller');

// NOTE: specific paths MUST come before the `:date` wildcard, otherwise
// Express matches `/queue/next` as `/queue/:date` with date="next".

// Reads — any authenticated user can see the queue
router.get  ('/queue/today',  authenticate, ctrl.getTodayQueue);

// Writes — manageQueue  (must come before /queue/:date)
router.get  ('/queue/next',   authenticate, requirePermission('manageQueue'), ctrl.callNext);
router.post ('/queue',        authenticate, requirePermission('manageQueue'), ctrl.addToQueue);

// Date-parameterised read — must come LAST among /queue/* routes
router.get  ('/queue/:date',  authenticate, ctrl.getQueueByDate);

// Token operations
router.patch('/:id/status',   authenticate, requirePermission('manageQueue'), ctrl.updateTokenStatus);
router.patch('/:id/reorder',  authenticate, requirePermission('manageQueue'), ctrl.reorderToken);

// Patient-scoped status transitions (called from Rx flow)
// These are idempotent — safe to call multiple times.
router.post('/queue/today/:patientId/start',    authenticate, requirePermission('createPrescriptions'), ctrl.startConsultation);
router.post('/queue/today/:patientId/complete', authenticate, requirePermission('createPrescriptions'), ctrl.completeConsultation);

module.exports = router;
