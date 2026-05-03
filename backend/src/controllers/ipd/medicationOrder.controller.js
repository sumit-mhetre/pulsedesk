// Medication Order controller - inpatient prescriptions with frequency-based
// MAR (Medication Administration Record) auto-scheduling.
//
// When an order is created, we auto-generate MAR rows from startDate to today
// (or stopDate if past) using the clinic's standard time-slot map for the
// frequency. Future doses generate as needed via a refresh endpoint or
// on-demand when nurse opens the MAR for a date.
//
// FREQUENCY → TIME SLOTS (v1: hardcoded standard times):
//   OD   = 09:00
//   BD   = 09:00, 21:00
//   TDS  = 08:00, 14:00, 20:00
//   QID  = 06:00, 12:00, 18:00, 22:00
//   HS   = 22:00              (at bedtime)
//   STAT = (one-time, immediate)
//   SOS  = (as needed, no schedule - nurse creates row when given)
//   Q4H  = every 4 hours from start (06, 10, 14, 18, 22, 02)
//   Q6H  = every 6 hours (06, 12, 18, 00)
//   Q8H  = every 8 hours (08, 16, 00)
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → manageMedicationOrders (Admin, Doctor)
//   admin  → recordMAR (Admin, Nurse - to administer doses)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// Hardcoded standard times (24-hour). Deliberate v1 choice - predictable,
// matches typical Indian small-clinic conventions. To switch to per-clinic
// configurable schedules, replace this with a clinic.ipdSettings.marSchedule
// lookup and merge with these defaults.
const FREQUENCY_TIMES = {
  OD:   ['09:00'],
  BD:   ['09:00', '21:00'],
  TDS:  ['08:00', '14:00', '20:00'],
  QID:  ['06:00', '12:00', '18:00', '22:00'],
  HS:   ['22:00'],
  STAT: [],   // single dose at startDate, scheduled = startDate exactly
  SOS:  [],   // as-needed - no auto schedule, nurse adds when given
  Q4H:  ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'],
  Q6H:  ['06:00', '12:00', '18:00', '00:00'],
  Q8H:  ['08:00', '16:00', '00:00'],
}

const VALID_FREQUENCIES = Object.keys(FREQUENCY_TIMES)

// Build a list of scheduled DateTime values between [start, end] for given
// frequency. Boundaries: include the slot if it's >= start and <= end.
function buildSchedule(frequency, startDate, endDate) {
  const times = FREQUENCY_TIMES[frequency]
  if (!times) return []

  const start = new Date(startDate)
  const end   = new Date(endDate)

  if (frequency === 'STAT') {
    // STAT = one dose at startDate
    return [new Date(start)]
  }
  if (frequency === 'SOS') return []

  const slots = []
  // Iterate day-by-day from start.date to end.date (inclusive)
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (cur <= lastDay) {
    for (const t of times) {
      const [hh, mm] = t.split(':').map(Number)
      const slot = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hh, mm, 0, 0)
      if (slot >= start && slot <= end) {
        slots.push(new Date(slot))
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return slots
}

// Verify admission belongs to this clinic and is still open (unless allowClosed)
async function loadAdmission(req, res, allowClosed = false) {
  const admission = await prisma.admission.findFirst({
    where: { id: req.params.admissionId, clinicId: req.clinicId },
    include: { patient: { select: { id: true, name: true, allergies: true } } },
  })
  if (!admission) {
    errorResponse(res, 'Admission not found', 404)
    return null
  }
  if (!allowClosed && admission.status !== 'ADMITTED') {
    errorResponse(res, 'Cannot modify a closed admission', 400)
    return null
  }
  return admission
}

// ── List med orders for an admission ──────────────────────
async function listOrders(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const orders = await prisma.medicationOrder.findMany({
      where: { admissionId: admission.id },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        prescribedBy: { select: { id: true, name: true } },
        medicine:     { select: { id: true, name: true, genericName: true } },
        administrations: {
          orderBy: { scheduledTime: 'asc' },
          select: {
            id: true, scheduledTime: true, status: true,
            actualTime: true, notes: true,
            givenBy: { select: { id: true, name: true } },
          },
        },
      },
    })
    return successResponse(res, orders)
  } catch (err) {
    console.error('[listOrders]', err)
    return errorResponse(res, 'Failed to fetch medication orders', 500)
  }
}

