const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/billing.controller');

router.get ('/summary',                        authenticate, ctrl.getDailySummary);
router.get ('/patient/:patientId',             authenticate, ctrl.getPatientBills);
router.get ('/suggest/:prescriptionId',        authenticate, ctrl.suggestFromPrescription);
router.get ('/',                               authenticate, ctrl.getBills);
router.post('/',                               authenticate, ctrl.createBill);
router.get ('/:id',                            authenticate, ctrl.getBill);
router.put ('/:id',                            authenticate, ctrl.updateBill);

module.exports = router;
