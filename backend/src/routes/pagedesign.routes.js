const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/pagedesign.controller');

router.get  ('/',       authenticate, ctrl.getDesign);
router.post ('/',       authenticate, authorize('ADMIN','DOCTOR'), ctrl.saveDesign);
router.delete('/reset', authenticate, authorize('ADMIN','DOCTOR'), ctrl.resetDesign);

module.exports = router;
