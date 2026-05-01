// IPD Vitals controller — time-series readings for an admission.
//
// Different from OPD VitalRecord (1 per Rx). Here vitals are recorded
// frequently (every 4 hours typically, more in ICU). Used for trend charts
// and clinical monitoring.
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → recordIPDVitals (Admin, Doctor, Nurse)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

async function loadAdmission(req, res, allowClosed = false) {
  const admission = await prisma.admission.findFirst({
    where: { id: req.params.admissionId, clinicId: req.clinicId },
  })
  if (!admission) {
    errorResponse(res, 'Admission not found', 404)
    return null
  }
  if (!allowClosed && admission.status !== 'ADMITTED') {
    errorResponse(res, 'Cannot record on a closed admission', 400)
    return null
  }
  return admission
}

// ── List vitals (newest first) ────────────────────────────
async function listVitals(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const vitals = await prisma.iPDVitalRecord.findMany({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'desc' },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    })
    return successResponse(res, vitals)
  } catch (err) {
    console.error('[listVitals]', err)
    return errorResponse(res, 'Failed to fetch vitals', 500)
  }
}

// ── Create a vital record ─────────────────────────────────
// Body: { recordedAt, bp, pulse, temperature, spo2, respRate, bloodSugar, painScore, notes }
// At least one numeric field should have a value, but we don't enforce —
// occasionally only notes are added.
async function createVital(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const {
      recordedAt,
      bp, pulse, temperature, spo2, respRate, bloodSugar, painScore,
      notes,
    } = req.body

    // Sanity checks — reject obviously bogus values rather than silently store
    const numericChecks = [
      ['pulse',       pulse,       30,  250],
      ['temperature', temperature, 90,  115],   // °F; tolerate °C if user used °C (interpret 30-45 range)
      ['spo2',        spo2,        50,  100],
      ['respRate',    respRate,    5,   80],
      ['bloodSugar',  bloodSugar,  20,  900],
      ['painScore',   painScore,   0,   10],
    ]
    for (const [field, val, min, max] of numericChecks) {
      if (val !== undefined && val !== null && val !== '') {
        const n = parseFloat(val)
        if (Number.isNaN(n) || n < min || n > max) {
          return errorResponse(res, `${field} must be a number between ${min} and ${max}`, 400)
        }
      }
    }

    const vital = await prisma.iPDVitalRecord.create({
      data: {
        admissionId:  admission.id,
        recordedAt:   recordedAt ? new Date(recordedAt) : new Date(),
        recordedById: req.user.id,
        bp:           bp?.trim() || null,
        pulse:        pulse !== undefined && pulse !== '' ? parseInt(pulse, 10) : null,
        temperature:  temperature !== undefined && temperature !== '' ? parseFloat(temperature) : null,
        spo2:         spo2 !== undefined && spo2 !== '' ? parseInt(spo2, 10) : null,
        respRate:     respRate !== undefined && respRate !== '' ? parseInt(respRate, 10) : null,
        bloodSugar:   bloodSugar !== undefined && bloodSugar !== '' ? parseInt(bloodSugar, 10) : null,
        painScore:    painScore !== undefined && painScore !== '' ? parseInt(painScore, 10) : null,
        notes:        notes?.trim() || null,
      },
      include: {
        recordedBy: { select: { id: true, name: true, role: true } },
      },
    })

    return successResponse(res, vital, 'Vitals recorded', 201)
  } catch (err) {
    console.error('[createVital]', err)
    return errorResponse(res, 'Failed to record vitals', 500)
  }
}

// ── Delete a vital record (only by author within 4 hours) ──
// Mistakes happen (entered for wrong patient, decimal in wrong place).
// We allow author-delete for 4 hours, then frozen.
async function deleteVital(req, res) {
  try {
    const vital = await prisma.iPDVitalRecord.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!vital) return errorResponse(res, 'Vital record not found', 404)

    if (vital.recordedById !== req.user.id) {
      return errorResponse(res, 'Only the author can delete this entry', 403)
    }
    const ageMs = Date.now() - new Date(vital.createdAt).getTime()
    if (ageMs > 4 * 60 * 60 * 1000) {
      return errorResponse(res, 'Vitals can only be deleted within 4 hours of recording', 400)
    }

    await prisma.iPDVitalRecord.delete({ where: { id: req.params.id } })
    return successResponse(res, null, 'Vital record deleted')
  } catch (err) {
    console.error('[deleteVital]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

module.exports = {
  listVitals,
  createVital,
  deleteVital,
}
