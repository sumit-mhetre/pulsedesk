// Round Note controller - doctor's daily clinical notes on an admission.
//
// Supports two modes per entry:
//   - SOAP (subjective / objective / assessment / plan) - structured
//   - Free-form (freeText) - single block of text
//
// Both can coexist; the form picks one. Storage is permissive - null fields
// are fine.
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → recordRoundNotes (Admin, Doctor by default)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// Verify admission exists, belongs to the clinic, and is open enough to edit.
// Returns admission row on success, null on failure (caller handles errResponse).
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

// ── List round notes for an admission ─────────────────────
async function listRoundNotes(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const notes = await prisma.roundNote.findMany({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'desc' },
      include: {
        doctor: { select: { id: true, name: true, qualification: true, specialization: true } },
      },
    })
    return successResponse(res, notes)
  } catch (err) {
    console.error('[listRoundNotes]', err)
    return errorResponse(res, 'Failed to fetch round notes', 500)
  }
}

// ── Create a round note ───────────────────────────────────
// Body: { recordedAt, subjective, objective, assessment, plan, freeText, isCritical, needsFollowUp }
// recordedAt defaults to now.
// Auto-attributes to req.user as the doctor.
async function createRoundNote(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const {
      recordedAt,
      subjective, objective, assessment, plan,
      freeText,
      isCritical, needsFollowUp,
    } = req.body

    // At least one of the content fields must be filled
    const hasContent = (subjective || objective || assessment || plan || freeText || '').toString().trim()
    if (!hasContent) {
      return errorResponse(res, 'Note content is required (SOAP or free text)', 400)
    }

    const note = await prisma.roundNote.create({
      data: {
        admissionId: admission.id,
        recordedAt:  recordedAt ? new Date(recordedAt) : new Date(),
        doctorId:    req.user.id,
        subjective:  subjective?.trim() || null,
        objective:   objective?.trim() || null,
        assessment:  assessment?.trim() || null,
        plan:        plan?.trim() || null,
        freeText:    freeText?.trim() || null,
        isCritical:  !!isCritical,
        needsFollowUp: !!needsFollowUp,
      },
      include: {
        doctor: { select: { id: true, name: true, qualification: true, specialization: true } },
      },
    })

    return successResponse(res, note, 'Round note recorded', 201)
  } catch (err) {
    console.error('[createRoundNote]', err)
    return errorResponse(res, 'Failed to record round note', 500)
  }
}

// ── Update a round note (only the author within 24 hours) ─
// Notes are clinical records - generally append-only. We allow edits within
// 24 hours of creation, only by the original author. After that, edits are
// frozen for audit reasons.
async function updateRoundNote(req, res) {
  try {
    const note = await prisma.roundNote.findFirst({
      where: {
        id: req.params.id,
        admission: { clinicId: req.clinicId },
      },
      include: { admission: { select: { status: true } } },
    })
    if (!note) return errorResponse(res, 'Round note not found', 404)

    if (note.doctorId !== req.user.id) {
      return errorResponse(res, 'Only the author can edit this note', 403)
    }

    const ageMs = Date.now() - new Date(note.createdAt).getTime()
    if (ageMs > 24 * 60 * 60 * 1000) {
      return errorResponse(res, 'Notes can only be edited within 24 hours of creation', 400)
    }

    if (note.admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot edit notes on a closed admission', 400)
    }

    const {
      subjective, objective, assessment, plan,
      freeText, isCritical, needsFollowUp,
    } = req.body

    const data = {}
    if (subjective    !== undefined) data.subjective    = subjective?.trim() || null
    if (objective     !== undefined) data.objective     = objective?.trim() || null
    if (assessment    !== undefined) data.assessment    = assessment?.trim() || null
    if (plan          !== undefined) data.plan          = plan?.trim() || null
    if (freeText      !== undefined) data.freeText      = freeText?.trim() || null
    if (isCritical    !== undefined) data.isCritical    = !!isCritical
    if (needsFollowUp !== undefined) data.needsFollowUp = !!needsFollowUp

    const updated = await prisma.roundNote.update({
      where: { id: req.params.id },
      data,
      include: { doctor: { select: { id: true, name: true, qualification: true, specialization: true } } },
    })
    return successResponse(res, updated, 'Round note updated')
  } catch (err) {
    console.error('[updateRoundNote]', err)
    return errorResponse(res, 'Failed to update round note', 500)
  }
}

module.exports = {
  listRoundNotes,
  createRoundNote,
  updateRoundNote,
}
