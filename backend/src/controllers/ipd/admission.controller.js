// IPD admission controller - handles the full admission lifecycle.
//
// Permission gates (set in routes file):
//   - listAdmissions, getAdmission     → manageIPD (anyone in IPD can view)
//   - createAdmission                  → manageAdmissions
//   - updateAdmission                  → manageAdmissions
//   - dischargeAdmission               → dischargePatient
//
// Bed status transitions handled atomically in transactions:
//   admit:     bed VACANT/RESERVED → OCCUPIED, bed.currentAdmissionId = admission.id
//   discharge: bed OCCUPIED        → CLEANING, bed.currentAdmissionId = null
//
// Bed rent is calculated on demand from admittedAt/dischargedAt at view/print time.
// We do NOT create IPDCharge rows for bed rent (Step 3 design). Other charges
// (medicines, lab tests) WILL use IPDCharge rows when those flows are built.

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse, paginatedResponse } = require('../../lib/response')

// ── Generate Admission Number ─────────────────────────────
// Format: <opdSeriesPrefix>-IPD-<NNNN> (e.g. MH-IPD-0001).
// If clinic has no opdSeriesPrefix, falls back to "IPD-<NNNN>".
// Sequence is per-clinic, never resets. Uses count + 1, then verifies
// uniqueness in case of race (rare on free tier with single instance).
async function generateAdmissionNumber(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { opdSeriesPrefix: true },
  })
  const prefix = clinic?.opdSeriesPrefix
    ? `${clinic.opdSeriesPrefix}-IPD`
    : 'IPD'

  const count = await prisma.admission.count({ where: { clinicId } })

  // Try sequence count+1, count+2, ... until we find an unused one
  let seq = count + 1
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `${prefix}-${String(seq).padStart(4, '0')}`
    const existing = await prisma.admission.findFirst({
      where: { clinicId, admissionNumber: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    seq++
  }
  throw new Error('Failed to generate unique admission number after 50 attempts')
}

// ── Compute days admitted (for bed-rent display) ──────────
// Calendar-day count: same date = 1 day, next date = 2 days, etc.
// Uses IST-aware day boundaries by stripping time component.
function computeDaysAdmitted(admittedAt, endAt = new Date()) {
  if (!admittedAt) return 0
  const start = new Date(admittedAt)
  const end = endAt instanceof Date ? endAt : new Date(endAt)

  // Strip time - count by calendar day boundary
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endDay   = new Date(end.getFullYear(),   end.getMonth(),   end.getDate()).getTime()
  const days = Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, days)
}

// ── List admissions with filters ──────────────────────────
async function listAdmissions(req, res) {
  try {
    const { page = 1, limit = 20, status, patientId, doctorId, search, from, to } = req.query

    const where = { clinicId: req.clinicId }
    if (status)    where.status = status
    if (patientId) where.patientId = patientId
    if (doctorId)  where.primaryDoctorId = doctorId
    if (from || to) {
      where.admittedAt = {}
      if (from) where.admittedAt.gte = new Date(from)
      if (to) {
        // Include the entire "to" day
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.admittedAt.lte = toDate
      }
    }
    if (search) {
      where.OR = [
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { phone: { contains: search } } },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { admittedAt: 'desc' },
        include: {
          patient:       { select: { id: true, patientCode: true, name: true, age: true, gender: true, phone: true } },
          primaryDoctor: { select: { id: true, name: true } },
          bed:           { select: { id: true, bedNumber: true, ward: true, bedType: true, dailyRate: true } },
        },
      }),
      prisma.admission.count({ where }),
    ])

    // Augment each row with computed days/bedRentTotal so list view can show running total
    const enriched = admissions.map(a => {
      const days = computeDaysAdmitted(a.admittedAt, a.dischargedAt || new Date())
      const bedRentTotal = (a.bed?.dailyRate || 0) * days
      return { ...a, daysAdmitted: days, bedRentTotal }
    })

    return paginatedResponse(res, enriched, total, page, limit)
  } catch (err) {
    console.error('[listAdmissions]', err)
    return errorResponse(res, 'Failed to fetch admissions', 500)
  }
}

// ── Get single admission ──────────────────────────────────
async function getAdmission(req, res) {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        patient:       true,
        primaryDoctor: { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true } },
        bed:           true,
        clinic: {
          select: {
            id: true, name: true, code: true, address: true, phone: true, mobile: true,
            email: true, tagline: true, logo: true,
          },
        },
      },
    })
    if (!admission) return errorResponse(res, 'Admission not found', 404)

    const days = computeDaysAdmitted(admission.admittedAt, admission.dischargedAt || new Date())
    const bedRentTotal = (admission.bed?.dailyRate || 0) * days

    return successResponse(res, {
      ...admission,
      daysAdmitted: days,
      bedRentTotal,
    })
  } catch (err) {
    console.error('[getAdmission]', err)
    return errorResponse(res, 'Failed to fetch admission', 500)
  }
}