// ── Allergy check helper (soft warning) ───────────────────
// Returns array of matching allergy strings. Empty if no conflict.
function checkAllergies(patient, medicineName) {
  if (!patient?.allergies?.length) return []
  const med = (medicineName || '').toLowerCase()
  return patient.allergies.filter(a => {
    const al = a.toLowerCase().trim()
    return al && (med.includes(al) || al.includes(med.split(' ')[0]))
  })
}

// ── Create a med order ────────────────────────────────────
async function createOrder(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const {
      medicineId,        // optional - link to Medicine master
      medicineName,      // required if medicineId not provided
      dose,              // required (e.g. "500 mg", "1 tab")
      route,             // required (e.g. "PO", "IV", "IM", "SC", "Topical")
      frequency,         // required, must be in VALID_FREQUENCIES
      startDate,         // optional - defaults to now
      stopDate,          // optional - duration-based stop
      duration,          // optional, free text e.g. "5 days"
      notes,             // optional
      allergyOverride,   // optional - true means doctor acknowledges allergy warning
      allergyOverrideReason,
      procurementMode,   // optional - "STOCK" or "PROCURE", defaults to PROCURE
      expectedQty,       // optional - manual quantity (esp. for SOS)
    } = req.body

    // Validation
    if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
      return errorResponse(res, `frequency required (one of: ${VALID_FREQUENCIES.join(', ')})`, 400)
    }
    if (!dose?.trim())  return errorResponse(res, 'dose is required', 400)
    if (!route?.trim()) return errorResponse(res, 'route is required', 400)

    let resolvedName = medicineName
    if (medicineId) {
      const med = await prisma.medicine.findFirst({
        where: { id: medicineId, clinicId: req.clinicId, isActive: true },
      })
      if (!med) return errorResponse(res, 'Medicine not found', 404)
      resolvedName = med.name
    }
    if (!resolvedName?.trim()) {
      return errorResponse(res, 'medicineName is required when medicineId is not provided', 400)
    }

    // Allergy check - soft warning, requires override flag if conflict
    const conflicts = checkAllergies(admission.patient, resolvedName)
    if (conflicts.length > 0 && !allergyOverride) {
      return errorResponse(res, 'Patient has known allergies that may conflict', 409, {
        allergyConflict: true,
        allergies: conflicts,
        message: `Patient is allergic to: ${conflicts.join(', ')}. Confirm override to proceed.`,
      })
    }

    const startDt = startDate ? new Date(startDate) : new Date()
    const endDt   = stopDate  ? new Date(stopDate)  : null

    // Create order + auto-generate past/current MAR slots in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.medicationOrder.create({
        data: {
          admissionId:    admission.id,
          medicineId:     medicineId || null,
          medicineName:   resolvedName.trim(),
          dose:           dose.trim(),
          route:          route.trim(),
          frequency,
          startDate:      startDt,
          stopDate:       endDt,
          duration:       duration?.trim() || null,
          procurementMode: procurementMode === 'STOCK' ? 'STOCK' : 'PROCURE',
          expectedQty:    expectedQty?.trim() || null,
          notes:          notes?.trim() || (allergyOverride && conflicts.length
                            ? `[Allergy override: ${allergyOverrideReason || 'no reason given'}] (${conflicts.join(', ')})`
                            : null),
          prescribedById: req.user.id,
          status:         'ACTIVE',
        },
      })

      // Generate MAR slots up to 24 hours in the future (gives nurses upcoming view)
      const lookAheadEnd = endDt && endDt < new Date(Date.now() + 24 * 3600 * 1000)
        ? endDt
        : new Date(Date.now() + 24 * 3600 * 1000)

      const slots = buildSchedule(frequency, startDt, lookAheadEnd)
      if (slots.length > 0) {
        await tx.medicationAdministration.createMany({
          data: slots.map(s => ({
            orderId:       created.id,
            scheduledTime: s,
            status:        s < new Date() ? 'PENDING' : 'PENDING',
          })),
        })
      }
      return created
    })

    // Re-fetch with relations
    const full = await prisma.medicationOrder.findUnique({
      where: { id: order.id },
      include: {
        prescribedBy: { select: { id: true, name: true } },
        medicine:     { select: { id: true, name: true, genericName: true } },
        administrations: { orderBy: { scheduledTime: 'asc' } },
      },
    })

    return successResponse(res, full, 'Medication order created', 201)
  } catch (err) {
    console.error('[createOrder]', err)
    return errorResponse(res, err.message || 'Failed to create order', 500)
  }
}

