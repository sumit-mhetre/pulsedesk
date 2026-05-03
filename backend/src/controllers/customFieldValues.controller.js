// CustomFieldValue controller
// ─────────────────────────────────────────────
// Master-data style CRUD for autocomplete suggestions on clinic-defined Rx custom
// fields. Each row is a (clinic, fieldId, value) triple. Returns shapes that match
// what the frontend TagInput expects ({ id, nameEn }) so the same component can
// render suggestions for both built-in masters (complaints/diagnoses) and these.
//
// The fieldId is the cf_* id from the rx_form PageDesign config. We don't FK to it
// because PageDesign config is JSON (no rows), so orphans are possible - they just
// silently stop being shown when the matching custom field is removed from config.

const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// GET /api/master/custom-field-values?fieldId=cf_xxx
// If fieldId is omitted, returns ALL values for the clinic - used by the Rx form
// which fetches once and slices by fieldId locally to avoid N requests on mount.
const getAll = async (req, res) => {
  try {
    const { fieldId } = req.query;
    const where = { clinicId: req.clinicId };
    if (fieldId) where.fieldId = String(fieldId);
    const rows = await prisma.customFieldValue.findMany({
      where,
      orderBy: [{ fieldId: 'asc' }, { value: 'asc' }],
    });
    // Shape to match TagInput's expected items: [{id, nameEn, fieldId}]
    // Keeping fieldId on the row lets the frontend slice by it.
    const data = rows.map(r => ({ id: r.id, nameEn: r.value, fieldId: r.fieldId }));
    return successResponse(res, data);
  } catch (err) {
    console.error('[customFieldValues.getAll]', err);
    return errorResponse(res, 'Failed to fetch custom field values', 500);
  }
};

// POST /api/master/custom-field-values
// body: { fieldId: 'cf_xxx', value: 'Diabetes (mother)' }
// Idempotent: if (clinic, fieldId, value) already exists, returns it without error.
// This mirrors the autosave-on-save pattern used for complaints/diagnoses where
// new tags are quietly persisted to master without bothering the doctor.
const create = async (req, res) => {
  try {
    const fieldId = String(req.body.fieldId || '').trim();
    const value   = String(req.body.value   || '').trim();
    if (!fieldId) return errorResponse(res, 'fieldId is required', 400);
    if (!value)   return errorResponse(res, 'value is required',   400);
    if (value.length > 500) return errorResponse(res, 'value too long', 400);

    // Use upsert against the unique constraint to avoid race conditions when the
    // doctor saves the same Rx twice quickly or two users add the same value.
    const row = await prisma.customFieldValue.upsert({
      where: {
        clinicId_fieldId_value: {
          clinicId: req.clinicId,
          fieldId,
          value,
        },
      },
      update: {}, // no-op if already exists
      create: { clinicId: req.clinicId, fieldId, value },
    });
    return successResponse(
      res,
      { id: row.id, nameEn: row.value, fieldId: row.fieldId },
      'Saved',
      201,
    );
  } catch (err) {
    console.error('[customFieldValues.create]', err);
    return errorResponse(res, 'Failed to save value', 500);
  }
};

// DELETE /api/master/custom-field-values/:id
// Removes a single suggestion. Doesn't touch saved Rx records; existing rows still
// keep their values verbatim.
const remove = async (req, res) => {
  try {
    const existing = await prisma.customFieldValue.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Not found', 404);
    await prisma.customFieldValue.delete({ where: { id: existing.id } });
    return successResponse(res, { id: existing.id }, 'Deleted');
  } catch (err) {
    console.error('[customFieldValues.remove]', err);
    return errorResponse(res, 'Failed to delete value', 500);
  }
};

module.exports = { getAll, create, remove };
