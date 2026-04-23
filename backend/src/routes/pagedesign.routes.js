const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/pagedesign.controller');

// Read page design — any authed user (needed to render prescription/bill print views)
router.get  ('/',       authenticate, ctrl.getDesign);

// Writes — manageSettings
router.post ('/',       authenticate, requirePermission('manageSettings'), ctrl.saveDesign);
router.delete('/reset', authenticate, requirePermission('manageSettings'), ctrl.resetDesign);

module.exports = router;
