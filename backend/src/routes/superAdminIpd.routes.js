// Super Admin IPD configuration routes.
// Mounted at /api/super/clinics/:id/ipd-* (added in index.js or super.routes.js)
//
// All routes require authorize('SUPER_ADMIN').

const router = require('express').Router()
const { authenticate, authorize } = require('../middleware/auth.middleware')
const ctrl = require('../controllers/superAdmin/clinicIpd.controller')

// Apply guards to all routes here
router.use(authenticate, authorize('SUPER_ADMIN'))

// ── IPD configuration (toggle, facility type, settings) ──
router.get('/clinics/:id/ipd-config', ctrl.getClinicIPDConfig)
router.put('/clinics/:id/ipd-config', ctrl.updateClinicIPDConfig)

// ── Bed inventory management ──────────────────────────────
router.get   ('/clinics/:id/beds',           ctrl.listClinicBeds)
router.post  ('/clinics/:id/beds',           ctrl.createClinicBed)
router.post  ('/clinics/:id/beds/bulk',      ctrl.bulkCreateBeds)
router.put   ('/clinics/:id/beds/:bedId',    ctrl.updateClinicBed)
router.delete('/clinics/:id/beds/:bedId',    ctrl.deleteClinicBed)

module.exports = router
