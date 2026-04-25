const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/prescription.controller');

// NOTE: specific paths must come BEFORE the /:id wildcard

// Reads — viewPrescriptions
router.get ('/',                        authenticate, requirePermission('viewPrescriptions'), ctrl.getPrescriptions);
router.get ('/doctor-preferences',      authenticate, requirePermission('viewPrescriptions'), ctrl.getDoctorPreferences);
router.get ('/calc-qty',                authenticate, requirePermission('viewPrescriptions'), ctrl.calculateQty);
router.get ('/patient/:patientId',      authenticate, requirePermission('viewPrescriptions'), ctrl.getPatientPrescriptions);
router.get ('/patient/:patientId/last', authenticate, requirePermission('viewPrescriptions'), ctrl.getLastPrescription);

// Drafts — must come BEFORE /:id
router.get   ('/drafts',                            authenticate, requirePermission('createPrescriptions'), ctrl.listMyDrafts);
router.get   ('/drafts/for-patient/:patientId',     authenticate, requirePermission('createPrescriptions'), ctrl.getDraftForPatient);
router.put   ('/drafts',                            authenticate, requirePermission('createPrescriptions'), ctrl.upsertDraft);
router.delete('/drafts/:id',                        authenticate, requirePermission('createPrescriptions'), ctrl.deleteDraft);

// Catch-all /:id comes LAST
router.get ('/:id',                     authenticate, requirePermission('viewPrescriptions'), ctrl.getPrescription);

// Writes — createPrescriptions
router.post('/',                        authenticate, requirePermission('createPrescriptions'), ctrl.createPrescription);
router.put ('/:id',                     authenticate, requirePermission('createPrescriptions'), ctrl.updatePrescription);

module.exports = router;
