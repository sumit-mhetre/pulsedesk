const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/template.controller');

router.get ('/',              authenticate, ctrl.getTemplates);
router.post('/',              authenticate, ctrl.createTemplate);
router.post('/save-as',       authenticate, ctrl.saveAsTemplate);
router.get ('/:id',           authenticate, ctrl.getTemplate);
router.post('/:id/use',       authenticate, ctrl.useTemplate);
router.put ('/:id',           authenticate, ctrl.updateTemplate);
router.delete('/:id',         authenticate, authorize('ADMIN','DOCTOR'), ctrl.deleteTemplate);

module.exports = router;
