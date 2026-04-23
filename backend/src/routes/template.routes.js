const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/template.controller');

// Read templates — anyone who can prescribe needs to browse them
router.get ('/',              authenticate, requirePermission('viewPrescriptions'), ctrl.getTemplates);
router.get ('/:id',           authenticate, requirePermission('viewPrescriptions'), ctrl.getTemplate);
// Applying a template to a new prescription
router.post('/:id/use',       authenticate, requirePermission('createPrescriptions'), ctrl.useTemplate);

// Manage templates (create/update/delete) — manageTemplates
router.post  ('/',        authenticate, requirePermission('manageTemplates'), ctrl.createTemplate);
router.post  ('/save-as', authenticate, requirePermission('manageTemplates'), ctrl.saveAsTemplate);
router.put   ('/:id',     authenticate, requirePermission('manageTemplates'), ctrl.updateTemplate);
router.delete('/:id',     authenticate, requirePermission('manageTemplates'), ctrl.deleteTemplate);

module.exports = router;
