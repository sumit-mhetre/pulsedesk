// IPD module routes -- clinic-scoped (uses req.clinicId from auth middleware).
// Mounted at /api/ipd in backend/src/index.js
//
// All routes require:
//   1. authenticate (sets req.user, req.clinicId)
//   2. requireIPD(permission) -- checks both clinic.ipdEnabled AND user permission

const router = require('express').Router()
const { authenticate } = require('../middleware/auth.middleware')
const { requireIPD } = require('../middleware/requireIPD')

const bedCtrl              = require('../controllers/ipd/bed.controller')
const admissionCtrl        = require('../controllers/ipd/admission.controller')
const roundNoteCtrl        = require('../controllers/ipd/roundNote.controller')
const vitalCtrl            = require('../controllers/ipd/ipdVital.controller')
const nursingCtrl          = require('../controllers/ipd/nursingNote.controller')
const ioCtrl               = require('../controllers/ipd/intakeOutput.controller')
const medOrderCtrl         = require('../controllers/ipd/medicationOrder.controller')
const marCtrl              = require('../controllers/ipd/mar.controller')
const chargeCtrl           = require('../controllers/ipd/ipdCharge.controller')
const billCtrl             = require('../controllers/ipd/ipdBill.controller')
const ipdOrderCtrl         = require('../controllers/ipd/ipdOrder.controller')
const consentCtrl          = require('../controllers/ipd/consent.controller')
const consultationCtrl     = require('../controllers/ipd/consultation.controller')
const dischargeSummaryCtrl = require('../controllers/ipd/dischargeSummary.controller')
const bedTransferCtrl      = require('../controllers/ipd/bedTransfer.controller')
const dashboardCtrl        = require('../controllers/ipd/ipdDashboard.controller')
const labResultIpdCtrl     = require('../controllers/ipd/labResultIpd.controller')

// ── IPD Dashboard ─────────────────────────────────────────
router.get('/dashboard', authenticate, requireIPD('manageIPD'), dashboardCtrl.getDashboard)

// ── Bed Board ─────────────────────────────────────────────
router.get('/beds/board', authenticate, requireIPD('manageIPD'), bedCtrl.getBedBoard)

// ── Bed CRUD ──────────────────────────────────────────────
router.get   ('/beds',                    authenticate, requireIPD('manageIPD'),         bedCtrl.listBeds)
router.post  ('/beds',                    authenticate, requireIPD('manageBeds'),        bedCtrl.createBed)
router.post  ('/beds/bulk',               authenticate, requireIPD('manageBeds'),        bedCtrl.bulkCreateBeds)
router.get   ('/beds/suggest-next',       authenticate, requireIPD('manageBeds'),        bedCtrl.suggestNextBedNumber)
router.put   ('/beds/:id',                authenticate, requireIPD('manageBeds'),        bedCtrl.updateBed)
router.delete('/beds/:id',                authenticate, requireIPD('manageBeds'),        bedCtrl.deleteBed)
router.patch ('/beds/:id/rate',           authenticate, requireIPD('manageIPDBilling'),  bedCtrl.updateBedRate)
router.patch ('/beds/:bedId/mark-clean',  authenticate, requireIPD('manageBeds'),        admissionCtrl.markBedClean)

// ── Admissions ────────────────────────────────────────────
router.get   ('/admissions',                 authenticate, requireIPD('manageIPD'),         admissionCtrl.listAdmissions)
router.get   ('/admissions/:id',             authenticate, requireIPD('manageIPD'),         admissionCtrl.getAdmission)
router.post  ('/admissions',                 authenticate, requireIPD('manageAdmissions'),  admissionCtrl.createAdmission)
router.put   ('/admissions/:id',             authenticate, requireIPD('manageAdmissions'),  admissionCtrl.updateAdmission)
router.post  ('/admissions/:id/discharge',   authenticate, requireIPD('dischargePatient'),  admissionCtrl.dischargeAdmission)

// ── Bed Transfers ─────────────────────────────────────────
router.get  ('/admissions/:admissionId/transfers',          authenticate, requireIPD('manageIPD'),         bedTransferCtrl.listTransfers)
router.post ('/admissions/:admissionId/transfer',           authenticate, requireIPD('manageAdmissions'),  bedTransferCtrl.transferBed)
router.get  ('/admissions/:admissionId/available-beds',     authenticate, requireIPD('manageAdmissions'),  bedTransferCtrl.listAvailableBeds)

