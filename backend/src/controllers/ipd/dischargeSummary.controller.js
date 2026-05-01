// Discharge Summary controller -- assembles + persists the data for a
// printable, NABH-aware structured discharge summary.
//
// Phase 1: 15-section format (chief complaints, history, past hx, exam,
// investigations, treatment summary, condition, advice, follow-up, etc.)
//
// Read endpoint returns:
//   - Patient demographics (incl. allergies)
//   - All structured discharge fields stored on Admission
//   - dischargeMedications (separate model -- meds at discharge, NOT during stay)
//   - In-stay medications (MedicationOrder) -- read-only, for "Treatment Given"
//     context and for "Copy active orders" button on the discharge form
//   - Investigations (IPDOrder LAB/IMAGING) + lab values (LabResult)
//   - Procedures (IPDCharge PROCEDURE/OT_CHARGE)
//   - Consultations
//   - Recent vitals (separate from snapshot vitals stored on Admission)
//
// Permission gates (set in routes):
//   read   -> manageIPD
//   write  -> dischargePatient

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// ── Get assembled discharge summary data for an admission ──────────────
async function getSummary(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      include: {
        patient: true,
        primaryDoctor: {
          select: {
            id: true, name: true, qualification: true, specialization: true,
            regNo: true, signature: true,
          },
        },
        bed: { select: { id: true, bedNumber: true, ward: true, bedType: true } },
        clinic: {
          select: {
            id: true, name: true, address: true, phone: true, email: true,
            tagline: true, logo: true,
          },
        },
        // Structured discharge medications (Phase 1)
        dischargeMedications: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            medicine: { select: { id: true, name: true, genericName: true } },
          },
        },
      },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    // Medications during stay (for "Treatment Given" context + copy button)
    const medicationsInStay = await prisma.medicationOrder.findMany({
      where: { admissionId: admission.id },
      orderBy: { startDate: 'asc' },
      include: {
        prescribedBy: { select: { id: true, name: true } },
        medicine:     { select: { id: true, name: true, genericName: true } },
      },
    })

    // Investigations -- lab + imaging orders, non-cancelled
    const investigations = await prisma.iPDOrder.findMany({
      where: {
        admissionId: admission.id,
        orderType: { in: ['LAB_TEST', 'IMAGING'] },
        status: { not: 'CANCELLED' },
      },
      orderBy: { orderedAt: 'asc' },
      include: { orderedBy: { select: { id: true, name: true } } },
    })

    // Lab results (with values) -- separate from raw IPDOrder list
    const labResults = await prisma.labResult.findMany({
      where: { admissionId: admission.id },
      orderBy: { resultDate: 'asc' },
      include: { labTest: { select: { id: true, name: true } } },
    })

    // Procedures (from IPDCharges with PROCEDURE/OT_CHARGE)
    const procedureCharges = await prisma.iPDCharge.findMany({
      where: {
        admissionId: admission.id,
        chargeType: { in: ['PROCEDURE', 'OT_CHARGE'] },
        voidedAt: null,
      },
      orderBy: { chargedAt: 'asc' },
      select: {
        id: true, chargedAt: true, description: true, notes: true, chargeType: true,
      },
    })

    // Consultations
    const consultations = await prisma.consultation.findMany({
      where: { admissionId: admission.id },
      orderBy: { requestedAt: 'asc' },
      include: {
        consultantDoctor: { select: { id: true, name: true, specialization: true } },
      },
    })

    // Recent vitals (last 5) -- still useful even with snapshot fields
    const recentVitals = await prisma.iPDVitalRecord.findMany({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'desc' },
      take: 5,
    })

    // First vital recorded -- used by frontend auto-fill to pre-populate
    // "Vitals at Admission" in the discharge summary form. Pulled separately
    // from recentVitals (which is reverse-chronological) so we don't have to
    // fetch all vitals just to get the first one.
    const firstVital = await prisma.iPDVitalRecord.findFirst({
      where: { admissionId: admission.id },
      orderBy: { recordedAt: 'asc' },
    })

    // Length of stay (calendar days, inclusive)
    const endAt = admission.dischargedAt || new Date()
    const startMs = new Date(admission.admittedAt).getTime()
    const endMs = new Date(endAt).getTime()
    const days = Math.max(1, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1)

    return successResponse(res, {
      admission,
      lengthOfStay:      days,
      medicationsInStay,
      investigations,
      labResults,
      procedures:        procedureCharges,
      consultations,
      recentVitals,
      firstVital,
    })
  } catch (err) {
    console.error('[getSummary]', err)
    return errorResponse(res, 'Failed to fetch discharge summary', 500)
  }
}

