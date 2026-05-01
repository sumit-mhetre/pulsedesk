// Consultations controller — cross-specialty referrals during admission.
//
// Two modes (per Q1=c, both supported):
//   - Internal: pick a doctor in this clinic (consultantDoctorId set)
//   - External: just enter consultant name + specialty (no link)
//
// No notification system in v1 — internal consultants see their requests
// when they log in (could add a notification bell in a later step).
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → manageConsultations (Admin, Doctor)

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
    errorResponse(res, 'Cannot modify a closed admission', 400)
    return null
  }
  return admission
}

// ── List consultations for an admission ───────────────────
async function listConsultations(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const consultations = await prisma.consultation.findMany({
      where: { admissionId: admission.id },
      orderBy: { requestedAt: 'desc' },
      include: {
        consultantDoctor: { select: { id: true, name: true, qualification: true, specialization: true } },
      },
    })
    return successResponse(res, consultations)
  } catch (err) {
    console.error('[listConsultations]', err)
    return errorResponse(res, 'Failed to fetch consultations', 500)
  }
}

// ── Request a consultation ────────────────────────────────
// Body: { consultantDoctorId?, consultantName, consultantSpecialty?, reason }
// If consultantDoctorId provided → internal. Else → external (consultantName required).
async function createConsultation(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const {
      consultantDoctorId, consultantName, consultantSpecialty, reason,
    } = req.body

    if (!reason?.trim()) {
      return errorResponse(res, 'reason is required', 400)
    }

    let resolvedName = consultantName
    let resolvedSpec = consultantSpecialty

    if (consultantDoctorId) {
      // Internal — fetch from clinic users
      const doctor = await prisma.user.findFirst({
        where: {
          id: consultantDoctorId,
          clinicId: req.clinicId,
          role: { in: ['DOCTOR', 'ADMIN'] },
          isActive: true,
        },
      })
      if (!doctor) return errorResponse(res, 'Consultant doctor not found', 404)
      resolvedName = doctor.name
      resolvedSpec = resolvedSpec || doctor.specialization || null
    } else if (!resolvedName?.trim()) {
      return errorResponse(res, 'Either consultantDoctorId or consultantName is required', 400)
    }

    const consultation = await prisma.consultation.create({
      data: {
        admissionId:         admission.id,
        consultantDoctorId:  consultantDoctorId || null,
        consultantName:      resolvedName.trim(),
        consultantSpecialty: resolvedSpec?.trim() || null,
        requestedAt:         new Date(),
        reason:              reason.trim(),
      },
      include: {
        consultantDoctor: { select: { id: true, name: true, qualification: true, specialization: true } },
      },
    })

    return successResponse(res, consultation, 'Consultation requested', 201)
  } catch (err) {
    console.error('[createConsultation]', err)
    return errorResponse(res, 'Failed to request consultation', 500)
  }
}

// ── Record consultation response (notes + recommendations) ──
// Used when consultant completes the consult.
async function recordResponse(req, res) {
  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!consultation) return errorResponse(res, 'Consultation not found', 404)

    const { notes, recommendations, consultedAt } = req.body

    const data = {
      consultedAt: consultedAt ? new Date(consultedAt) : (consultation.consultedAt || new Date()),
    }
    if (notes           !== undefined) data.notes           = notes?.trim() || null
    if (recommendations !== undefined) data.recommendations = recommendations?.trim() || null

    const updated = await prisma.consultation.update({
      where: { id: consultation.id },
      data,
      include: {
        consultantDoctor: { select: { id: true, name: true, qualification: true, specialization: true } },
      },
    })
    return successResponse(res, updated, 'Response recorded')
  } catch (err) {
    console.error('[recordResponse]', err)
    return errorResponse(res, 'Failed to record', 500)
  }
}

// ── Delete consultation (only if no response recorded yet) ─
async function deleteConsultation(req, res) {
  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!consultation) return errorResponse(res, 'Consultation not found', 404)
    if (consultation.consultedAt) {
      return errorResponse(res, 'Cannot delete a completed consultation', 400)
    }
    await prisma.consultation.delete({ where: { id: consultation.id } })
    return successResponse(res, null, 'Consultation deleted')
  } catch (err) {
    console.error('[deleteConsultation]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

module.exports = {
  listConsultations,
  createConsultation,
  recordResponse,
  deleteConsultation,
}
