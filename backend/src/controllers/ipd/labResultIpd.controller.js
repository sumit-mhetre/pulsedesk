// IPD-scoped lab result controller -- wraps the existing LabResult model
// to expose admission-scoped operations.
//
// Architecture:
//   - LabResult is the SAME model used by OPD prescriptions
//   - We just filter/scope by admissionId here for IPD context
//   - For new IPD lab entries, admissionId is set; prescriptionId stays null
//     (lab was ordered via IPD Order, not via prescription)
//   - Optionally also linked to an IPDOrder via the order's labTestId reference
//     (handled via labTestId on LabResult)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// ── List lab results for an admission ─────────────────────
async function listResultsByAdmission(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true, patientId: true, admittedAt: true, dischargedAt: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    // Two strategies for "what counts as this admission's results":
    //   A. Direct link: LabResult.admissionId == admission.id
    //   B. Time-based: LabResults for same patient, recorded between admittedAt
    //      and dischargedAt (catches results that weren't directly linked)
    // We use BOTH and dedupe -- so users see all relevant results.

    const endDate = admission.dischargedAt || new Date()

    const directlyLinked = await prisma.labResult.findMany({
      where: { admissionId: admission.id, clinicId: req.clinicId },
      orderBy: { resultDate: 'desc' },
      include: {
        labTest:     { select: { id: true, name: true, category: true, expectedFields: true } },
        values:      true,
      },
    })

    const timeBased = await prisma.labResult.findMany({
      where: {
        clinicId:   req.clinicId,
        patientId:  admission.patientId,
        resultDate: { gte: admission.admittedAt, lte: endDate },
        admissionId: null,  // exclude already-direct-linked
      },
      orderBy: { resultDate: 'desc' },
      include: {
        labTest: { select: { id: true, name: true, category: true, expectedFields: true } },
        values:  true,
      },
    })

    return successResponse(res, [...directlyLinked, ...timeBased])
  } catch (err) {
    console.error('[listResultsByAdmission]', err)
    return errorResponse(res, 'Failed to fetch lab results', 500)
  }
}

// ── Create lab result linked to admission ─────────────────
// Body:
//   - labTestId (optional, links to LabTest catalog)
//   - testName  (required, free text or matches labTestId.name)
//   - testCategory (optional)
//   - resultDate (required ISO datetime)
//   - freeTextResult (optional, for free-text tests)
//   - notes (optional)
//   - values (optional array of { fieldKey, fieldLabel, fieldUnit, value, normalLow, normalHigh })
async function createResult(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true, patientId: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const {
      labTestId, testName, testCategory, resultDate,
      freeTextResult, notes, values,
    } = req.body

    if (!testName?.trim()) return errorResponse(res, 'testName is required', 400)
    if (!resultDate) return errorResponse(res, 'resultDate is required', 400)

    // Verify labTest if provided
    if (labTestId) {
      const lt = await prisma.labTest.findFirst({
        where: { id: labTestId, clinicId: req.clinicId },
      })
      if (!lt) return errorResponse(res, 'Lab test not found in catalog', 404)
    }

    const result = await prisma.labResult.create({
      data: {
        clinicId:       req.clinicId,
        patientId:      admission.patientId,
        admissionId:    admission.id,
        prescriptionId: null,
        labTestId:      labTestId || null,
        testName:       testName.trim(),
        testCategory:   testCategory?.trim() || null,
        resultDate:     new Date(resultDate),
        freeTextResult: freeTextResult?.trim() || null,
        notes:          notes?.trim() || null,
        recordedById:   req.user.id,
        values: values?.length > 0 ? {
          create: values.map(v => ({
            fieldKey:   v.fieldKey,
            fieldLabel: v.fieldLabel,
            fieldUnit:  v.fieldUnit || null,
            value:      String(v.value),
            normalLow:  v.normalLow !== undefined ? parseFloat(v.normalLow) : null,
            normalHigh: v.normalHigh !== undefined ? parseFloat(v.normalHigh) : null,
          })),
        } : undefined,
      },
      include: {
        labTest: { select: { id: true, name: true, category: true, expectedFields: true } },
        values:  true,
      },
    })

    return successResponse(res, result, 'Lab result recorded', 201)
  } catch (err) {
    console.error('[createResult]', err)
    return errorResponse(res, err.message || 'Failed to record', 500)
  }
}

// ── Update lab result ─────────────────────────────────────
async function updateResult(req, res) {
  try {
    const result = await prisma.labResult.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!result) return errorResponse(res, 'Lab result not found', 404)

    const { resultDate, freeTextResult, notes, testCategory, values } = req.body

    const data = {}
    if (resultDate     !== undefined) data.resultDate     = new Date(resultDate)
    if (freeTextResult !== undefined) data.freeTextResult = freeTextResult?.trim() || null
    if (notes          !== undefined) data.notes          = notes?.trim() || null
    if (testCategory   !== undefined) data.testCategory   = testCategory?.trim() || null

    // Replace values array if provided
    if (Array.isArray(values)) {
      await prisma.labResultValue.deleteMany({ where: { labResultId: result.id } })
      data.values = {
        create: values.map(v => ({
          fieldKey:   v.fieldKey,
          fieldLabel: v.fieldLabel,
          fieldUnit:  v.fieldUnit || null,
          value:      String(v.value),
          normalLow:  v.normalLow !== undefined ? parseFloat(v.normalLow) : null,
          normalHigh: v.normalHigh !== undefined ? parseFloat(v.normalHigh) : null,
        })),
      }
    }

    const updated = await prisma.labResult.update({
      where: { id: result.id },
      data,
      include: {
        labTest: { select: { id: true, name: true, category: true, expectedFields: true } },
        values:  true,
      },
    })
    return successResponse(res, updated, 'Updated')
  } catch (err) {
    console.error('[updateResult]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

// ── Delete lab result ─────────────────────────────────────
async function deleteResult(req, res) {
  try {
    const result = await prisma.labResult.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!result) return errorResponse(res, 'Lab result not found', 404)

    await prisma.labResult.delete({ where: { id: result.id } })
    return successResponse(res, { success: true }, 'Deleted')
  } catch (err) {
    console.error('[deleteResult]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

// ── List available lab tests (master) ─────────────────────
// Used by the lab-result-entry modal to pick a test from catalog.
async function listLabTestsForCatalog(req, res) {
  try {
    const tests = await prisma.labTest.findMany({
      where: { clinicId: req.clinicId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, category: true, expectedFields: true,
      },
    })
    return successResponse(res, tests)
  } catch (err) {
    console.error('[listLabTestsForCatalog]', err)
    return errorResponse(res, 'Failed to fetch lab tests', 500)
  }
}

module.exports = {
  listResultsByAdmission,
  createResult,
  updateResult,
  deleteResult,
  listLabTestsForCatalog,
}
