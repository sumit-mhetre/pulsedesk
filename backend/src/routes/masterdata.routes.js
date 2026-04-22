const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  medicineCtrl, labTestCtrl, complainCtrl,
  diagnosisCtrl, adviceCtrl, medicineNoteCtrl, billingItemCtrl,
  dosageCtrl, timingCtrl, seedMasterData,
} = require('../controllers/masterdata.controller');

// ── Medicines ─────────────────────────────────────────────
router.get   ('/medicines',          authenticate, medicineCtrl.getAll);
router.post  ('/medicines',          authenticate, medicineCtrl.create);
router.put   ('/medicines/:id',      authenticate, authorize('ADMIN'), medicineCtrl.update);
router.delete('/medicines/:id',      authenticate, authorize('ADMIN'), medicineCtrl.remove);

// ── Lab Tests ─────────────────────────────────────────────
router.get   ('/lab-tests',          authenticate, labTestCtrl.getAll);
router.post  ('/lab-tests',          authenticate, labTestCtrl.create);
router.put   ('/lab-tests/:id',      authenticate, authorize('ADMIN'), labTestCtrl.update);
router.delete('/lab-tests/:id',      authenticate, authorize('ADMIN'), labTestCtrl.remove);

// ── Complaints ────────────────────────────────────────────
router.get   ('/complaints',         authenticate, complainCtrl.getAll);
router.post  ('/complaints',         authenticate, complainCtrl.create);
router.put   ('/complaints/:id',     authenticate, authorize('ADMIN'), complainCtrl.update);
router.delete('/complaints/:id',     authenticate, authorize('ADMIN'), complainCtrl.remove);

// ── Diagnoses ─────────────────────────────────────────────
router.get   ('/diagnoses',          authenticate, diagnosisCtrl.getAll);
router.post  ('/diagnoses',          authenticate, diagnosisCtrl.create);
router.put   ('/diagnoses/:id',      authenticate, authorize('ADMIN'), diagnosisCtrl.update);
router.delete('/diagnoses/:id',      authenticate, authorize('ADMIN'), diagnosisCtrl.remove);

// ── Advice Options ────────────────────────────────────────
router.get   ('/advice',             authenticate, adviceCtrl.getAll);
router.post  ('/advice',             authenticate, adviceCtrl.create);
router.put   ('/advice/:id',         authenticate, authorize('ADMIN'), adviceCtrl.update);
router.delete('/advice/:id',         authenticate, authorize('ADMIN'), adviceCtrl.remove);

// ── Medicine Notes ────────────────────────────────────────
router.get   ('/medicine-notes',     authenticate, medicineNoteCtrl.getAll);
router.post  ('/medicine-notes',     authenticate, medicineNoteCtrl.create);
router.put   ('/medicine-notes/:id', authenticate, authorize('ADMIN'), medicineNoteCtrl.update);
router.delete('/medicine-notes/:id', authenticate, authorize('ADMIN'), medicineNoteCtrl.remove);

// ── Billing Items ─────────────────────────────────────────
router.get   ('/billing-items',      authenticate, billingItemCtrl.getAll);
router.post  ('/billing-items',      authenticate, authorize('ADMIN'), billingItemCtrl.create);
router.put   ('/billing-items/:id',  authenticate, authorize('ADMIN'), billingItemCtrl.update);
router.delete('/billing-items/:id',  authenticate, authorize('ADMIN'), billingItemCtrl.remove);

// ── Dosage & Timing ───────────────────────────────────────
router.get   ('/dosage-options',     authenticate, dosageCtrl.getAll);
router.post  ('/dosage-options',     authenticate, authorize('ADMIN'), dosageCtrl.create);
router.delete('/dosage-options/:id', authenticate, authorize('ADMIN'), dosageCtrl.remove);

router.get   ('/timing-options',     authenticate, timingCtrl.getAll);
router.post  ('/timing-options',     authenticate, authorize('ADMIN'), timingCtrl.create);
router.delete('/timing-options/:id', authenticate, authorize('ADMIN'), timingCtrl.remove);

// ── Bulk seed ─────────────────────────────────────────────
router.post  ('/seed',               authenticate, authorize('ADMIN'), seedMasterData);

module.exports = router;
