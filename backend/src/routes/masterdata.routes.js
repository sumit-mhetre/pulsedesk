const router = require('express').Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const {
  medicineCtrl, labTestCtrl, complainCtrl,
  diagnosisCtrl, adviceCtrl, medicineNoteCtrl, billingItemCtrl,
  dosageCtrl, timingCtrl, seedMasterData,
} = require('../controllers/masterdata.controller');

// Reads — any authenticated user can read masters (needed for prescribing, billing, etc)
// Writes — manageMasterData, except inline-prescribing cases noted below

// ── Medicines ─────────────────────────────────────────────
router.get   ('/medicines',             authenticate, medicineCtrl.getAll);
// Create: lower bar — anyone who can prescribe can add a missing medicine on the fly
router.post  ('/medicines',             authenticate, requirePermission('createPrescriptions'), medicineCtrl.create);
router.put   ('/medicines/:id',         authenticate, requirePermission('manageMasterData'), medicineCtrl.update);
// Generic name — inline edit from prescription form, doctor/admin only (via createPrescriptions)
router.patch ('/medicines/:id/generic', authenticate, requirePermission('createPrescriptions'), medicineCtrl.setGeneric);
router.delete('/medicines/:id',         authenticate, requirePermission('manageMasterData'), medicineCtrl.remove);

// ── Lab Tests ─────────────────────────────────────────────
router.get   ('/lab-tests',          authenticate, labTestCtrl.getAll);
router.post  ('/lab-tests',          authenticate, requirePermission('createPrescriptions'), labTestCtrl.create);
router.put   ('/lab-tests/:id',      authenticate, requirePermission('manageMasterData'), labTestCtrl.update);
router.delete('/lab-tests/:id',      authenticate, requirePermission('manageMasterData'), labTestCtrl.remove);

// ── Complaints ────────────────────────────────────────────
router.get   ('/complaints',         authenticate, complainCtrl.getAll);
router.post  ('/complaints',         authenticate, requirePermission('createPrescriptions'), complainCtrl.create);
router.put   ('/complaints/:id',     authenticate, requirePermission('manageMasterData'), complainCtrl.update);
router.delete('/complaints/:id',     authenticate, requirePermission('manageMasterData'), complainCtrl.remove);

// ── Diagnoses ─────────────────────────────────────────────
router.get   ('/diagnoses',          authenticate, diagnosisCtrl.getAll);
router.post  ('/diagnoses',          authenticate, requirePermission('createPrescriptions'), diagnosisCtrl.create);
router.put   ('/diagnoses/:id',      authenticate, requirePermission('manageMasterData'), diagnosisCtrl.update);
router.delete('/diagnoses/:id',      authenticate, requirePermission('manageMasterData'), diagnosisCtrl.remove);

// ── Advice Options ────────────────────────────────────────
router.get   ('/advice',             authenticate, adviceCtrl.getAll);
router.post  ('/advice',             authenticate, requirePermission('createPrescriptions'), adviceCtrl.create);
router.put   ('/advice/:id',         authenticate, requirePermission('manageMasterData'), adviceCtrl.update);
router.delete('/advice/:id',         authenticate, requirePermission('manageMasterData'), adviceCtrl.remove);

// ── Medicine Notes ────────────────────────────────────────
router.get   ('/medicine-notes',     authenticate, medicineNoteCtrl.getAll);
router.post  ('/medicine-notes',     authenticate, requirePermission('createPrescriptions'), medicineNoteCtrl.create);
router.put   ('/medicine-notes/:id', authenticate, requirePermission('manageMasterData'), medicineNoteCtrl.update);
router.delete('/medicine-notes/:id', authenticate, requirePermission('manageMasterData'), medicineNoteCtrl.remove);

// ── Billing Items ─────────────────────────────────────────
router.get   ('/billing-items',      authenticate, billingItemCtrl.getAll);
router.post  ('/billing-items',      authenticate, requirePermission('manageMasterData'), billingItemCtrl.create);
router.put   ('/billing-items/:id',  authenticate, requirePermission('manageMasterData'), billingItemCtrl.update);
router.delete('/billing-items/:id',  authenticate, requirePermission('manageMasterData'), billingItemCtrl.remove);

// ── Dosage & Timing ───────────────────────────────────────
router.get   ('/dosage-options',     authenticate, dosageCtrl.getAll);
router.post  ('/dosage-options',     authenticate, requirePermission('manageMasterData'), dosageCtrl.create);
router.delete('/dosage-options/:id', authenticate, requirePermission('manageMasterData'), dosageCtrl.remove);

router.get   ('/timing-options',     authenticate, timingCtrl.getAll);
router.post  ('/timing-options',     authenticate, requirePermission('manageMasterData'), timingCtrl.create);
router.delete('/timing-options/:id', authenticate, requirePermission('manageMasterData'), timingCtrl.remove);

// ── Bulk seed ─────────────────────────────────────────────
router.post  ('/seed',               authenticate, requirePermission('manageMasterData'), seedMasterData);

module.exports = router;
