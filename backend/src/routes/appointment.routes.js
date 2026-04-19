const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/appointment.controller');

router.get('/queue/today',      authenticate, ctrl.getTodayQueue);
router.get('/queue/next',       authenticate, ctrl.callNext);
router.get('/queue/:date',      authenticate, ctrl.getQueueByDate);
router.post('/queue',           authenticate, ctrl.addToQueue);
router.patch('/:id/status',     authenticate, ctrl.updateTokenStatus);
router.patch('/:id/reorder',    authenticate, ctrl.reorderToken);

module.exports = router;
