// Nursing Note controller - nurse's per-shift observations + care actions.
//
// Each entry attributed to one shift (MORNING / AFTERNOON / NIGHT) and one
// nurse (req.user). Includes optional handover notes for next shift.
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → recordNursingNotes (Admin, Nurse - not Doctor by default)

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

// ── List nursing notes ────────────────────────────────────
async function listNursingNotes(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const notes = await prisma.nursingNote.findMany({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'desc' },
      include: {
        nurse: { select: { id: true, name: true } },
      },
    })
    return successResponse(res, notes)
  } catch (err) {
    console.error('[listNursingNotes]', err)
    return errorResponse(res, 'Failed to fetch nursing notes', 500)
  }
}

// ── Create a nursing note ─────────────────────────────────
async function createNursingNote(req, res) {
  try {
    const admission = await loadAdmission(req, res)
    if (!admission) return

    const { recordedAt, shift, observations, careActions, handoverNotes } = req.body

    if (!shift || !VALID_SHIFTS.includes(shift)) {
      return errorResponse(res, `shift is required (${VALID_SHIFTS.join(' / ')})`, 400)
    }

    const hasContent = (observations || careActions || handoverNotes || '').toString().trim()
    if (!hasContent) {
      return errorResponse(res, 'Note content is required', 400)
    }

    const note = await prisma.nursingNote.create({
      data: {
        admissionId:   admission.id,
        recordedAt:    recordedAt ? new Date(recordedAt) : new Date(),
        shift,
        nurseId:       req.user.id,
        observations:  observations?.trim() || null,
        careActions:   careActions?.trim() || null,
        handoverNotes: handoverNotes?.trim() || null,
      },
      include: {
        nurse: { select: { id: true, name: true } },
      },
    })

    return successResponse(res, note, 'Nursing note recorded', 201)
  } catch (err) {
    console.error('[createNursingNote]', err)
    return errorResponse(res, 'Failed to record nursing note', 500)
  }
}

// ── Update a nursing note (author-only within 24 hours) ───
async function updateNursingNote(req, res) {
  try {
    const note = await prisma.nursingNote.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
      include: { admission: { select: { status: true } } },
    })
    if (!note) return errorResponse(res, 'Nursing note not found', 404)

    if (note.nurseId !== req.user.id) {
      return errorResponse(res, 'Only the author can edit this note', 403)
    }
    const ageMs = Date.now() - new Date(note.createdAt).getTime()
    if (ageMs > 24 * 60 * 60 * 1000) {
      return errorResponse(res, 'Notes can only be edited within 24 hours', 400)
    }
    if (note.admission.status !== 'ADMITTED') {
      return errorResponse(res, 'Cannot edit notes on a closed admission', 400)
    }

    const { observations, careActions, handoverNotes, shift } = req.body
    const data = {}
    if (shift         !== undefined) {
      if (!VALID_SHIFTS.includes(shift)) {
        return errorResponse(res, 'Invalid shift', 400)
      }
      data.shift = shift
    }
    if (observations  !== undefined) data.observations  = observations?.trim() || null
    if (careActions   !== undefined) data.careActions   = careActions?.trim() || null
    if (handoverNotes !== undefined) data.handoverNotes = handoverNotes?.trim() || null

    const updated = await prisma.nursingNote.update({
      where: { id: req.params.id },
      data,
      include: { nurse: { select: { id: true, name: true } } },
    })
    return successResponse(res, updated, 'Nursing note updated')
  } catch (err) {
    console.error('[updateNursingNote]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

module.exports = {
  listNursingNotes,
  createNursingNote,
  updateNursingNote,
}
