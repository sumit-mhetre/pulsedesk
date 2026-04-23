const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/prescription.controller');

// Reads — viewPrescriptions
router.get ('/',                        authenticate, requirePermission('viewPrescriptions'), ctrl.getPrescriptions);
router.get ('/doctor-preferences',      authenticate, requirePermission('viewPrescriptions'), ctrl.getDoctorPreferences);
router.get ('/calc-qty',                authenticate, requirePermission('viewPrescriptions'), ctrl.calculateQty);
router.get ('/patient/:patientId',      authenticate, requirePermission('viewPrescriptions'), ctrl.getPatientPrescriptions);
router.get ('/patient/:patientId/last', authenticate, requirePermission('viewPrescriptions'), ctrl.getLastPrescription);
router.get ('/:id',                     authenticate, requirePermission('viewPrescriptions'), ctrl.getPrescription);

// Writes — createPrescriptions
router.post('/',                        authenticate, requirePermission('createPrescriptions'), ctrl.createPrescription);
router.put ('/:id',                     authenticate, requirePermission('createPrescriptions'), ctrl.updatePrescription);

module.exports = router;
