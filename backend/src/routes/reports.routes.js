const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/reports.controller');

// Legacy
router.get('/daily',       authenticate, requirePermission('viewReports'), ctrl.getDailyReport);
router.get('/monthly',     authenticate, requirePermission('viewReports'), ctrl.getMonthlyReport);
router.get('/medicines',   authenticate, requirePermission('viewReports'), ctrl.getTopMedicines);
router.get('/diagnoses',   authenticate, requirePermission('viewReports'), ctrl.getTopDiagnoses);
router.get('/patients',    authenticate, requirePermission('viewReports'), ctrl.getPatientStats);
router.get('/collection',  authenticate, requirePermission('viewReports'), ctrl.getCollectionSummary);

// New - Dashboard
router.get('/dashboard',   authenticate, requirePermission('viewReports'), ctrl.getDashboard);

// New - Custom query + meta
router.get ('/meta',       authenticate, requirePermission('viewReports'), ctrl.getReportMeta);
router.post('/query',      authenticate, requirePermission('viewReports'), ctrl.runQuery);
router.post('/export',     authenticate, requirePermission('viewReports'), ctrl.exportReport);

// New - Saved reports
router.get   ('/saved',         authenticate, requirePermission('viewReports'), ctrl.listSavedReports);
router.post  ('/saved',         authenticate, requirePermission('viewReports'), ctrl.createSavedReport);
router.put   ('/saved/:id',     authenticate, requirePermission('viewReports'), ctrl.updateSavedReport);
router.delete('/saved/:id',     authenticate, requirePermission('viewReports'), ctrl.deleteSavedReport);
router.post  ('/saved/:id/run', authenticate, requirePermission('viewReports'), ctrl.runSavedReport);

module.exports = router;
