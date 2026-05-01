// IPD Bill controller -- generates interim and final bills for an admission.
//
// Bill items are built from:
//   1. Bed rent: ONE LINE PER STAY SEGMENT. If the patient was transferred
//      between beds during the stay, each segment shows separately with its
//      own bed number, days, rate, and amount. Transfer date counts as the
//      first day on the new bed (segments split at the calendar day before
//      the transfer).
//   2. All non-voided IPDCharge rows
//   3. Less initial deposit (final bill only)
//   4. Less interim payments (final bill only -- model A1 consolidation)
//
// Bills use the same Bill+BillItem tables as OPD, with billType set to
// "IPD_INTERIM" or "IPD_FINAL" and admissionId pointing to the admission.

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')
const { computeDaysAdmitted } = require('./admission.controller')

// ── Helpers ───────────────────────────────────────────────

// Returns midnight of the calendar day BEFORE the given date.
// Used to split bed-rent segments: the day a transfer happens belongs to
// the NEW bed, so the OLD bed's segment ends "the day before".
function dayBefore(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d
}

// Build per-bed stay segments from an admission's transfer history.
//
// transfers: array of BedTransfer rows ordered by transferredAt asc, each
//            with `fromBed` and `toBed` relations included.
// currentBed: admission.bed (always the most recent bed; equals last
//             transfer.toBed when transfers exist).
//
// Returns: array of { bed, startAt, endAt, days, rate, amount }, with
// 0-day segments filtered out (e.g., same-day transfers).
function buildBedRentSegments({ admittedAt, dischargedAt, transfers, currentBed }) {
  const endOfStay = dischargedAt || new Date()
  const segments = []

  if (!Array.isArray(transfers) || transfers.length === 0) {
    // Single segment: entire stay on the current bed
    segments.push({ bed: currentBed, startAt: admittedAt, endAt: endOfStay })
  } else {
    // First segment: admission -> day before first transfer, on first transfer's fromBed
    segments.push({
      bed:     transfers[0].fromBed,
      startAt: admittedAt,
      endAt:   dayBefore(transfers[0].transferredAt),
    })

    // Middle segments: each transfer to (day before next transfer), on the toBed of that transfer
    for (let i = 0; i < transfers.length - 1; i++) {
      segments.push({
        bed:     transfers[i].toBed,
        startAt: transfers[i].transferredAt,
        endAt:   dayBefore(transfers[i + 1].transferredAt),
      })
    }

    // Last segment: last transfer -> discharge/now, on last transfer's toBed
    segments.push({
      bed:     transfers[transfers.length - 1].toBed,
      startAt: transfers[transfers.length - 1].transferredAt,
      endAt:   endOfStay,
    })
  }

  // Compute days + amount per segment, drop 0-day ones.
  return segments
    .map(s => {
      const days = computeDaysAdmitted(s.startAt, s.endAt)
      const rate = s.bed?.dailyRate || 0
      return { ...s, days, rate, amount: days * rate }
    })
    .filter(s => s.days > 0)
}

// ── Generate IPD bill number ──────────────────────────────
async function generateBillNo(clinicId) {
  const count = await prisma.bill.count({ where: { clinicId } })
  const year  = new Date().getFullYear()
  return `BL/${year}/${String(count + 1).padStart(4, '0')}`
}

// ── Sum amountPaid across active interim bills for this admission ─────────
async function sumInterimPayments(admissionId) {
  const interims = await prisma.bill.findMany({
    where: {
      admissionId,
      billType: 'IPD_INTERIM',
      voidedAt: null,
    },
    select: { id: true, billNo: true, amountPaid: true },
  })
  const total = interims.reduce((s, b) => s + (b.amountPaid || 0), 0)
  return { interims, total }
}

