// Prescription attachments — upload jpg/png/pdf, list, delete.
//
// Privacy: attachments inherit the prescription's privacy. We always check
// access to the prescription first (using the same doctorPrivacyWhere
// helper) before allowing any read/write on its attachments.
//
// Cloudinary: uploadRaw preserves the original file (no image transforms),
// so PDFs come back as PDFs and JPEGs stay as JPEGs.

const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');
const { uploadRaw, deleteByPublicId } = require('../lib/cloudinary');
const { doctorPrivacyWhere, getClinicSharingFlags } = require('../lib/dataPrivacy');

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'application/pdf',
]);
const MAX_BYTES         = 5 * 1024 * 1024;   // 5 MB per file
const MAX_FILES_PER_RX  = 10;

// Reusable: load the prescription if the user is allowed to see it.
// Returns the row, or null if not found / not allowed.
async function loadAccessibleRx(req, prescriptionId) {
  const flags = await getClinicSharingFlags(req);
  return prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      clinicId: req.clinicId,
      ...doctorPrivacyWhere(req, flags.sharePrescriptions, { allowNull: false }),
    },
    select: { id: true, doctorId: true },
  });
}

async function listAttachments(req, res) {
  try {
    const rx = await loadAccessibleRx(req, req.params.prescriptionId);
    if (!rx) return errorResponse(res, 'Prescription not found', 404);

    const items = await prisma.prescriptionAttachment.findMany({
      where: { prescriptionId: rx.id },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return successResponse(res, items);
  } catch (err) {
    console.error('[listAttachments]', err);
    return errorResponse(res, 'Failed to fetch attachments', 500);
  }
}

async function uploadAttachment(req, res) {
  try {
    const rx = await loadAccessibleRx(req, req.params.prescriptionId);
    if (!rx) return errorResponse(res, 'Prescription not found', 404);

    if (!req.file) return errorResponse(res, 'No file uploaded', 400);
    const { mimetype, originalname, size, buffer } = req.file;

    if (!ALLOWED_MIME.has(mimetype)) {
      return errorResponse(res, `File type not allowed: ${mimetype}. Allowed: JPEG, PNG, PDF.`, 400);
    }
    if (size > MAX_BYTES) {
      return errorResponse(res, `File too large (${Math.round(size/1024/1024)} MB). Max 5 MB.`, 400);
    }

    // Per-Rx file count cap.
    const existing = await prisma.prescriptionAttachment.count({ where: { prescriptionId: rx.id } });
    if (existing >= MAX_FILES_PER_RX) {
      return errorResponse(res, `Max ${MAX_FILES_PER_RX} attachments per prescription`, 400);
    }

    const upload = await uploadRaw(buffer, {
      kind:     'rx-attachment',
      entityId: rx.id,
      mimeType: mimetype,
      filename: originalname,
    });

    const att = await prisma.prescriptionAttachment.create({
      data: {
        prescriptionId: rx.id,
        clinicId:       req.clinicId,
        uploadedById:   req.user?.id || null,
        url:            upload.secure_url,
        publicId:       upload.public_id,
        filename:       originalname,
        mimeType:       mimetype,
        sizeBytes:      size,
        resourceType:   upload.resource_type || 'image',
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return successResponse(res, att, 'Attachment uploaded', 201);
  } catch (err) {
    console.error('[uploadAttachment]', err);
    // Cloudinary errors often leak credential hints; show a friendlier message.
    return errorResponse(res, err?.message?.includes('Cloudinary') ? 'Upload service not configured. Contact admin.' : 'Failed to upload attachment', 500);
  }
}

async function deleteAttachment(req, res) {
  try {
    const att = await prisma.prescriptionAttachment.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: { prescription: { select: { id: true, doctorId: true } } },
    });
    if (!att) return errorResponse(res, 'Attachment not found', 404);

    // Only the uploader OR admin can delete. (Doctors cannot delete each
    // other's attachments even when sharing is on - matches template policy.)
    const role = req.user?.role;
    const isAdmin    = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isUploader = att.uploadedById && att.uploadedById === req.user?.id;
    if (!isAdmin && !isUploader) {
      return errorResponse(res, 'You can only delete attachments you uploaded', 403);
    }

    await prisma.prescriptionAttachment.delete({ where: { id: att.id } });
    // Best-effort Cloudinary cleanup. We don't fail the request if this errors.
    if (att.publicId) deleteByPublicId(att.publicId, att.resourceType || 'image').catch(() => {});

    return successResponse(res, null, 'Attachment deleted');
  } catch (err) {
    console.error('[deleteAttachment]', err);
    return errorResponse(res, 'Failed to delete attachment', 500);
  }
}

module.exports = { listAttachments, uploadAttachment, deleteAttachment };
