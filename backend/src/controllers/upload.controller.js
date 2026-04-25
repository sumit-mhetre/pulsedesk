const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');
const { uploadBuffer, deleteByPublicId, publicIdFromUrl } = require('../lib/cloudinary');

const VALID_KINDS = ['logo', 'header', 'footer', 'letterhead', 'signature', 'stamp'];
const VALID_PROCESSING = ['original', 'auto-clean', 'high-contrast'];

// Map kind → which model + which column gets updated
const KIND_TO_FIELD = {
  logo:       { model: 'clinic', field: 'logo' },
  header:     { model: 'clinic', field: 'headerImageUrl' },
  footer:     { model: 'clinic', field: 'footerImageUrl' },
  letterhead: { model: 'clinic', field: 'letterheadUrl' },
  signature:  { model: 'user',   field: 'signature' },
  stamp:      { model: 'user',   field: 'stamp' },
};

/**
 * POST /api/upload/image
 * Form fields:
 *   - file        (binary, multer)
 *   - kind        'logo'|'footer'|'letterhead'|'signature'|'stamp'
 *   - processing  'original'|'auto-clean'|'high-contrast'  (default 'original')
 *
 * Persists URL onto the appropriate model column and returns the new URL.
 */
async function uploadImage(req, res) {
  try {
    if (!req.file) return errorResponse(res, 'No file provided', 400);
    const { kind, processing = 'original' } = req.body || {};

    if (!VALID_KINDS.includes(kind)) {
      return errorResponse(res, `Invalid kind. Must be one of: ${VALID_KINDS.join(', ')}`, 400);
    }
    if (!VALID_PROCESSING.includes(processing)) {
      return errorResponse(res, `Invalid processing mode. Must be one of: ${VALID_PROCESSING.join(', ')}`, 400);
    }

    const target = KIND_TO_FIELD[kind];
    const entityId = target.model === 'clinic' ? req.clinicId : req.user.id;

    // Permission gate (also enforced at route level, but defensive here)
    if (target.model === 'clinic') {
      // logo/footer/letterhead require manageSettings (route-gated)
    } else {
      // signature/stamp: only the doctor uploads their own (also route-gated)
    }

    // Upload to Cloudinary
    const result = await uploadBuffer(req.file.buffer, {
      kind, entityId, processing,
      filename: req.file.originalname,
    });

    // Read existing URL so we can delete the old asset after we save the new one
    let oldUrl = null;
    if (target.model === 'clinic') {
      const c = await prisma.clinic.findUnique({ where: { id: entityId }, select: { [target.field]: true } });
      oldUrl = c?.[target.field] || null;
    } else {
      const u = await prisma.user.findUnique({ where: { id: entityId }, select: { [target.field]: true } });
      oldUrl = u?.[target.field] || null;
    }

    // Persist URL on the entity
    const updateArgs = { where: { id: entityId }, data: { [target.field]: result.secure_url } };
    if (target.model === 'clinic') {
      await prisma.clinic.update(updateArgs);
    } else {
      await prisma.user.update(updateArgs);
    }

    // Best-effort delete of the previous asset
    if (oldUrl) {
      const oldPid = publicIdFromUrl(oldUrl);
      if (oldPid) deleteByPublicId(oldPid).catch(() => {});
    }

    return successResponse(res, {
      url:       result.secure_url,
      publicId:  result.public_id,
      width:     result.width,
      height:    result.height,
      bytes:     result.bytes,
      format:    result.format,
      kind,
      processing,
    }, 'Image uploaded');
  } catch (err) {
    console.error('[uploadImage]', err);
    const msg = err?.message?.includes('Cloudinary env vars')
      ? 'Image upload not configured on server. Please contact admin.'
      : (err?.message || 'Upload failed');
    return errorResponse(res, msg, 500);
  }
}

/**
 * DELETE /api/upload/image
 * Body: { kind }
 *
 * Removes the image URL from the entity AND deletes the file in Cloudinary.
 */
async function deleteImage(req, res) {
  try {
    const { kind } = req.body || {};
    if (!VALID_KINDS.includes(kind)) {
      return errorResponse(res, `Invalid kind`, 400);
    }
    const target = KIND_TO_FIELD[kind];
    const entityId = target.model === 'clinic' ? req.clinicId : req.user.id;

    // Read current URL
    let url = null;
    if (target.model === 'clinic') {
      const c = await prisma.clinic.findUnique({ where: { id: entityId }, select: { [target.field]: true } });
      url = c?.[target.field] || null;
    } else {
      const u = await prisma.user.findUnique({ where: { id: entityId }, select: { [target.field]: true } });
      url = u?.[target.field] || null;
    }

    if (!url) return successResponse(res, null, 'Already empty');

    // Clear column first (so even if Cloudinary delete fails, the UI state is consistent)
    const updateArgs = { where: { id: entityId }, data: { [target.field]: null } };
    if (target.model === 'clinic') {
      await prisma.clinic.update(updateArgs);
    } else {
      await prisma.user.update(updateArgs);
    }

    // Best-effort delete of the asset
    const pid = publicIdFromUrl(url);
    if (pid) await deleteByPublicId(pid);

    return successResponse(res, null, 'Image removed');
  } catch (err) {
    console.error('[deleteImage]', err);
    return errorResponse(res, err?.message || 'Delete failed', 500);
  }
}

module.exports = { uploadImage, deleteImage };
