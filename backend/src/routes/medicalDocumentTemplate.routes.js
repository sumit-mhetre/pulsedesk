const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/medicalDocumentTemplate.controller');

// Anyone who can VIEW documents can read templates (needed at form load)
router.get('/',     authenticate, requirePermission('viewDocuments'),    ctrl.listTemplates);

// Manage requires manageTemplates (same as Rx templates)
router.post('/',    authenticate, requirePermission('manageTemplates'),  ctrl.createTemplate);
router.put('/:id',  authenticate, requirePermission('manageTemplates'),  ctrl.updateTemplate);
router.delete('/:id', authenticate, requirePermission('manageTemplates'), ctrl.deleteTemplate);

module.exports = router;