// ── Update structured discharge summary fields ────────────────────────
// Body accepts any subset of the 15-section fields. Only allowed on
// closed admissions (DISCHARGED / DAMA / DEATH); blocked while ADMITTED
// to avoid premature edits during active care.
async function updateSummary(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)
    if (admission.status === 'ADMITTED') {
      return errorResponse(res, 'Discharge the patient first before editing the summary', 400)
    }

    // Whitelist of fields we accept. Anything else in body is ignored.
    const ALLOWED = [
      // Existing legacy fields (kept for backward-compat)
      'finalDiagnosis', 'provisionalDiagnosis',
      'dischargeNotes', 'dischargeAdvice',

      // Structured (Phase 1)
      'chiefComplaints', 'historyOfIllness',
      'pastDM', 'pastHTN', 'pastTB', 'pastAsthma', 'pastIHD',
      'pastSurgical', 'pastOther',
      'admissionVitals', 'dischargeVitals',
      'generalExam',
      'systemicExamCVS', 'systemicExamRS', 'systemicExamCNS', 'systemicExamPA',
      'keyInvestigations', 'treatmentSummary',
      'conditionAtDischarge',
      'dietAdvice', 'activityAdvice',
      'followUpDate', 'followUpInstructions', 'warningSigns',
      'specialInstructions',
    ]

    const data = {}
    for (const key of ALLOWED) {
      if (req.body[key] === undefined) continue
      const v = req.body[key]
      // Empty strings -> null (cleaner DB state)
      if (typeof v === 'string') {
        data[key] = v.trim() === '' ? null : v.trim()
      } else if (v === null) {
        data[key] = null
      } else {
        // Booleans, numbers, JSON, dates -- pass through
        data[key] = v
      }
    }

    // Convert followUpDate string -> Date if needed
    if (data.followUpDate && typeof data.followUpDate === 'string') {
      const d = new Date(data.followUpDate)
      data.followUpDate = Number.isNaN(d.getTime()) ? null : d
    }

    const updated = await prisma.admission.update({
      where: { id: admission.id },
      data,
    })

    return successResponse(res, updated, 'Summary updated')
  } catch (err) {
    console.error('[updateSummary]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

// ── Discharge Medications CRUD ────────────────────────────────────────
// Section 11 of the discharge summary. Stored separately from in-stay
// MedicationOrder so the discharge Rx is editable without affecting
// the dose-administration history.

// List discharge meds for an admission
async function listDischargeMedications(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const items = await prisma.dischargeMedication.findMany({
      where: { admissionId: admission.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        medicine: { select: { id: true, name: true, genericName: true } },
      },
    })

    return successResponse(res, items)
  } catch (err) {
    console.error('[listDischargeMedications]', err)
    return errorResponse(res, 'Failed to fetch discharge medications', 500)
  }
}

// Add one discharge med. brandName + dose + frequency + duration are required.
async function addDischargeMedication(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const {
      medicineId, brandName, genericName, dose, frequency, duration,
      instructions, sortOrder,
    } = req.body

    if (!brandName || !brandName.trim()) {
      return errorResponse(res, 'brandName is required', 400)
    }
    if (!dose || !frequency || !duration) {
      return errorResponse(res, 'dose, frequency, and duration are required', 400)
    }

    // Verify medicineId belongs to this clinic if provided
    if (medicineId) {
      const med = await prisma.medicine.findFirst({
        where: { id: medicineId, clinicId: req.clinicId },
        select: { id: true },
      })
      if (!med) return errorResponse(res, 'Medicine not found in this clinic', 400)
    }

    const created = await prisma.dischargeMedication.create({
      data: {
        admissionId:  admission.id,
        medicineId:   medicineId || null,
        brandName:    brandName.trim(),
        genericName:  genericName?.trim() || null,
        dose:         dose.trim(),
        frequency:    frequency.trim(),
        duration:     duration.trim(),
        instructions: instructions?.trim() || null,
        sortOrder:    typeof sortOrder === 'number' ? sortOrder : 0,
      },
      include: {
        medicine: { select: { id: true, name: true, genericName: true } },
      },
    })

    return successResponse(res, created, 'Discharge medication added', 201)
  } catch (err) {
    console.error('[addDischargeMedication]', err)
    return errorResponse(res, 'Failed to add discharge medication', 500)
  }
}

