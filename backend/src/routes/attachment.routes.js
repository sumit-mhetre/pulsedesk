const router = require('express').Router();
const multer = require('multer');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { errorResponse } = require('../lib/response');
const ctrl = require('../controllers/attachment.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB cap
  fileFilter(req, file, cb) {
    const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} not allowed. Use JPEG, PNG or PDF.`));
    }
    cb(null, true);
  },
});

// Wrap multer to convert errors into JSON responses
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message;
      return errorResponse(res, msg, 400);
    }
    next();
  });
}

// IMPORTANT: This router is mounted at `/api` (root). We CANNOT use
// `router.use(authenticate)` here because it would leak into every
// /api/* route mounted *after* this one in index.js (health, documents,
// ipd, etc) and lock them all behind Bearer auth. Instead each route
// declares its own auth middleware.

// Stream a saved attachment. Uses query-param token (?t=jwt) because
// <img src> and <a href> can't send Authorization headers. The controller
// verifies the token internally; this route has NO Bearer middleware.
router.get('/prescriptions/attachments/:id/file', ctrl.streamAttachment);

// List attachments for a prescription. viewPrescriptions covers doctor +
// receptionist (after the recent permission change) + admin.
router.get('/prescriptions/:prescriptionId/attachments',
  authenticate,
  requirePermission('viewPrescriptions'),
  ctrl.listAttachments
);

// Upload a new attachment. createPrescriptions covers doctor + admin only -
// receptionist can VIEW but not upload (they don't create Rx clinical content).
router.post('/prescriptions/:prescriptionId/attachments',
  authenticate,
  requirePermission('createPrescriptions'),
  handleUpload,
  ctrl.uploadAttachment
);

// Delete attachment. Permission gate is loose (createPrescriptions); the
// controller does an additional check that the user is the uploader OR admin.
router.delete('/prescriptions/attachments/:id',
  authenticate,
  requirePermission('createPrescriptions'),
  ctrl.deleteAttachment
);

module.exports = router;