// ── Round Notes ───────────────────────────────────────────
router.get  ('/admissions/:admissionId/round-notes', authenticate, requireIPD('manageIPD'),         roundNoteCtrl.listRoundNotes)
router.post ('/admissions/:admissionId/round-notes', authenticate, requireIPD('recordRoundNotes'),  roundNoteCtrl.createRoundNote)
router.put  ('/round-notes/:id',                     authenticate, requireIPD('recordRoundNotes'),  roundNoteCtrl.updateRoundNote)

// ── IPD Vitals ────────────────────────────────────────────
router.get   ('/admissions/:admissionId/vitals', authenticate, requireIPD('manageIPD'),         vitalCtrl.listVitals)
router.post  ('/admissions/:admissionId/vitals', authenticate, requireIPD('recordIPDVitals'),   vitalCtrl.createVital)
router.delete('/vitals/:id',                     authenticate, requireIPD('recordIPDVitals'),   vitalCtrl.deleteVital)

// ── Nursing Notes ─────────────────────────────────────────
router.get  ('/admissions/:admissionId/nursing-notes', authenticate, requireIPD('manageIPD'),          nursingCtrl.listNursingNotes)
router.post ('/admissions/:admissionId/nursing-notes', authenticate, requireIPD('recordNursingNotes'), nursingCtrl.createNursingNote)
router.put  ('/nursing-notes/:id',                     authenticate, requireIPD('recordNursingNotes'), nursingCtrl.updateNursingNote)

// ── Intake / Output ───────────────────────────────────────
router.get   ('/admissions/:admissionId/intake-output', authenticate, requireIPD('manageIPD'),          ioCtrl.listIntakeOutput)
router.post  ('/admissions/:admissionId/intake-output', authenticate, requireIPD('recordIntakeOutput'), ioCtrl.createIntakeOutput)
router.delete('/intake-output/:id',                     authenticate, requireIPD('recordIntakeOutput'), ioCtrl.deleteIntakeOutput)

// ── Medication Orders ─────────────────────────────────────
router.get  ('/admissions/:admissionId/medications', authenticate, requireIPD('manageIPD'),                medOrderCtrl.listOrders)
router.post ('/admissions/:admissionId/medications', authenticate, requireIPD('manageMedicationOrders'),   medOrderCtrl.createOrder)
router.post ('/admissions/:admissionId/medications/bulk', authenticate, requireIPD('manageMedicationOrders'), medOrderCtrl.bulkCreateOrders)
router.post ('/medications/:id/stop',                authenticate, requireIPD('manageMedicationOrders'),   medOrderCtrl.stopOrder)
router.post ('/medications/:id/refresh-schedule',    authenticate, requireIPD('manageMedicationOrders'),   medOrderCtrl.refreshSchedule)

// ── MAR ───────────────────────────────────────────────────
router.get  ('/admissions/:admissionId/mar', authenticate, requireIPD('manageIPD'),  marCtrl.listMAR)
router.post ('/mar/:id/record',              authenticate, requireIPD('recordMAR'),  marCtrl.recordAdministration)
router.post ('/mar/unscheduled',             authenticate, requireIPD('recordMAR'),  marCtrl.addUnscheduledDose)

// ── IPD Charges ───────────────────────────────────────────
router.get   ('/admissions/:admissionId/charges', authenticate, requireIPD('manageIPD'),          chargeCtrl.listCharges)
router.post  ('/admissions/:admissionId/charges', authenticate, requireIPD('manageIPDBilling'),   chargeCtrl.createCharge)
router.put   ('/charges/:id',                     authenticate, requireIPD('manageIPDBilling'),   chargeCtrl.updateCharge)
router.post  ('/charges/:id/void',                authenticate, requireIPD('manageIPDBilling'),   chargeCtrl.voidCharge)

// ── IPD Bills ─────────────────────────────────────────────
router.get  ('/admissions/:admissionId/bills',         authenticate, requireIPD('manageIPD'),         billCtrl.listAdmissionBills)
router.get  ('/admissions/:admissionId/bills/preview', authenticate, requireIPD('manageIPDBilling'),  billCtrl.previewBill)
router.post ('/admissions/:admissionId/bills',         authenticate, requireIPD('manageIPDBilling'),  billCtrl.generateBill)