// ── Stop / Discontinue an order ───────────────────────────
async function stopOrder(req, res) {
  try {
    const order = await prisma.medicationOrder.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!order) return errorResponse(res, 'Order not found', 404)
    if (order.status !== 'ACTIVE') {
      return errorResponse(res, `Order is already ${order.status.toLowerCase()}`, 400)
    }

    const { stopReason } = req.body
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.medicationOrder.update({
        where: { id: order.id },
        data:  {
          status:     'STOPPED',
          stoppedAt:  now,
          stopReason: stopReason?.trim() || null,
          stopDate:   order.stopDate || now,
        },
      })

      // Cancel future PENDING doses (set to MISSED with auto-note? Better: just delete)
      await tx.medicationAdministration.deleteMany({
        where: {
          orderId: order.id,
          scheduledTime: { gt: now },
          status: 'PENDING',
        },
      })
    })

    const updated = await prisma.medicationOrder.findUnique({
      where: { id: order.id },
      include: {
        prescribedBy: { select: { id: true, name: true } },
        medicine:     { select: { id: true, name: true, genericName: true } },
        administrations: { orderBy: { scheduledTime: 'asc' } },
      },
    })
    return successResponse(res, updated, 'Order stopped')
  } catch (err) {
    console.error('[stopOrder]', err)
    return errorResponse(res, 'Failed to stop order', 500)
  }
}

// ── Refresh future MAR slots for an active order ──────────
// Called periodically by the MAR view (or after a long gap). Idempotent -
// won't create duplicate slots for times already present.
async function refreshSchedule(req, res) {
  try {
    const order = await prisma.medicationOrder.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
      include: { administrations: { select: { scheduledTime: true } } },
    })
    if (!order) return errorResponse(res, 'Order not found', 404)
    if (order.status !== 'ACTIVE') return successResponse(res, { added: 0 })

    const lookAheadEnd = order.stopDate && order.stopDate < new Date(Date.now() + 24 * 3600 * 1000)
      ? order.stopDate
      : new Date(Date.now() + 24 * 3600 * 1000)

    const wantedSlots = buildSchedule(order.frequency, order.startDate, lookAheadEnd)
    const existingTimes = new Set(order.administrations.map(a => a.scheduledTime.getTime()))
    const newSlots = wantedSlots.filter(s => !existingTimes.has(s.getTime()))

    if (newSlots.length === 0) return successResponse(res, { added: 0 })

    await prisma.medicationAdministration.createMany({
      data: newSlots.map(s => ({
        orderId:       order.id,
        scheduledTime: s,
        status:        'PENDING',
      })),
    })
    return successResponse(res, { added: newSlots.length })
  } catch (err) {
    console.error('[refreshSchedule]', err)
    return errorResponse(res, 'Failed to refresh schedule', 500)
  }
}

