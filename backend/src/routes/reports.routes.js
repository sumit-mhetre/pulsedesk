const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/reports.controller');

router.get('/daily',       authenticate, requirePermission('viewReports'), ctrl.getDailyReport);
router.get('/monthly',     authenticate, requirePermission('viewReports'), ctrl.getMonthlyReport);
router.get('/medicines',   authenticate, requirePermission('viewReports'), ctrl.getTopMedicines);
router.get('/diagnoses',   authenticate, requirePermission('viewReports'), ctrl.getTopDiagnoses);
router.get('/patients',    authenticate, requirePermission('viewReports'), ctrl.getPatientStats);
router.get('/collection',  authenticate, requirePermission('viewReports'), ctrl.getCollectionSummary);

module.exports = router;
