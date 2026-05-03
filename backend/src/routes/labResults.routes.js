const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/labResults.controller');

// Reads - anyone with viewPrescriptions permission can view test outcomes
router.get('/prescription/:prescriptionId',  authenticate, requirePermission('viewPrescriptions'), ctrl.getResultsByPrescription);
router.get('/patient/:patientId',            authenticate, requirePermission('viewPrescriptions'), ctrl.getResultsByPatient);
router.get('/patient/:patientId/trend',      authenticate, requirePermission('viewPrescriptions'), ctrl.getPatientTestTrend);

// Writes - anyone with createPrescriptions permission can record / edit / delete
router.post  ('/',     authenticate, requirePermission('createPrescriptions'), ctrl.createLabResult);
router.patch ('/:id',  authenticate, requirePermission('createPrescriptions'), ctrl.updateLabResult);
router.delete('/:id',  authenticate, requirePermission('createPrescriptions'), ctrl.deleteLabResult);

module.exports = router;