// ── Create admission (admit a patient to a bed) ───────────
async function createAdmission(req, res) {
  try {
    const {
      patientId,
      primaryDoctorId,
      bedId,
      admittedAt,
      provisionalDiagnosis,
      reasonForAdmission,
      admissionNotes,
      // Attendant
      attendantName,
      attendantRelation,
      attendantPhone,
      attendantAddress,
      attendantIdProof,
      // MLC / source
      isMLC,
      mlcNumber,
      admissionSource,
      referredFrom,
      // Billing
      paymentMode,
      insuranceProvider,
      insurancePolicy,
      initialDeposit,
    } = req.body

    // Required fields
    if (!patientId || !primaryDoctorId || !bedId || !reasonForAdmission) {
      return errorResponse(res, 'patientId, primaryDoctorId, bedId, and reasonForAdmission are required', 400)
    }

    // Validate patient
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId },
    })
    if (!patient) return errorResponse(res, 'Patient not found', 404)

    // Validate doctor (must belong to this clinic, must be DOCTOR or ADMIN)
    const doctor = await prisma.user.findFirst({
      where: { id: primaryDoctorId, clinicId: req.clinicId, role: { in: ['DOCTOR', 'ADMIN'] }, isActive: true },
    })
    if (!doctor) return errorResponse(res, 'Doctor not found or not eligible', 404)

    // Validate bed (must belong to this clinic, must be VACANT or RESERVED)
    const bed = await prisma.bed.findFirst({
      where: { id: bedId, clinicId: req.clinicId, isActive: true },
    })
    if (!bed) return errorResponse(res, 'Bed not found', 404)
    if (bed.status === 'OCCUPIED') {
      return errorResponse(res, `Bed ${bed.bedNumber} is currently occupied`, 409)
    }
    if (bed.status === 'CLEANING' || bed.status === 'BLOCKED') {
      return errorResponse(res, `Bed ${bed.bedNumber} is not available (status: ${bed.status})`, 409)
    }

    // Generate admission number
    const admissionNumber = await generateAdmissionNumber(req.clinicId)

    // Create admission + update bed in one transaction
    const admission = await prisma.$transaction(async (tx) => {
      // Re-check bed inside transaction (race protection)
      const bedCheck = await tx.bed.findUnique({ where: { id: bedId } })
      if (bedCheck.status === 'OCCUPIED' || bedCheck.currentAdmissionId) {
        throw new Error(`Bed ${bedCheck.bedNumber} was just occupied. Please select another.`)
      }

      const newAdmission = await tx.admission.create({
        data: {
          clinicId: req.clinicId,
          admissionNumber,
          patientId,
          primaryDoctorId,
          bedId,
          status: 'ADMITTED',
          admittedAt: admittedAt ? new Date(admittedAt) : new Date(),
          provisionalDiagnosis: provisionalDiagnosis || null,
          reasonForAdmission,
          admissionNotes: admissionNotes || null,
          attendantName:    attendantName || null,
          attendantRelation:attendantRelation || null,
          attendantPhone:   attendantPhone || null,
          attendantAddress: attendantAddress || null,
          attendantIdProof: attendantIdProof || null,
          isMLC: !!isMLC,
          mlcNumber: isMLC ? (mlcNumber || null) : null,
          admissionSource: admissionSource || null,
          referredFrom:    referredFrom || null,
          paymentMode:      paymentMode || null,
          insuranceProvider:insuranceProvider || null,
          insurancePolicy:  insurancePolicy || null,
          initialDeposit:   parseFloat(initialDeposit) || 0,
        },
      })

      // Mark bed as OCCUPIED with this admission
      await tx.bed.update({
        where: { id: bedId },
        data: {
          status: 'OCCUPIED',
          currentAdmissionId: newAdmission.id,
        },
      })

      return newAdmission
    })

    // Re-fetch with relations for the response
    const full = await prisma.admission.findUnique({
      where: { id: admission.id },
      include: {
        patient:       { select: { id: true, patientCode: true, name: true } },
        primaryDoctor: { select: { id: true, name: true } },
        bed:           { select: { id: true, bedNumber: true, ward: true, bedType: true, dailyRate: true } },
      },
    })

    return successResponse(res, full, 'Patient admitted successfully', 201)
  } catch (err) {
    console.error('[createAdmission]', err)
    return errorResponse(res, err.message || 'Failed to admit patient', 500)
  }
}

