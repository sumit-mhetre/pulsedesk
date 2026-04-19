const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/prescription.controller');

router.get ('/',                                    authenticate, ctrl.getPrescriptions);
router.post('/',                                    authenticate, authorize('DOCTOR','ADMIN'), ctrl.createPrescription);
router.get ('/calc-qty',                            authenticate, ctrl.calculateQty);
router.get ('/patient/:patientId',                  authenticate, ctrl.getPatientPrescriptions);
router.get ('/patient/:patientId/last',             authenticate, ctrl.getLastPrescription);
router.get ('/:id',                                 authenticate, ctrl.getPrescription);
router.put ('/:id',                                 authenticate, authorize('DOCTOR','ADMIN'), ctrl.updatePrescription);

module.exports = router;
