// Lab Results / Test Outcomes - recorded by doctors during prescriptions.
// Hybrid storage: anchored to a prescription (prints with Rx) AND keyed to patient
// (queryable for trend charts across visits).

const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');
const { logAudit } = require('../lib/audit');

// Resolve the clinicId - super admin uses URL param, regular users use auth context.
function resolveClinicId(req) {
  if (req.user?.role === 'SUPER_ADMIN' && req.params.clinicId) return req.params.clinicId;
  return req.clinicId;
}

// Ensure given patient/prescription belong to the resolved clinic.
async function assertPatientInClinic(patientId, clinicId) {
  if (!patientId) return false;
  const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
  return !!p && p.clinicId === clinicId;
}
async function assertPrescriptionInClinic(prescriptionId, clinicId) {
  if (!prescriptionId) return true;  // prescriptionId is optional
  const rx = await prisma.prescription.findUnique({ where: { id: prescriptionId }, select: { clinicId: true } });
  return !!rx && rx.clinicId === clinicId;
}

// ── Create ──────────────────────────────────────────────
// Body: { patientId, prescriptionId?, labTestId?, testName, testCategory?, resultDate,
//         freeTextResult?, notes?, values?: [{ fieldKey, fieldLabel, fieldUnit?, value, normalLow?, normalHigh? }] }
async function createLabResult(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    if (!clinicId) return errorResponse(res, 'Clinic context missing', 400);

    const {
      patientId, prescriptionId, labTestId,
      testName, testCategory, resultDate,
      freeTextResult, notes, values,
    } = req.body || {};

    if (!patientId) return errorResponse(res, 'patientId is required', 400);
    if (!testName || !String(testName).trim()) return errorResponse(res, 'testName is required', 400);
    if (!resultDate) return errorResponse(res, 'resultDate is required', 400);

    const okPatient = await assertPatientInClinic(patientId, clinicId);
    if (!okPatient) return errorResponse(res, 'Patient not found in this clinic', 404);
    const okRx = await assertPrescriptionInClinic(prescriptionId, clinicId);
    if (!okRx) return errorResponse(res, 'Prescription not found in this clinic', 404);

    const created = await prisma.$transaction(async (tx) => {
      const result = await tx.labResult.create({
        data: {
          clinicId,
          patientId,
          prescriptionId: prescriptionId || null,
          labTestId: labTestId || null,
          testName: String(testName).trim(),
          testCategory: testCategory || null,
          resultDate: new Date(resultDate),
          freeTextResult: freeTextResult || null,
          notes: notes || null,
          recordedById: req.user?.id || null,
        },
      });
      if (Array.isArray(values) && values.length) {
        await tx.labResultValue.createMany({
          data: values
            .filter(v => v && v.fieldKey && v.fieldLabel && v.value !== undefined && v.value !== null && v.value !== '')
            .map(v => ({
              labResultId: result.id,
              fieldKey:   String(v.fieldKey),
              fieldLabel: String(v.fieldLabel),
              fieldUnit:  v.fieldUnit || null,
              value:      String(v.value),
              normalLow:  typeof v.normalLow === 'number' ? v.normalLow : null,
              normalHigh: typeof v.normalHigh === 'number' ? v.normalHigh : null,
            })),
        });
      }
      return tx.labResult.findUnique({ where: { id: result.id }, include: { values: true } });
    });

    await logAudit(req, {
      clinicId,
      action: 'lab_result.create',
      entity: 'LabResult',
      entityId: created.id,
      details: { testName: created.testName, patientId: created.patientId, prescriptionId: created.prescriptionId },
    });

    return successResponse(res, created, 'Lab result recorded', 201);
  } catch (err) {
    console.error('[createLabResult]', err);
    return errorResponse(res, 'Failed to create lab result', 500);
  }
}

// ── Update ──────────────────────────────────────────────
// Patch: testName, testCategory, resultDate, freeTextResult, notes, values (replace-all).
async function updateLabResult(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const { id } = req.params;
    const existing = await prisma.labResult.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Lab result not found', 404);
    if (existing.clinicId !== clinicId) return errorResponse(res, 'Forbidden', 403);

    const { testName, testCategory, resultDate, freeTextResult, notes, values } = req.body || {};
    const updateData = {};
    if (testName !== undefined)       updateData.testName       = String(testName).trim();
    if (testCategory !== undefined)   updateData.testCategory   = testCategory || null;
    if (resultDate !== undefined)     updateData.resultDate     = new Date(resultDate);
    if (freeTextResult !== undefined) updateData.freeTextResult = freeTextResult || null;
    if (notes !== undefined)          updateData.notes          = notes || null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.labResult.update({ where: { id }, data: updateData });
      if (Array.isArray(values)) {
        await tx.labResultValue.deleteMany({ where: { labResultId: id } });
        if (values.length) {
          await tx.labResultValue.createMany({
            data: values
              .filter(v => v && v.fieldKey && v.fieldLabel && v.value !== undefined && v.value !== null && v.value !== '')
              .map(v => ({
                labResultId: id,
                fieldKey:   String(v.fieldKey),
                fieldLabel: String(v.fieldLabel),
                fieldUnit:  v.fieldUnit || null,
                value:      String(v.value),
                normalLow:  typeof v.normalLow === 'number' ? v.normalLow : null,
                normalHigh: typeof v.normalHigh === 'number' ? v.normalHigh : null,
              })),
          });
        }
      }
      return tx.labResult.findUnique({ where: { id }, include: { values: true } });
    });

    await logAudit(req, {
      clinicId, action: 'lab_result.update', entity: 'LabResult', entityId: id,
      details: { testName: updated.testName },
    });

    return successResponse(res, updated, 'Lab result updated');
  } catch (err) {
    console.error('[updateLabResult]', err);
    return errorResponse(res, 'Failed to update lab result', 500);
  }
}