// ── Update admission (limited - no patient/bed change here) ──
// Fields like notes, diagnosis, attendant info, deposit can be updated
// after admission. Bed transfer is a separate endpoint (Step 4 / separate flow).
async function updateAdmission(req, res) {
  try {
    const existing = await prisma.admission.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!existing) return errorResponse(res, 'Admission not found', 404)
    if (existing.status === 'DISCHARGED' || existing.status === 'DAMA' || existing.status === 'DEATH') {
      return errorResponse(res, 'Cannot edit a closed admission', 400)
    }

    const {
      provisionalDiagnosis, reasonForAdmission, admissionNotes,
      attendantName, attendantRelation, attendantPhone, attendantAddress, attendantIdProof,
      isMLC, mlcNumber, admissionSource, referredFrom,
      paymentMode, insuranceProvider, insurancePolicy, initialDeposit,
    } = req.body

    const data = {}
    if (provisionalDiagnosis !== undefined) data.provisionalDiagnosis = provisionalDiagnosis || null
    if (reasonForAdmission   !== undefined) data.reasonForAdmission   = reasonForAdmission
    if (admissionNotes       !== undefined) data.admissionNotes       = admissionNotes || null
    if (attendantName        !== undefined) data.attendantName        = attendantName || null
    if (attendantRelation    !== undefined) data.attendantRelation    = attendantRelation || null
    if (attendantPhone       !== undefined) data.attendantPhone       = attendantPhone || null
    if (attendantAddress     !== undefined) data.attendantAddress     = attendantAddress || null
    if (attendantIdProof     !== undefined) data.attendantIdProof     = attendantIdProof || null
    if (isMLC                !== undefined) {
      data.isMLC = !!isMLC
      data.mlcNumber = isMLC ? (mlcNumber || null) : null
    }
    if (admissionSource      !== undefined) data.admissionSource      = admissionSource || null
    if (referredFrom         !== undefined) data.referredFrom         = referredFrom || null
    if (paymentMode          !== undefined) data.paymentMode          = paymentMode || null
    if (insuranceProvider    !== undefined) data.insuranceProvider    = insuranceProvider || null
    if (insurancePolicy      !== undefined) data.insurancePolicy      = insurancePolicy || null
    if (initialDeposit       !== undefined) data.initialDeposit       = parseFloat(initialDeposit) || 0

    const updated = await prisma.admission.update({
      where: { id: req.params.id },
      data,
    })
    return successResponse(res, updated, 'Admission updated')
  } catch (err) {
    console.error('[updateAdmission]', err)
    return errorResponse(res, 'Failed to update admission', 500)
  }
}

// ── Discharge a patient ────────────────────────────────────
// Status options: DISCHARGED (normal), DAMA (against medical advice), DEATH.
// All free the bed (OCCUPIED → CLEANING). Bed must be marked clean manually
// before another admission can use it.
async function dischargeAdmission(req, res) {
  try {
    const existing = await prisma.admission.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: { bed: true },
    })
    if (!existing) return errorResponse(res, 'Admission not found', 404)

    if (existing.status !== 'ADMITTED') {
      return errorResponse(res, `Admission is already ${existing.status.toLowerCase()}`, 400)
    }

    const {
      status = 'DISCHARGED',
      dischargedAt,
      finalDiagnosis,
      dischargeNotes,
      dischargeAdvice,
      causeOfDeath,
      damaReason,
    } = req.body

    const validStatuses = ['DISCHARGED', 'DAMA', 'DEATH']
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid discharge status', 400)
    }

    // Validate status-specific required fields
    if (status === 'DEATH' && !causeOfDeath) {
      return errorResponse(res, 'causeOfDeath is required when status=DEATH', 400)
    }
    if (status === 'DAMA' && !damaReason) {
      return errorResponse(res, 'damaReason is required when status=DAMA', 400)
    }

    const dischargeTime = dischargedAt ? new Date(dischargedAt) : new Date()
    if (dischargeTime < new Date(existing.admittedAt)) {
      return errorResponse(res, 'Discharge time cannot be before admission time', 400)
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.admission.update({
        where: { id: req.params.id },
        data: {
          status,
          dischargedAt: dischargeTime,
          finalDiagnosis:  finalDiagnosis || null,
          dischargeNotes:  dischargeNotes || null,
          dischargeAdvice: dischargeAdvice || null,
          causeOfDeath:    status === 'DEATH' ? causeOfDeath : null,
          damaReason:      status === 'DAMA'  ? damaReason  : null,
        },
      })

      // Free the bed - mark for cleaning
      if (existing.bedId) {
        await tx.bed.update({
          where: { id: existing.bedId },
          data: {
            status: 'CLEANING',
            currentAdmissionId: null,
          },
        })
      }

      return updated
    })

    return successResponse(res, result, 'Patient discharged successfully')
  } catch (err) {
    console.error('[dischargeAdmission]', err)
    return errorResponse(res, 'Failed to discharge', 500)
  }
}

// ── Mark bed clean ────────────────────────────────────────
// Helper endpoint for the bed board: CLEANING → VACANT.
// Lives here because it conceptually closes out a discharge cycle.
async function markBedClean(req, res) {
  try {
    const bed = await prisma.bed.findFirst({
      where: { id: req.params.bedId, clinicId: req.clinicId },
    })
    if (!bed) return errorResponse(res, 'Bed not found', 404)
    if (bed.status !== 'CLEANING') {
      return errorResponse(res, `Bed is ${bed.status}, cannot mark clean`, 400)
    }
    const updated = await prisma.bed.update({
      where: { id: req.params.bedId },
      data: { status: 'VACANT' },
    })
    return successResponse(res, updated, 'Bed marked clean and ready')
  } catch (err) {
    console.error('[markBedClean]', err)
    return errorResponse(res, 'Failed to update bed', 500)
  }
}

module.exports = {
  listAdmissions,
  getAdmission,
  createAdmission,
  updateAdmission,
  dischargeAdmission,
  markBedClean,
  // Exported helpers for other controllers
  computeDaysAdmitted,
}
