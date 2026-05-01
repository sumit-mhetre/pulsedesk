// Intake/Output controller — fluid balance tracking for an admission.
//
// Each row records inputs (oral, IV, RT feed) and outputs (urine, drain,
// vomit, stool count) at a point in time. Used clinically to monitor fluid
// balance, especially in ICU / post-op / dehydrated patients.
//
// All values are in mL except stoolCount (just a count).
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → recordIntakeOutput (Admin, Doctor, Nurse)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

const VALID_SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT']

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

// ── List I/O records ──────────────────────────────────────
// Also returns aggregate totals per day (used for the chart).
async function listIntakeOutput(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const records = await prisma.intakeOutputRecord.findMany({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'desc' },
      include: { recordedBy: { select: { id: true, name: true, role: true } } },
    })

    // Daily aggregates (group by yyyy-mm-dd of recordedAt)
    const dailyMap = {}
    for (const r of records) {
      const d = new Date(r.recordedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!dailyMap[key]) {
        dailyMap[key] = { date: key, intake: 0, output: 0, balance: 0, count: 0 }
      }
      const intake  = (r.oralIntake || 0) + (r.ivFluids || 0) + (r.rylesTubeFeed || 0)
      const output  = (r.urineOutput || 0) + (r.drainOutput || 0) + (r.vomit || 0)
      dailyMap[key].intake  += intake
      dailyMap[key].output  += output
      dailyMap[key].balance = dailyMap[key].intake - dailyMap[key].output
      dailyMap[key].count   += 1
    }
    const daily = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date))

    return successResponse(res, { records, daily })
  } catch (err) {
    console.error('[listIntakeOutput]', err)
    return errorResponse(res, 'Failed to fetch intake/output', 500)
  }
}

// ── Create I/O record ─────────────────────────────────────
async function createIntakeOutput(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const {
      recordedAt, shift,
      oralIntake, ivFluids, rylesTubeFeed,
      urineOutput, drainOutput, vomit, stoolCount,
      notes,
    } = req.body

    if (shift !== undefined && shift !== null && shift !== '' && !VALID_SHIFTS.includes(shift)) {
      return errorResponse(res, 'Invalid shift', 400)
    }

    // Sanity check ranges (in mL)
    const numericChecks = [
      ['oralIntake',    oralIntake,    0, 5000],
      ['ivFluids',      ivFluids,      0, 10000],
      ['rylesTubeFeed', rylesTubeFeed, 0, 5000],
      ['urineOutput',   urineOutput,   0, 10000],
      ['drainOutput',   drainOutput,   0, 5000],
      ['vomit',         vomit,         0, 3000],
      ['stoolCount',    stoolCount,    0, 30],
    ]
    for (const [field, val, min, max] of numericChecks) {
      if (val !== undefined && val !== null && val !== '') {
        const n = parseInt(val, 10)
        if (Number.isNaN(n) || n < min || n > max) {
          return errorResponse(res, `${field} must be between ${min} and ${max}`, 400)
        }
      }
    }

    // At least one field should have a value
    const anyValue = [oralIntake, ivFluids, rylesTubeFeed, urineOutput, drainOutput, vomit, stoolCount, notes]
      .some(v => v !== undefined && v !== null && v !== '')
    if (!anyValue) {
      return errorResponse(res, 'At least one value or note is required', 400)
    }

    const toIntOrNull = (v) =>
      v !== undefined && v !== null && v !== '' ? parseInt(v, 10) : null

    const record = await prisma.intakeOutputRecord.create({
      data: {
        admissionId:   admission.id,
        recordedAt:    recordedAt ? new Date(recordedAt) : new Date(),
        shift:         shift || null,
        recordedById:  req.user.id,
        oralIntake:    toIntOrNull(oralIntake),
        ivFluids:      toIntOrNull(ivFluids),
        rylesTubeFeed: toIntOrNull(rylesTubeFeed),
        urineOutput:   toIntOrNull(urineOutput),
        drainOutput:   toIntOrNull(drainOutput),
        vomit:         toIntOrNull(vomit),
        stoolCount:    toIntOrNull(stoolCount),
        notes:         notes?.trim() || null,
      },
      include: { recordedBy: { select: { id: true, name: true, role: true } } },
    })

    return successResponse(res, record, 'I/O recorded', 201)
  } catch (err) {
    console.error('[createIntakeOutput]', err)
    return errorResponse(res, 'Failed to record I/O', 500)
  }
}

// ── Delete I/O record (author within 4 hours) ─────────────
async function deleteIntakeOutput(req, res) {
  try {
    const record = await prisma.intakeOutputRecord.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!record) return errorResponse(res, 'Record not found', 404)

    if (record.recordedById !== req.user.id) {
      return errorResponse(res, 'Only the author can delete', 403)
    }
    const ageMs = Date.now() - new Date(record.createdAt).getTime()
    if (ageMs > 4 * 60 * 60 * 1000) {
      return errorResponse(res, 'Records can only be deleted within 4 hours', 400)
    }

    await prisma.intakeOutputRecord.delete({ where: { id: req.params.id } })
    return successResponse(res, null, 'Record deleted')
  } catch (err) {
    console.error('[deleteIntakeOutput]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

module.exports = {
  listIntakeOutput,
  createIntakeOutput,
  deleteIntakeOutput,
}
