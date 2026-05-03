const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/patient.controller');

// Reads - any authenticated user can view patients
router.get('/search',    authenticate, ctrl.searchPatients);
router.get('/next-code', authenticate, ctrl.getNextCode);
router.get('/',          authenticate, ctrl.getPatients);
router.get('/:id',       authenticate, ctrl.getPatient);

// Writes - require managePatients
router.post('/',
  authenticate,
  requirePermission('managePatients'),
  [
    body('name').notEmpty().withMessage('Name required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender required'),
    body('phone').notEmpty().withMessage('Phone required'),
  ],
  validate,
  ctrl.createPatient
);

router.put   ('/:id', authenticate, requirePermission('managePatients'), ctrl.updatePatient);
router.delete('/:id', authenticate, requirePermission('managePatients'), ctrl.deletePatient);

// Vital records
router.post('/:id/vitals', authenticate, requirePermission('managePatients'), ctrl.addVitalRecord);

module.exports = router;