// ── Delete ──────────────────────────────────────────────
async function deleteLabResult(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const { id } = req.params;
    const existing = await prisma.labResult.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Lab result not found', 404);
    if (existing.clinicId !== clinicId) return errorResponse(res, 'Forbidden', 403);

    await prisma.labResult.delete({ where: { id } });
    await logAudit(req, {
      clinicId, action: 'lab_result.delete', entity: 'LabResult', entityId: id,
      details: { testName: existing.testName },
    });

    return successResponse(res, { id }, 'Lab result deleted');
  } catch (err) {
    console.error('[deleteLabResult]', err);
    return errorResponse(res, 'Failed to delete lab result', 500);
  }
}

// ── Get all results for a prescription ─────────────────
async function getResultsByPrescription(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const { prescriptionId } = req.params;
    const rx = await prisma.prescription.findUnique({ where: { id: prescriptionId }, select: { clinicId: true } });
    if (!rx) return errorResponse(res, 'Prescription not found', 404);
    if (rx.clinicId !== clinicId) return errorResponse(res, 'Forbidden', 403);

    const results = await prisma.labResult.findMany({
      where: { prescriptionId },
      include: { values: true },
      orderBy: [{ resultDate: 'desc' }, { createdAt: 'desc' }],
    });
    return successResponse(res, results);
  } catch (err) {
    console.error('[getResultsByPrescription]', err);
    return errorResponse(res, 'Failed to fetch lab results', 500);
  }
}

// ── Get all historical results for a patient (for tab + charts) ──
async function getResultsByPatient(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const { patientId } = req.params;
    const okPatient = await assertPatientInClinic(patientId, clinicId);
    if (!okPatient) return errorResponse(res, 'Patient not found in this clinic', 404);

    const results = await prisma.labResult.findMany({
      where: { patientId },
      include: { values: true, prescription: { select: { id: true, rxNo: true, date: true } } },
      orderBy: [{ resultDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return successResponse(res, results);
  } catch (err) {
    console.error('[getResultsByPatient]', err);
    return errorResponse(res, 'Failed to fetch patient lab results', 500);
  }
}

// ── Trend for a specific test for a patient (chart data) ──
// Returns time-series for each fieldKey of the given test, suitable for line chart.
async function getPatientTestTrend(req, res) {
  try {
    const clinicId = resolveClinicId(req);
    const { patientId } = req.params;
    const { testName } = req.query;
    if (!testName) return errorResponse(res, 'testName query is required', 400);

    const okPatient = await assertPatientInClinic(patientId, clinicId);
    if (!okPatient) return errorResponse(res, 'Patient not found in this clinic', 404);

    // Case-insensitive test name match
    const results = await prisma.labResult.findMany({
      where: {
        patientId,
        testName: { equals: String(testName), mode: 'insensitive' },
      },
      include: { values: true },
      orderBy: { resultDate: 'asc' },  // ascending for chart left-to-right time axis
      take: 100,
    });

    // Build per-field series: { fieldKey: { label, unit, low, high, points: [{ date, value }] } }
    const series = {};
    for (const r of results) {
      for (const v of (r.values || [])) {
        if (!series[v.fieldKey]) {
          series[v.fieldKey] = {
            fieldKey:   v.fieldKey,
            label:      v.fieldLabel,
            unit:       v.fieldUnit,
            normalLow:  v.normalLow,
            normalHigh: v.normalHigh,
            points:     [],
          };
        }
        // Try to parse value as number for charting; non-numeric values (e.g. "Negative") get nulled but still tracked.
        const num = Number(String(v.value).replace(/[^\d.\-]/g, ''));
        series[v.fieldKey].points.push({
          date: r.resultDate,
          value: Number.isFinite(num) ? num : null,
          rawValue: v.value,
          resultId: r.id,
        });
      }
    }

    return successResponse(res, { testName, count: results.length, series: Object.values(series) });
  } catch (err) {
    console.error('[getPatientTestTrend]', err);
    return errorResponse(res, 'Failed to fetch trend', 500);
  }
}

module.exports = {
  createLabResult,
  updateLabResult,
  deleteLabResult,
  getResultsByPrescription,
  getResultsByPatient,
  getPatientTestTrend,
};
