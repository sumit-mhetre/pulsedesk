const router = require('express').Router();
const { authenticate, authorize, requirePermission } = require('../middleware/auth.middleware');
const {
  medicineCtrl, labTestCtrl, complainCtrl,
  diagnosisCtrl, adviceCtrl, medicineNoteCtrl, billingItemCtrl,
  dosageCtrl, timingCtrl, seedMasterData,
} = require('../controllers/masterdata.controller');
const customFieldValuesCtrl = require('../controllers/customFieldValues.controller');

// Reads - any authenticated user can read masters (needed for prescribing, billing, etc)
// Writes - manageMasterData, except inline-prescribing cases noted below

// ── Medicines ─────────────────────────────────────────────
router.get   ('/medicines',             authenticate, medicineCtrl.getAll);
// Create: lower bar - anyone who can prescribe can add a missing medicine on the fly
router.post  ('/medicines',             authenticate, requirePermission('createPrescriptions'), medicineCtrl.create);
router.put   ('/medicines/:id',         authenticate, requirePermission('manageMasterData'), medicineCtrl.update);
// Generic name - inline edit from prescription form, doctor/admin only (via createPrescriptions)
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

// ── Custom Field Values ───────────────────────────────────
// Autocomplete suggestions for clinic-defined Rx custom fields. Read by anyone who
// can see Rx forms; writes happen automatically when an Rx is saved with new values
// (the Rx form posts here via createPrescriptions permission, same as complaints).
router.get   ('/custom-field-values',     authenticate, customFieldValuesCtrl.getAll);
router.post  ('/custom-field-values',     authenticate, requirePermission('createPrescriptions'), customFieldValuesCtrl.create);
router.delete('/custom-field-values/:id', authenticate, requirePermission('manageMasterData'), customFieldValuesCtrl.remove);

// ── Bulk seed ─────────────────────────────────────────────
// Seed default master data - gated by 'loadDefaultMasterData' permission.
// ADMIN role gets this true by default. DOCTOR/RECEPTIONIST get it false by default
// but admin can grant it per-user via the Capabilities editor. SUPER_ADMIN bypasses
// all permission checks (handled inside requirePermission middleware).
router.post  ('/seed',               authenticate, requirePermission('loadDefaultMasterData'), seedMasterData);

module.exports = router;
