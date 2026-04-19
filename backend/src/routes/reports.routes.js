const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/reports.controller');

router.get('/daily',       authenticate, ctrl.getDailyReport);
router.get('/monthly',     authenticate, ctrl.getMonthlyReport);
router.get('/medicines',   authenticate, ctrl.getTopMedicines);
router.get('/diagnoses',   authenticate, ctrl.getTopDiagnoses);
router.get('/patients',    authenticate, ctrl.getPatientStats);
router.get('/collection',  authenticate, ctrl.getCollectionSummary);

module.exports = router;