// Update one discharge med
async function updateDischargeMedication(req, res) {
  try {
    const existing = await prisma.dischargeMedication.findFirst({
      where: { id: req.params.id },
      include: { admission: { select: { clinicId: true } } },
    })
    if (!existing || existing.admission.clinicId !== req.clinicId) {
      return errorResponse(res, 'Discharge medication not found', 404)
    }

    const {
      medicineId, brandName, genericName, dose, frequency, duration,
      instructions, sortOrder,
    } = req.body

    const data = {}
    if (medicineId   !== undefined) data.medicineId   = medicineId || null
    if (brandName    !== undefined) data.brandName    = brandName?.trim() || existing.brandName
    if (genericName  !== undefined) data.genericName  = genericName?.trim() || null
    if (dose         !== undefined) data.dose         = dose?.trim() || existing.dose
    if (frequency    !== undefined) data.frequency    = frequency?.trim() || existing.frequency
    if (duration     !== undefined) data.duration     = duration?.trim() || existing.duration
    if (instructions !== undefined) data.instructions = instructions?.trim() || null
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder

    const updated = await prisma.dischargeMedication.update({
      where: { id: existing.id },
      data,
      include: {
        medicine: { select: { id: true, name: true, genericName: true } },
      },
    })

    return successResponse(res, updated, 'Discharge medication updated')
  } catch (err) {
    console.error('[updateDischargeMedication]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

// Delete one discharge med
async function deleteDischargeMedication(req, res) {
  try {
    const existing = await prisma.dischargeMedication.findFirst({
      where: { id: req.params.id },
      include: { admission: { select: { clinicId: true } } },
    })
    if (!existing || existing.admission.clinicId !== req.clinicId) {
      return errorResponse(res, 'Discharge medication not found', 404)
    }

    await prisma.dischargeMedication.delete({ where: { id: existing.id } })
    return successResponse(res, { id: existing.id }, 'Discharge medication deleted')
  } catch (err) {
    console.error('[deleteDischargeMedication]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

// "Copy from active orders" -- pre-fills discharge meds from MedicationOrders
// that are still ACTIVE at discharge time. Useful for chronic-condition cases
// where many in-stay meds continue at home. Does NOT replace existing
// discharge meds -- always APPENDS. Doctor can edit/delete after.
async function copyActiveMedications(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.admissionId, clinicId: req.clinicId },
      select: { id: true },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const activeOrders = await prisma.medicationOrder.findMany({
      where: { admissionId: admission.id, status: 'ACTIVE' },
      include: { medicine: { select: { id: true, name: true, genericName: true } } },
      orderBy: { startDate: 'asc' },
    })

    if (activeOrders.length === 0) {
      return successResponse(res, [], 'No active medications to copy')
    }

    // Find current max sortOrder so new ones append cleanly
    const maxSort = await prisma.dischargeMedication.aggregate({
      where: { admissionId: admission.id },
      _max:  { sortOrder: true },
    })
    let nextSort = (maxSort._max.sortOrder || 0) + 1

    const created = []
    for (const o of activeOrders) {
      const dm = await prisma.dischargeMedication.create({
        data: {
          admissionId:  admission.id,
          medicineId:   o.medicineId || null,
          brandName:    o.medicine?.name        || o.medicineName || 'Medication',
          genericName:  o.medicine?.genericName  || null,
          // MedicationOrder stores dose, route, frequency separately;
          // copy what we have. Duration is left blank for doctor to set.
          dose:         o.dose         || '--',
          frequency:    o.frequency    || '--',
          duration:     '',  // doctor MUST set this
          instructions: o.instructions || null,
          sortOrder:    nextSort++,
        },
        include: {
          medicine: { select: { id: true, name: true, genericName: true } },
        },
      })
      created.push(dm)
    }

    return successResponse(res, created, `${created.length} medication(s) copied from active orders`, 201)
  } catch (err) {
    console.error('[copyActiveMedications]', err)
    return errorResponse(res, 'Failed to copy active medications', 500)
  }
}

module.exports = {
  getSummary,
  updateSummary,
  listDischargeMedications,
  addDischargeMedication,
  updateDischargeMedication,
  deleteDischargeMedication,
  copyActiveMedications,
}
