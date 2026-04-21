const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate, authorize, hasPermission } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/patient.controller');

// Quick search (for prescription dropdown)
router.get('/search',    authenticate, ctrl.searchPatients);
router.get('/next-code', authenticate, ctrl.getNextCode);

// All roles can view patients
router.get('/',    authenticate, ctrl.getPatients);
router.get('/:id', authenticate, ctrl.getPatient);

// Receptionist + Admin + Doctor can create/edit
router.post('/',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender required'),
    body('phone').notEmpty().withMessage('Phone required'),
  ],
  validate,
  ctrl.createPatient
);

router.put('/:id',  authenticate, ctrl.updatePatient);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.deletePatient);

// Vital records
router.post('/:id/vitals', authenticate, ctrl.addVitalRecord);

module.exports = router;