// ── Preview the bill (NO save) ────────────────────────────
// Returns: { items, subtotal, depositApplied, interimPaid, suggestedTotal, ... }
// Used to populate the generate-bill modal.
async function previewBill(req, res) {
  try {
    const { type = 'IPD_FINAL' } = req.query
    if (!['IPD_INTERIM', 'IPD_FINAL'].includes(type)) {
      return errorResponse(res, 'type must be IPD_INTERIM or IPD_FINAL', 400)
    }

    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      include: {
        patient: true,
        bed: true,
        bedTransfers: {
          orderBy: { transferredAt: 'asc' },
          include: { fromBed: true, toBed: true },
        },
      },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    // Bed rent: split into segments per bed if there were transfers.
    // For interim bills, end of stay = now; for final = dischargedAt or now.
    const endAt = (type === 'IPD_FINAL' && admission.dischargedAt) ? admission.dischargedAt : new Date()
    const segments = buildBedRentSegments({
      admittedAt:   admission.admittedAt,
      dischargedAt: endAt,
      transfers:    admission.bedTransfers,
      currentBed:   admission.bed,
    })

    // Total days for backwards-compat in response (sum of segment days)
    const days = segments.reduce((s, seg) => s + seg.days, 0)

    const items = []

    // 1. One bill line per bed-rent segment. Each segment shows the bed,
    //    days on that bed, daily rate, and computed amount. Skipped here
    //    if no segments (e.g., 0-rate bed and no transfers).
    for (const seg of segments) {
      if (!seg.bed || seg.rate <= 0) continue
      items.push({
        name:   `Bed Charges -- ${seg.bed.bedNumber || 'Bed'} (${seg.days} day${seg.days === 1 ? '' : 's'} @ Rs.${seg.rate}/day)`,
        qty:    seg.days,
        rate:   seg.rate,
        amount: seg.amount,
        category: 'BED_RENT',
      })
    }

    // 2. All non-voided charges, one row per charge for clear audit trail.
    const charges = await prisma.iPDCharge.findMany({
      where: { admissionId: admission.id, voidedAt: null },
      orderBy: { chargedAt: 'asc' },
    })
    for (const c of charges) {
      items.push({
        name:   c.description,
        qty:    c.quantity,
        rate:   c.unitPrice,
        amount: c.amount,
        category: c.chargeType,
        chargeId: c.id,
      })
    }

    const subtotal = items.reduce((s, i) => s + i.amount, 0)

    // Deposit only adjusted on final bill
    const depositApplied = type === 'IPD_FINAL' ? (admission.initialDeposit || 0) : 0

    // Interim payments only roll into final bills (A1 model)
    let interimPaid = 0
    let interimBillNos = []
    if (type === 'IPD_FINAL') {
      const sum = await sumInterimPayments(admission.id)
      interimPaid = sum.total
      interimBillNos = sum.interims.map(b => b.billNo)
    }

    const suggestedTotal = Math.max(0, subtotal - depositApplied)

    return successResponse(res, {
      type,
      admission: {
        id: admission.id,
        admissionNumber: admission.admissionNumber,
        patient: admission.patient,
        admittedAt: admission.admittedAt,
        dischargedAt: admission.dischargedAt,
        status: admission.status,
        initialDeposit: admission.initialDeposit || 0,
      },
      days,
      // Bed-rent breakdown for UI display. Each segment shows bedNumber,
      // days on that bed, daily rate, and amount. Useful when patient was
      // transferred and you want to show "you stayed 2 days on B-006 then
      // 3 days on B-007" instead of one collapsed bed-rent line.
      bedRentSegments: segments.map(s => ({
        bedNumber: s.bed?.bedNumber || null,
        bedType:   s.bed?.bedType   || null,
        ward:      s.bed?.ward      || null,
        startAt:   s.startAt,
        endAt:     s.endAt,
        days:      s.days,
        rate:      s.rate,
        amount:    s.amount,
      })),
      items,
      subtotal,
      depositApplied,
      interimPaid,
      interimBillNos,
      suggestedTotal,
    })
  } catch (err) {
    console.error('[previewBill]', err)
    return errorResponse(res, 'Failed to preview bill', 500)
  }
}

