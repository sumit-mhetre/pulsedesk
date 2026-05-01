// IPD Orders controller — lab tests, imaging, diet, physiotherapy, and
// special instructions ordered during an inpatient admission.
//
// Distinct from medication orders (which have their own controller + MAR).
//
// Lifecycle:
//   ORDERED → ACKNOWLEDGED → IN_PROGRESS → COMPLETED
//                                         → CANCELLED (anytime)
//                                         → HELD (paused, can resume)
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → manageIPDOrders (Admin, Doctor)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

const VALID_TYPES = [
  'LAB_TEST', 'IMAGING', 'DIET', 'NURSING_INSTRUCTION',
  'PHYSIOTHERAPY', 'CONSULTATION_REFERRAL', 'OTHER',
]
const VALID_STATUSES = [
  'ORDERED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'HELD',
]

// Structured diet options. Frontend shows these as a dropdown for orderType=DIET,
// but we store them in `details` JSON so other types can have their own structure.
const DIET_TYPES = [
  'NORMAL', 'DIABETIC', 'RENAL', 'CARDIAC', 'SOFT', 'NPO', 'LIQUID',
  'HIGH_PROTEIN', 'LOW_SALT', 'CUSTOM',
]

async function loadAdmission(req, res, allowClosed = false) {
  const admission = await prisma.admission.findFirst({
    where: { id: req.params.admissionId, clinicId: req.clinicId },
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

// ── List orders for an admission ──────────────────────────
async function listOrders(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const { type, status } = req.query
    const where = { admissionId: admission.id }
    if (type)   where.orderType = type
    if (status) where.status    = status

    const orders = await prisma.iPDOrder.findMany({
      where,
      orderBy: [{ status: 'asc' }, { orderedAt: 'desc' }],
      include: {
        orderedBy: { select: { id: true, name: true, qualification: true } },
      },
    })
    return successResponse(res, orders)
  } catch (err) {
    console.error('[listOrders]', err)
    return errorResponse(res, 'Failed to fetch orders', 500)
  }
}

// ── Create an order ───────────────────────────────────────
// Body: { orderType, description, details?, notes? }
// For DIET, details = { dietType, customNotes? }
// For LAB_TEST, details = { tests: ['CBC', 'LFT', ...] }
// For IMAGING, details = { modality, region }
// For PHYSIOTHERAPY, details = { sessions, focus }
// Other types: details is freeform JSON
async function createOrder(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const { orderType, description, details, notes } = req.body

    if (!orderType || !VALID_TYPES.includes(orderType)) {
      return errorResponse(res, `orderType must be one of: ${VALID_TYPES.join(', ')}`, 400)
    }
    if (!description?.trim()) {
      return errorResponse(res, 'description is required', 400)
    }

    // For DIET, validate dietType in details
    if (orderType === 'DIET' && details?.dietType && !DIET_TYPES.includes(details.dietType)) {
      return errorResponse(res, `Invalid diet type. Use one of: ${DIET_TYPES.join(', ')}`, 400)
    }

    const order = await prisma.iPDOrder.create({
      data: {
        admissionId:  admission.id,
        orderType,
        description:  description.trim(),
        details:      details || null,
        notes:        notes?.trim() || null,
        orderedAt:    new Date(),
        orderedById:  req.user.id,
        status:       'ORDERED',
      },
      include: {
        orderedBy: { select: { id: true, name: true, qualification: true } },
      },
    })

    return successResponse(res, order, 'Order created', 201)
  } catch (err) {
    console.error('[createOrder]', err)
    return errorResponse(res, 'Failed to create order', 500)
  }
}

// ── Update order status ───────────────────────────────────
// Body: { status, notes? }
// Status transitions are loosely enforced — caller specifies, we record.
async function updateStatus(req, res) {
  try {
    const order = await prisma.iPDOrder.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!order) return errorResponse(res, 'Order not found', 404)

    const { status, notes } = req.body
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(res, `Invalid status`, 400)
    }
    if (order.status === 'COMPLETED' && status !== 'COMPLETED') {
      return errorResponse(res, 'Cannot reopen a completed order', 400)
    }

    const data = { status }
    const now = new Date()
    if (status === 'ACKNOWLEDGED' && !order.acknowledgedAt) {
      data.acknowledgedAt = now
      data.acknowledgedById = req.user.id
    }
    if (status === 'COMPLETED') {
      data.completedAt = now
      data.completedById = req.user.id
    }
    if (status === 'CANCELLED') {
      data.cancelledAt = now
      if (notes?.trim()) data.cancelledReason = notes.trim()
    }
    if (notes !== undefined) data.notes = notes?.trim() || null

    const updated = await prisma.iPDOrder.update({
      where: { id: order.id },
      data,
      include: {
        orderedBy: { select: { id: true, name: true, qualification: true } },
      },
    })
    return successResponse(res, updated, 'Order updated')
  } catch (err) {
    console.error('[updateStatus]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

// ── Update order details (description, notes) ────────────
async function updateOrder(req, res) {
  try {
    const order = await prisma.iPDOrder.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!order) return errorResponse(res, 'Order not found', 404)
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return errorResponse(res, `Cannot edit a ${order.status.toLowerCase()} order`, 400)
    }

    const { description, details, notes } = req.body
    const data = {}
    if (description !== undefined) data.description = description?.trim()
    if (details     !== undefined) data.details     = details
    if (notes       !== undefined) data.notes       = notes?.trim() || null

    const updated = await prisma.iPDOrder.update({
      where: { id: order.id },
      data,
      include: { orderedBy: { select: { id: true, name: true, qualification: true } } },
    })
    return successResponse(res, updated, 'Order updated')
  } catch (err) {
    console.error('[updateOrder]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

module.exports = {
  listOrders,
  createOrder,
  updateStatus,
  updateOrder,
  DIET_TYPES,
}
