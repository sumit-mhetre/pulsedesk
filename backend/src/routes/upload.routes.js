const router = require('express').Router();
const multer = require('multer');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { errorResponse } = require('../lib/response');
const ctrl = require('../controllers/upload.controller');

// In-memory storage — buffers are streamed straight to Cloudinary, never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB cap
  fileFilter(req, file, cb) {
    const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} not allowed. Use PNG, JPG, WEBP, or SVG.`));
    }
    cb(null, true);
  },
});

// Wrap multer to convert errors into JSON responses (multer otherwise crashes the request)
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : err.message;
      return errorResponse(res, msg, 400);
    }
    next();
  });
}

// Permission picker: clinic-level kinds need manageSettings; doctor's own signature/stamp = createPrescriptions (any doctor)
function permissionForKind(req, res, next) {
  const kind = req.body?.kind;
  // We can't yet read body.kind reliably here because multer hasn't run yet — so we apply both gates
  // Actually we already have it via multipart parse. Body kind is just the form field.
  if (!kind) return next();  // controller will reject

  const clinicLevel  = ['logo', 'footer', 'letterhead'].includes(kind);
  const doctorLevel  = ['signature', 'stamp'].includes(kind);

  if (clinicLevel)  return requirePermission('manageSettings')(req, res, next);
  if (doctorLevel)  return requirePermission('createPrescriptions')(req, res, next);
  return next();
}

router.post('/image',
  authenticate,
  handleUpload,           // parse multipart first so req.body.kind exists
  permissionForKind,
  ctrl.uploadImage
);

router.delete('/image',
  authenticate,
  permissionForKind,
  ctrl.deleteImage
);

module.exports = router;