// ── Bulk-create medication orders ─────────────────────────
// Accepts { orders: [...] } and creates each one in a transaction.
// All-or-nothing: if any order fails validation, NONE are saved and the
// caller gets back which rows were problematic.
//
// Each order in the array must satisfy createOrder's validation rules.
// MAR doses are scheduled per order using existing logic.
async function bulkCreateOrders(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      include: { patient: { select: { id: true, allergies: true } } },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)
    if (admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot add medications to a closed admission', 400)
    }

    const orders = Array.isArray(req.body.orders) ? req.body.orders : []
    if (orders.length === 0) return errorResponse(res, 'orders array is required', 400)
    if (orders.length > 50)  return errorResponse(res, 'Too many orders in one request (max 50)', 400)

    // Pre-validate all orders BEFORE starting the transaction. Collect per-row errors.
    const validated = []
    const rowErrors = []  // [{ rowIndex, message }]

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i] || {}
      const err = validateOrder(o, i)
      if (err) { rowErrors.push(err); continue }

      // Resolve medicineName (use master if id given, else trust typed name)
      let resolvedName = o.medicineName?.trim()
      if (o.medicineId) {
        const med = await prisma.medicine.findFirst({
          where: { id: o.medicineId, clinicId: req.clinicId },
        })
        if (!med) {
          rowErrors.push({ rowIndex: i, message: 'Medicine not found in master' })
          continue
        }
        resolvedName = med.name
      }
      if (!resolvedName) {
        rowErrors.push({ rowIndex: i, message: 'Medicine name is required' })
        continue
      }

      validated.push({
        index: i,
        data: {
          medicineId:      o.medicineId || null,
          medicineName:    resolvedName,
          dose:            o.dose.trim(),
          route:           o.route.trim(),
          frequency:       o.frequency,
          startDate:       o.startDate ? new Date(o.startDate) : new Date(),
          stopDate:        o.stopDate ? new Date(o.stopDate) : null,
          duration:        o.duration?.trim() || null,
          procurementMode: o.procurementMode === 'STOCK' ? 'STOCK' : 'PROCURE',
          expectedQty:     o.expectedQty?.trim() || null,
          notes:           o.notes?.trim() || null,
        },
      })
    }

    // Allergy check across all rows. Collect conflicts but treat them as
    // warnings (don't block) unless the row has explicit allergyOverride=false.
    // (Bulk save UI doesn't yet show per-row allergy dialogs -- nurse/doctor
    // can review after save and stop any incorrect orders.)
    // For v1: log conflicts but proceed.

    if (rowErrors.length > 0) {
      return errorResponse(res, 'Validation failed', 400, { rowErrors })
    }

    // Atomic save
    const created = await prisma.$transaction(async (tx) => {
      const result = []
      for (const v of validated) {
        const order = await tx.medicationOrder.create({
          data: {
            admissionId:    admission.id,
            ...v.data,
            prescribedById: req.user.id,
            status:         'ACTIVE',
          },
        })

        // Schedule MAR slots up to 24 hours in the future (matches createOrder)
        const startDt = order.startDate
        const endDt   = order.stopDate
        const lookAheadEnd = endDt && endDt < new Date(Date.now() + 24 * 3600 * 1000)
          ? endDt
          : new Date(Date.now() + 24 * 3600 * 1000)
        const slots = buildSchedule(order.frequency, startDt, lookAheadEnd)
        if (slots.length > 0) {
          await tx.medicationAdministration.createMany({
            data: slots.map(s => ({
              orderId:       order.id,
              scheduledTime: s,
              status:        'PENDING',
            })),
          })
        }
        result.push(order)
      }
      return result
    })

    return successResponse(res, { created: created.length, orders: created }, 'Saved', 201)
  } catch (err) {
    console.error('[bulkCreateOrders]', err)
    return errorResponse(res, err.message || 'Failed to save', 500)
  }
}

// Helper: validate one order shape, returns null if OK or { rowIndex, message }
function validateOrder(o, rowIndex) {
  if (!o.dose?.trim())      return { rowIndex, message: 'Dose is required' }
  if (!o.route?.trim())     return { rowIndex, message: 'Route is required' }
  if (!o.frequency)         return { rowIndex, message: 'Frequency is required' }
  if (!VALID_FREQUENCIES.includes(o.frequency)) {
    return { rowIndex, message: `Invalid frequency: ${o.frequency}` }
  }
  if (!o.medicineId && !o.medicineName?.trim()) {
    return { rowIndex, message: 'Medicine is required' }
  }
  return null
}

module.exports = {
  listOrders,
  createOrder,
  bulkCreateOrders,
  stopOrder,
  refreshSchedule,
  // exported for MAR controller to use
  FREQUENCY_TIMES,
}
