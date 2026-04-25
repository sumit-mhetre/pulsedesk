const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/medicalDocument.controller');

// Specific routes BEFORE /:id

// Patient-scoped list (used in patient profile tab)
router.get('/patient/:patientId',
  authenticate, requirePermission('viewDocuments'), ctrl.getDocumentsForPatient);

// Main list + filters
router.get('/',
  authenticate, requirePermission('viewDocuments'), ctrl.listDocuments);

// Create
router.post('/',
  authenticate, requirePermission('createDocuments'), ctrl.createDocument);

// Single doc
router.get('/:id',
  authenticate, requirePermission('viewDocuments'), ctrl.getDocument);

router.put('/:id',
  authenticate, requirePermission('createDocuments'), ctrl.updateDocument);

router.delete('/:id',
  authenticate, requirePermission('createDocuments'), ctrl.deleteDocument);

module.exports = router;
