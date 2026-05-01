// Bed Transfer controller -- move an admission from one bed to another mid-stay.
//
// What it does (atomic transaction):
//   1. Validate: admission is ADMITTED, target bed is VACANT/RESERVED, not the same bed
//   2. Insert BedTransfer history row (fromBedId, toBedId, transferredAt, reason)
//   3. Update old bed: status = CLEANING, currentAdmissionId = null
//   4. Update new bed: status = OCCUPIED, currentAdmissionId = admission.id
//   5. Update admission.bedId = new bed
//
// Bed-rent calculation note: bed rent is computed live at billing time from
// admittedAt -> dischargedAt using the CURRENT bed's rate. This is a known
// simplification (your "Option C" decision in Step 3). For pro-rata across
// multiple beds, the ipdBill controller would walk BedTransfer history and
// charge each bed's days separately. Not done in v1.
//
// Permission: requireIPD('manageAdmissions') -- same as admit/discharge.

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// ── List transfer history for an admission ────────────────
async function listTransfers(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const transfers = await prisma.bedTransfer.findMany({
      where: { admissionId: admission.id },
      orderBy: { transferredAt: 'asc' },
      include: {
        fromBed:        { select: { id: true, bedNumber: true, ward: true, bedType: true } },
        toBed:          { select: { id: true, bedNumber: true, ward: true, bedType: true } },
        transferredBy:  { select: { id: true, name: true } },
      },
    })
    return successResponse(res, transfers)
  } catch (err) {
    console.error('[listTransfers]', err)
    return errorResponse(res, 'Failed to fetch transfers', 500)
  }
}

// ── Transfer admission to a new bed ───────────────────────
// Body: { toBedId, transferredAt?, reason? }
async function transferBed(req, res) {
  try {
    const { toBedId, transferredAt, reason, nurseHandoverNote } = req.body
    if (!toBedId) return errorResponse(res, 'toBedId is required', 400)

    // Load admission + current bed
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      include: { bed: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)
    if (admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot transfer a closed admission', 400)
    }
    if (admission.bedId === toBedId) {
      return errorResponse(res, 'Patient is already in this bed', 400)
    }

    // Load target bed
    const toBed = await prisma.bed.findFirst({
      where: { id: toBedId, clinicId: req.clinicId, isActive: true },
    })
    if (!toBed) return errorResponse(res, 'Target bed not found', 404)
    if (!['VACANT', 'RESERVED'].includes(toBed.status)) {
      return errorResponse(res, `Target bed is ${toBed.status} -- cannot transfer to it`, 400)
    }

    const fromBedId = admission.bedId
    const transferTime = transferredAt ? new Date(transferredAt) : new Date()

    // Atomic update across multiple tables
    await prisma.$transaction(async (tx) => {
      // 1. Insert transfer history
      await tx.bedTransfer.create({
        data: {
          admissionId:        admission.id,
          fromBedId:          fromBedId || null,
          toBedId,
          transferredAt:      transferTime,
          reason:             reason?.trim() || null,
          nurseHandoverNote:  nurseHandoverNote?.trim() || null,
          transferredById:    req.user.id,
        },
      })

      // 2. Free old bed -> CLEANING
      if (fromBedId) {
        await tx.bed.update({
          where: { id: fromBedId },
          data:  { status: 'CLEANING', currentAdmissionId: null },
        })
      }

      // 3. Occupy new bed
      await tx.bed.update({
        where: { id: toBedId },
        data:  { status: 'OCCUPIED', currentAdmissionId: admission.id },
      })

      // 4. Update admission.bedId
      await tx.admission.update({
        where: { id: admission.id },
        data:  { bedId: toBedId },
      })
    })

    return successResponse(res, { success: true }, 'Patient transferred')
  } catch (err) {
    console.error('[transferBed]', err)
    return errorResponse(res, err.message || 'Failed to transfer', 500)
  }
}

// ── List vacant beds (for transfer destination picker) ────
// Excludes the admission's current bed.
async function listAvailableBeds(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true, bedId: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const beds = await prisma.bed.findMany({
      where: {
        clinicId: req.clinicId,
        isActive: true,
        status:   { in: ['VACANT', 'RESERVED'] },
        id:       { not: admission.bedId || undefined },
      },
      orderBy: [{ ward: 'asc' }, { bedNumber: 'asc' }],
      select: {
        id: true, bedNumber: true, bedType: true, ward: true,
        floor: true, dailyRate: true, status: true,
      },
    })
    return successResponse(res, beds)
  } catch (err) {
    console.error('[listAvailableBeds]', err)
    return errorResponse(res, 'Failed to fetch available beds', 500)
  }
}

module.exports = {
  listTransfers,
  transferBed,
  listAvailableBeds,
}