// ── IPD Orders ────────────────────────────────────────────
router.get  ('/admissions/:admissionId/ipd-orders', authenticate, requireIPD('manageIPD'),         ipdOrderCtrl.listOrders)
router.post ('/admissions/:admissionId/ipd-orders', authenticate, requireIPD('manageIPDOrders'),   ipdOrderCtrl.createOrder)
router.put  ('/ipd-orders/:id',                     authenticate, requireIPD('manageIPDOrders'),   ipdOrderCtrl.updateOrder)
router.patch('/ipd-orders/:id/status',              authenticate, requireIPD('manageIPDOrders'),   ipdOrderCtrl.updateStatus)

// ── Consents ──────────────────────────────────────────────
router.get   ('/consents/template',                 authenticate, requireIPD('manageIPD'),       consentCtrl.getTemplate)
router.get   ('/admissions/:admissionId/consents',  authenticate, requireIPD('manageIPD'),       consentCtrl.listConsents)
router.post  ('/admissions/:admissionId/consents',  authenticate, requireIPD('manageConsents'),  consentCtrl.createConsent)
router.put   ('/consents/:id',                      authenticate, requireIPD('manageConsents'),  consentCtrl.updateConsent)
router.delete('/consents/:id',                      authenticate, requireIPD('manageConsents'),  consentCtrl.deleteConsent)

// ── Consultations ─────────────────────────────────────────
router.get   ('/admissions/:admissionId/consultations', authenticate, requireIPD('manageIPD'),            consultationCtrl.listConsultations)
router.post  ('/admissions/:admissionId/consultations', authenticate, requireIPD('manageConsultations'),  consultationCtrl.createConsultation)
router.post  ('/consultations/:id/response',            authenticate, requireIPD('manageConsultations'),  consultationCtrl.recordResponse)
router.delete('/consultations/:id',                     authenticate, requireIPD('manageConsultations'),  consultationCtrl.deleteConsultation)

// ── Discharge Summary ─────────────────────────────────────
router.get  ('/admissions/:admissionId/discharge-summary', authenticate, requireIPD('manageIPD'),        dischargeSummaryCtrl.getSummary)
router.put  ('/admissions/:admissionId/discharge-summary', authenticate, requireIPD('dischargePatient'), dischargeSummaryCtrl.updateSummary)

// Discharge medications (Section 11 of structured discharge summary)
router.get   ('/admissions/:admissionId/discharge-medications',              authenticate, requireIPD('manageIPD'),        dischargeSummaryCtrl.listDischargeMedications)
router.post  ('/admissions/:admissionId/discharge-medications',              authenticate, requireIPD('dischargePatient'), dischargeSummaryCtrl.addDischargeMedication)
router.post  ('/admissions/:admissionId/discharge-medications/copy-active',  authenticate, requireIPD('dischargePatient'), dischargeSummaryCtrl.copyActiveMedications)
router.put   ('/discharge-medications/:id',                                  authenticate, requireIPD('dischargePatient'), dischargeSummaryCtrl.updateDischargeMedication)
router.delete('/discharge-medications/:id',                                  authenticate, requireIPD('dischargePatient'), dischargeSummaryCtrl.deleteDischargeMedication)

// ── IPD Lab Results ───────────────────────────────────────
router.get   ('/admissions/:admissionId/lab-results',  authenticate, requireIPD('manageIPD'),  labResultIpdCtrl.listResultsByAdmission)
router.post  ('/admissions/:admissionId/lab-results',  authenticate, requireIPD('manageIPD'),  labResultIpdCtrl.createResult)
router.put   ('/lab-results/:id',                      authenticate, requireIPD('manageIPD'),  labResultIpdCtrl.updateResult)
router.delete('/lab-results/:id',                      authenticate, requireIPD('manageIPD'),  labResultIpdCtrl.deleteResult)
router.get   ('/lab-tests/catalog',                    authenticate, requireIPD('manageIPD'),  labResultIpdCtrl.listLabTestsForCatalog)

module.exports = router