// ── Generate the bill (saves to Bill + BillItem) ──────────
// Body: { type, items: [{ name, qty, rate, amount }], discount, paymentMode, amountPaid, notes }
async function generateBill(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const {
      type,             // IPD_INTERIM | IPD_FINAL
      items = [],
      discount = 0,
      discountType = 'flat',
      paymentMode = 'Cash',
      amountPaid = 0,
      notes,
    } = req.body

    if (!['IPD_INTERIM', 'IPD_FINAL'].includes(type)) {
      return errorResponse(res, 'type must be IPD_INTERIM or IPD_FINAL', 400)
    }
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'items is required', 400)
    }

    if (type === 'IPD_FINAL' && admission.status === 'ADMITTED') {
      return errorResponse(res, 'Cannot generate final bill while patient is still admitted', 400)
    }

    // Compute subtotal
    const subtotal = items.reduce((s, i) => {
      const qty  = parseInt(i.qty, 10) || 1
      const rate = parseFloat(i.rate) || 0
      const amt  = (i.amount !== undefined ? parseFloat(i.amount) : qty * rate)
      return s + (Number.isNaN(amt) ? 0 : amt)
    }, 0)

    // Discount
    let discountAmount = parseFloat(discount) || 0
    if (discountType === 'percent') {
      discountAmount = subtotal * (discountAmount / 100)
    }
    if (discountAmount > subtotal) discountAmount = subtotal

    // For final bills: apply deposit AND consolidate interim payments
    const initialDeposit = admission.initialDeposit || 0
    const depositToApply = type === 'IPD_FINAL' ? initialDeposit : 0

    let interimPaid = 0
    let interimsToVoid = []
    if (type === 'IPD_FINAL') {
      const sum = await sumInterimPayments(admission.id)
      interimPaid = sum.total
      interimsToVoid = sum.interims
    }

    const total = Math.max(0, subtotal - discountAmount - depositToApply)

    // amountPaid passed in is the NEW amount being collected today.
    // For final bills, also fold in interim payments.
    const newPayment = parseFloat(amountPaid) || 0
    const totalPaid  = type === 'IPD_FINAL' ? (newPayment + interimPaid) : newPayment

    const balance = Math.max(0, total - totalPaid)

    const billNo = await generateBillNo(req.clinicId)

    const bill = await prisma.$transaction(async (tx) => {
      // 1. Create new bill
      const created = await tx.bill.create({
        data: {
          clinicId:      req.clinicId,
          billNo,
          patientId:     admission.patientId,
          subtotal,
          discount:      discountAmount,
          total,
          paymentMode,
          paymentStatus: totalPaid >= total ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending'),
          amountPaid:    totalPaid,
          balance,
          notes:         notes?.trim() || null,
          admissionId:   admission.id,
          billType:      type,
          items: {
            create: items.map(i => ({
              name:   i.name,
              qty:    parseInt(i.qty, 10) || 1,
              rate:   parseFloat(i.rate) || 0,
              amount: i.amount !== undefined ? parseFloat(i.amount) : (parseInt(i.qty, 10) || 1) * (parseFloat(i.rate) || 0),
            })),
          },
        },
        include: { items: true },
      })

      // 2. For FINAL bills: void all earlier interim bills so they don't
      //    appear as still-outstanding. Their amountPaid has been rolled
      //    into the final bill above; their charges have already been
      //    re-pulled from IPDCharge into the final bill's items.
      if (type === 'IPD_FINAL' && interimsToVoid.length > 0) {
        await tx.bill.updateMany({
          where: { id: { in: interimsToVoid.map(b => b.id) } },
          data: {
            voidedAt:   new Date(),
            voidReason: `Consolidated into ${billNo}`,
          },
        })
      }

      return created
    })

    return successResponse(res, {
      ...bill,
      depositApplied: depositToApply,
      interimPaid,
      interimsConsolidated: interimsToVoid.map(b => b.billNo),
    }, 'Bill generated', 201)
  } catch (err) {
    console.error('[generateBill]', err)
    return errorResponse(res, 'Failed to generate bill', 500)
  }
}

// ── List bills for an admission ───────────────────────────
// By default hides voided bills. Pass ?includeVoided=true to see all
// (e.g. for audit / "show what was consolidated" UI).
async function listAdmissionBills(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const includeVoided = String(req.query.includeVoided || '').toLowerCase() === 'true'
    const where = {
      admissionId: admission.id,
      ...(includeVoided ? {} : { voidedAt: null }),
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { items: true },
    })
    return successResponse(res, bills)
  } catch (err) {
    console.error('[listAdmissionBills]', err)
    return errorResponse(res, 'Failed to fetch bills', 500)
  }
}

module.exports = {
  previewBill,
  generateBill,
  listAdmissionBills,
}
