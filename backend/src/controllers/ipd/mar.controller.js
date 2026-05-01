// MAR (Medication Administration Record) controller — nurses mark each
// scheduled dose as Given / Refused / Held / Missed.
//
// When marked GIVEN, an IPDCharge of type MEDICINE is auto-created if the
// medicine has a price. (For v1 we don't have per-medicine pricing on the
// Medicine master — so by default no auto-charge. Receptionist can manually
// add medicine charges from the Charges tab. Future enhancement: add
// `defaultPrice` to Medicine model, then this hook activates.)
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → recordMAR (Admin, Nurse)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

const VALID_STATUSES = ['PENDING', 'GIVEN', 'REFUSED', 'HELD', 'MISSED']

// ── List MAR entries for an admission ─────────────────────
// Returns flat list across all orders, with order info included.
// Frontend groups by date or by order as needed.
async function listMAR(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const { from, to } = req.query
    const where = {
      order: { admissionId: admission.id },
    }
    if (from || to) {
      where.scheduledTime = {}
      if (from) where.scheduledTime.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.scheduledTime.lte = toDate
      }
    }

    const entries = await prisma.medicationAdministration.findMany({
      where,
      orderBy: { scheduledTime: 'asc' },
      include: {
        order: {
          select: {
            id: true, medicineName: true, dose: true, route: true,
            frequency: true, status: true,
          },
        },
        givenBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(res, entries)
  } catch (err) {
    console.error('[listMAR]', err)
    return errorResponse(res, 'Failed to fetch MAR', 500)
  }
}

// ── Record administration of a dose ───────────────────────
// Body: { status: GIVEN/REFUSED/HELD/MISSED, actualTime?, notes? }
// On GIVEN, calculates lateness and includes "(late)" marker if > 30 min off.
async function recordAdministration(req, res) {
  try {
    const entry = await prisma.medicationAdministration.findFirst({
      where: { id: req.params.id, order: { admission: { clinicId: req.clinicId } } },
      include: {
        order: { include: { admission: { select: { id: true, status: true, clinicId: true } } } },
      },
    })
    if (!entry) return errorResponse(res, 'MAR entry not found', 404)
    if (entry.order.admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot record on a closed admission', 400)
    }

    const { status, actualTime, notes } = req.body
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(res, `status must be one of: ${VALID_STATUSES.join(', ')}`, 400)
    }

    // For GIVEN: actualTime defaults to now, calculate lateness
    let actual = null
    let noteWithLate = notes?.trim() || null
    if (status === 'GIVEN') {
      actual = actualTime ? new Date(actualTime) : new Date()
      const diffMs = Math.abs(actual.getTime() - entry.scheduledTime.getTime())
      if (diffMs > 30 * 60 * 1000) {
        const mins = Math.round(diffMs / 60000)
        const lateMarker = `(late by ${mins} min)`
        noteWithLate = noteWithLate ? `${noteWithLate} ${lateMarker}` : lateMarker
      }
    }

    const updated = await prisma.medicationAdministration.update({
      where: { id: entry.id },
      data: {
        status,
        actualTime: actual,
        givenById:  status === 'GIVEN' ? req.user.id : null,
        notes:      noteWithLate,
      },
      include: {
        order:   { select: { id: true, medicineName: true, dose: true, route: true } },
        givenBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(res, updated, 'Recorded')
  } catch (err) {
    console.error('[recordAdministration]', err)
    return errorResponse(res, 'Failed to record', 500)
  }
}

// ── Add an unscheduled dose (SOS / extra given) ───────────
// For SOS / PRN orders, nurse needs to log when given. Body: { orderId, status, actualTime, notes }.
async function addUnscheduledDose(req, res) {
  try {
    const { orderId, status = 'GIVEN', actualTime, notes } = req.body

    const order = await prisma.medicationOrder.findFirst({
      where: { id: orderId, admission: { clinicId: req.clinicId } },
      include: { admission: { select: { status: true } } },
    })
    if (!order) return errorResponse(res, 'Order not found', 404)
    if (order.admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot record on a closed admission', 400)
    }
    if (!VALID_STATUSES.includes(status)) {
      return errorResponse(res, 'Invalid status', 400)
    }

    const time = actualTime ? new Date(actualTime) : new Date()
    const entry = await prisma.medicationAdministration.create({
      data: {
        orderId:       order.id,
        scheduledTime: time,
        actualTime:    status === 'GIVEN' ? time : null,
        status,
        givenById:     status === 'GIVEN' ? req.user.id : null,
        notes:         notes?.trim() || '(unscheduled)',
      },
      include: {
        order:   { select: { id: true, medicineName: true, dose: true, route: true } },
        givenBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(res, entry, 'Recorded', 201)
  } catch (err) {
    console.error('[addUnscheduledDose]', err)
    return errorResponse(res, 'Failed to record', 500)
  }
}

module.exports = {
  listMAR,
  recordAdministration,
  addUnscheduledDose,
}
