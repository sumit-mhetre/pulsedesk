const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

const VALID_TYPES = ['FITNESS_CERT', 'MEDICAL_CERT', 'REFERRAL'];

// ── List templates (optionally filtered by type) ─────────
async function listTemplates(req, res) {
  try {
    const { type } = req.query;
    const where = { clinicId: req.clinicId };
    if (type && VALID_TYPES.includes(type)) where.type = type;

    const templates = await prisma.medicalDocumentTemplate.findMany({
      where,
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    return successResponse(res, templates);
  } catch (err) {
    console.error('[listTemplates]', err);
    return errorResponse(res, 'Failed to list templates', 500);
  }
}

// ── Create ───────────────────────────────────────────────
async function createTemplate(req, res) {
  try {
    const { type, name, isDefault, diagnosis, remarks, data } = req.body || {};
    if (!type || !VALID_TYPES.includes(type)) {
      return errorResponse(res, `type must be one of: ${VALID_TYPES.join(', ')}`, 400);
    }
    if (!name || !String(name).trim()) {
      return errorResponse(res, 'Template name is required', 400);
    }

    // Unique name per type per clinic - pre-check to give friendly error
    const exists = await prisma.medicalDocumentTemplate.findFirst({
      where: { clinicId: req.clinicId, type, name: name.trim() },
    });
    if (exists) return errorResponse(res, 'A template with this name already exists for this document type', 409);

    const tpl = await prisma.medicalDocumentTemplate.create({
      data: {
        clinicId:  req.clinicId,
        type,
        name:      name.trim(),
        isDefault: !!isDefault,
        diagnosis: (diagnosis || '').trim() || null,
        remarks:   (remarks   || '').trim() || null,
        data:      (data && typeof data === 'object') ? data : {},
      },
    });
    return successResponse(res, tpl, 'Template created', 201);
  } catch (err) {
    console.error('[createTemplate]', err);
    return errorResponse(res, 'Failed to create template', 500);
  }
}

// ── Update ───────────────────────────────────────────────
async function updateTemplate(req, res) {
  try {
    const existing = await prisma.medicalDocumentTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Template not found', 404);

    const { name, isDefault, diagnosis, remarks, data } = req.body || {};
    const updateData = {};
    if (name      !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return errorResponse(res, 'Template name cannot be empty', 400);
      updateData.name = trimmed;
    }
    if (isDefault !== undefined) updateData.isDefault = !!isDefault;
    if (diagnosis !== undefined) updateData.diagnosis = (diagnosis || '').trim() || null;
    if (remarks   !== undefined) updateData.remarks   = (remarks   || '').trim() || null;
    if (data      !== undefined) updateData.data      = (data && typeof data === 'object') ? data : {};

    const tpl = await prisma.medicalDocumentTemplate.update({
      where: { id: existing.id },
      data:  updateData,
    });
    return successResponse(res, tpl, 'Template updated');
  } catch (err) {
    console.error('[updateTemplate]', err);
    return errorResponse(res, 'Failed to update template', 500);
  }
}

// ── Delete ───────────────────────────────────────────────
async function deleteTemplate(req, res) {
  try {
    const existing = await prisma.medicalDocumentTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Template not found', 404);

    await prisma.medicalDocumentTemplate.delete({ where: { id: existing.id } });
    return successResponse(res, null, 'Template deleted');
  } catch (err) {
    console.error('[deleteTemplate]', err);
    return errorResponse(res, 'Failed to delete template', 500);
  }
}

module.exports = { listTemplates, createTemplate, updateTemplate, deleteTemplate };
