const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/billing.controller');

// Reads — viewBilling
router.get ('/summary',                 authenticate, requirePermission('viewBilling'), ctrl.getDailySummary);
router.get ('/patient/:patientId',      authenticate, requirePermission('viewBilling'), ctrl.getPatientBills);
router.get ('/suggest/:prescriptionId', authenticate, requirePermission('viewBilling'), ctrl.suggestFromPrescription);
router.get ('/',                        authenticate, requirePermission('viewBilling'), ctrl.getBills);
router.get ('/:id',                     authenticate, requirePermission('viewBilling'), ctrl.getBill);

// Writes — createBilling
router.post('/',                        authenticate, requirePermission('createBilling'), ctrl.createBill);
router.put ('/:id',                     authenticate, requirePermission('createBilling'), ctrl.updateBill);

module.exports = router;
