// IPD bed controller - clinic-scoped CRUD + bed board view.
//
// Permission model:
//   - listBeds, getBedBoard      → manageIPD (anyone in IPD can view)
//   - createBed, updateBed       → manageBeds (admin/doctor/receptionist)
//   - deleteBed (deactivate)     → manageBeds
//   - updateBedRate              → manageIPDBilling (admin/doctor/receptionist)
//                                   - rate is a billing config, separate gate
//
// Status constraints:
//   - OCCUPIED status cannot be set manually - only through admission flow
//   - VACANT cannot be set when bed has currentAdmissionId (must discharge first)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

// ── List all beds for the clinic ──────────────────────────
async function listBeds(req, res) {
  try {
    const { includeInactive = false, status, bedType, ward } = req.query
    const where = { clinicId: req.clinicId }
    if (!includeInactive) where.isActive = true
    if (status)   where.status   = status
    if (bedType)  where.bedType  = bedType
    if (ward)     where.ward     = ward

    const beds = await prisma.bed.findMany({
      where,
      orderBy: [{ ward: 'asc' }, { bedNumber: 'asc' }],
    })

    return successResponse(res, beds)
  } catch (err) {
    console.error('[listBeds]', err)
    return errorResponse(res, 'Failed to fetch beds', 500)
  }
}

// ── Bed board - grouped by ward, with current admission preview ──
async function getBedBoard(req, res) {
  try {
    const beds = await prisma.bed.findMany({
      where: { clinicId: req.clinicId, isActive: true },
      orderBy: [{ ward: 'asc' }, { bedNumber: 'asc' }],
    })

    const occupiedIds = beds.filter(b => b.currentAdmissionId).map(b => b.currentAdmissionId)
    const admissions = occupiedIds.length === 0 ? [] : await prisma.admission.findMany({
      where: { id: { in: occupiedIds } },
      select: {
        id: true,
        admissionNumber: true,
        admittedAt: true,
        provisionalDiagnosis: true,
        patient: { select: { id: true, name: true, patientCode: true, gender: true, age: true } },
        primaryDoctor: { select: { id: true, name: true } },
      },
    })
    const admissionMap = new Map(admissions.map(a => [a.id, a]))

    const grouped = {}
    for (const bed of beds) {
      const wardKey = bed.ward || 'Unspecified'
      if (!grouped[wardKey]) grouped[wardKey] = []
      grouped[wardKey].push({
        ...bed,
        currentAdmission: bed.currentAdmissionId ? admissionMap.get(bed.currentAdmissionId) || null : null,
      })
    }

    const summary = {
      total:    beds.length,
      vacant:   beds.filter(b => b.status === 'VACANT').length,
      occupied: beds.filter(b => b.status === 'OCCUPIED').length,
      cleaning: beds.filter(b => b.status === 'CLEANING').length,
      blocked:  beds.filter(b => b.status === 'BLOCKED').length,
      reserved: beds.filter(b => b.status === 'RESERVED').length,
    }

    return successResponse(res, { groups: grouped, summary })
  } catch (err) {
    console.error('[getBedBoard]', err)
    return errorResponse(res, 'Failed to fetch bed board', 500)
  }
}

// ── Create a single bed (clinic admin) ────────────────────
// Daily rate is optional - defaults to 0, can be set later.
async function createBed(req, res) {
  try {
    const { bedNumber, bedType, ward, floor, notes, status } = req.body

    if (!bedNumber || !bedType) {
      return errorResponse(res, 'bedNumber and bedType are required', 400)
    }

    const existing = await prisma.bed.findFirst({
      where: { clinicId: req.clinicId, bedNumber: bedNumber.trim() },
    })
    if (existing) return errorResponse(res, `Bed ${bedNumber} already exists`, 409)

    const bed = await prisma.bed.create({
      data: {
        clinicId:  req.clinicId,
        bedNumber: bedNumber.trim(),
        bedType,
        ward:      ward || null,
        floor:     floor || null,
        notes:     notes || null,
        status:    status || 'VACANT',
        dailyRate: 0,
      },
    })
    return successResponse(res, bed, 'Bed created', 201)
  } catch (err) {
    console.error('[createBed]', err)
    return errorResponse(res, 'Failed to create bed', 500)
  }
}

// ── Bulk add beds (clinic admin) ──────────────────────────
// Body: { bedType, ward, floor, prefix, startNumber, count, padDigits }
// Generates bed numbers like "B-001", "B-002", etc. Daily rate defaults to 0.
// ── Suggest next bed prefix + number for bulk add ─────────────────────
// Given (bedType, ward, floor), build the auto-prefix and look at existing
// beds matching that prefix to suggest the next start number.
//
// Auto-prefix logic:
//   General + ward "A" + floor "1"   ->  "GA1-"
//   ICU + ward "B" + floor "2"        ->  "ICU-B2-"   (multi-letter type)
//   General with no ward / no floor    ->  "G-"
//   Other / no ward / no floor         ->  "B-"        (fallback)
//
// First letters concatenated, uppercased, trailing dash. Type names with
// > 3 chars (ICU, HDU, etc.) keep their full code; shorter types use
// first letter of label.
function buildAutoPrefix(bedType, ward, floor) {
  // Map enum values to their short label code used in the prefix.
  const TYPE_CODE = {
    GENERAL:      'G',
    SEMI_PRIVATE: 'SP',
    PRIVATE:      'P',
    ICU:          'ICU',
    HDU:          'HDU',
    LABOUR:       'L',
    DAY_CARE:     'DC',
    ISOLATION:    'ISO',
    OTHER:        'B',
  }
  const typeCode = TYPE_CODE[bedType] || 'B'
  const wardCode = ward  ? String(ward).trim().charAt(0).toUpperCase()  : ''
  const floorStr = floor ? String(floor).trim() : ''

  // If type has multi-letter code (ICU/HDU/SP/DC/ISO), keep dash separator
  // between code and ward/floor. Otherwise concatenate.
  const usesDashSep = typeCode.length > 1
  const middle = (wardCode || floorStr)
    ? `${usesDashSep ? '-' : ''}${wardCode}${floorStr}`
    : ''
  return `${typeCode}${middle}-`
}

async function suggestNextBedNumber(req, res) {
  try {
    const { bedType, ward = '', floor = '' } = req.query
    if (!bedType) return errorResponse(res, 'bedType is required', 400)

    const prefix = buildAutoPrefix(bedType, ward, floor)

    // Find existing beds for this clinic whose bedNumber starts with `prefix`.
    // We only need the bedNumber column to extract the numeric tail.
    const existing = await prisma.bed.findMany({
      where: {
        clinicId:  req.clinicId,
        bedNumber: { startsWith: prefix },
      },
      select: { bedNumber: true },
    })

    // Parse out the numeric tail from each existing bed and find max.
    let maxNum = 0
    for (const b of existing) {
      const tail = b.bedNumber.slice(prefix.length)
      const n = parseInt(tail, 10)
      if (!Number.isNaN(n) && n > maxNum) maxNum = n
    }

    return successResponse(res, {
      prefix,
      nextNumber:    maxNum + 1,
      existingCount: existing.length,
      existingMax:   maxNum,
    })
  } catch (err) {
    console.error('[suggestNextBedNumber]', err)
    return errorResponse(res, 'Failed to suggest bed number', 500)
  }
}

async function bulkCreateBeds(req, res) {
  try {
    const { bedType, ward, floor, prefix = '', startNumber = 1, count, padDigits = 3 } = req.body

    if (!bedType || !count) {
      return errorResponse(res, 'bedType and count are required', 400)
    }
    if (count < 1 || count > 100) {
      return errorResponse(res, 'count must be between 1 and 100', 400)
    }

    const pad = (n) => String(n).padStart(padDigits, '0')
    const newBedNumbers = []
    for (let i = 0; i < count; i++) {
      newBedNumbers.push(`${prefix}${pad(startNumber + i)}`)
    }

    const existing = await prisma.bed.findMany({
      where: { clinicId: req.clinicId, bedNumber: { in: newBedNumbers } },
      select: { bedNumber: true },
    })
    if (existing.length > 0) {
      return errorResponse(res, `Bed numbers already exist: ${existing.map(b => b.bedNumber).join(', ')}`, 409)
    }

    const bedsToCreate = newBedNumbers.map(bedNumber => ({
      clinicId:  req.clinicId,
      bedNumber,
      bedType,
      ward:      ward || null,
      floor:     floor || null,
      dailyRate: 0,
    }))
    await prisma.bed.createMany({ data: bedsToCreate })

    return successResponse(res, { created: count }, `${count} beds created`, 201)
  } catch (err) {
    console.error('[bulkCreateBeds]', err)
    return errorResponse(res, 'Failed to create beds', 500)
  }
}

// ── Update bed details (NOT rate - see updateBedRate) ─────
async function updateBed(req, res) {
  try {
    const existing = await prisma.bed.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!existing) return errorResponse(res, 'Bed not found', 404)

    const { bedNumber, bedType, ward, floor, notes, status, isActive } = req.body

    // Bed number change → check duplicate
    if (bedNumber !== undefined && bedNumber.trim() !== existing.bedNumber) {
      const dup = await prisma.bed.findFirst({
        where: { clinicId: req.clinicId, bedNumber: bedNumber.trim(), id: { not: req.params.id } },
      })
      if (dup) return errorResponse(res, `Bed ${bedNumber} already exists`, 409)
    }

    // Cannot manually set OCCUPIED - only via admission
    if (status === 'OCCUPIED' && existing.status !== 'OCCUPIED') {
      return errorResponse(res, 'Cannot set OCCUPIED manually - admit a patient instead', 400)
    }
    // Cannot mark VACANT if bed has active admission
    if (status === 'VACANT' && existing.currentAdmissionId) {
      return errorResponse(res, 'Cannot mark vacant - discharge the patient first', 400)
    }

    const data = {}
    if (bedNumber !== undefined) data.bedNumber = bedNumber.trim()
    if (bedType   !== undefined) data.bedType   = bedType
    if (ward      !== undefined) data.ward      = ward || null
    if (floor     !== undefined) data.floor     = floor || null
    if (notes     !== undefined) data.notes     = notes || null
    if (status    !== undefined) data.status    = status
    if (isActive  !== undefined) data.isActive  = !!isActive

    const bed = await prisma.bed.update({
      where: { id: req.params.id },
      data,
    })
    return successResponse(res, bed, 'Bed updated')
  } catch (err) {
    console.error('[updateBed]', err)
    return errorResponse(res, 'Failed to update bed', 500)
  }
}

// ── Update daily rate only (separate permission: manageIPDBilling) ──
// Rate is billing config, gated on a different permission than other bed
// edits. UI may show inline rate field even to non-billing users (read-only).
async function updateBedRate(req, res) {
  try {
    const existing = await prisma.bed.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!existing) return errorResponse(res, 'Bed not found', 404)

    const { dailyRate } = req.body
    if (dailyRate === undefined || dailyRate === null || dailyRate === '') {
      return errorResponse(res, 'dailyRate is required', 400)
    }
    const rate = parseFloat(dailyRate)
    if (Number.isNaN(rate) || rate < 0) {
      return errorResponse(res, 'dailyRate must be a non-negative number', 400)
    }

    const bed = await prisma.bed.update({
      where: { id: req.params.id },
      data:  { dailyRate: rate },
    })
    return successResponse(res, bed, 'Bed rate updated')
  } catch (err) {
    console.error('[updateBedRate]', err)
    return errorResponse(res, 'Failed to update rate', 500)
  }
}

// ── Soft-delete (mark inactive) ──────────────────────────
async function deleteBed(req, res) {
  try {
    const existing = await prisma.bed.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    })
    if (!existing) return errorResponse(res, 'Bed not found', 404)

    if (existing.currentAdmissionId) {
      return errorResponse(res, 'Cannot delete - bed is currently occupied', 400)
    }

    await prisma.bed.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    return successResponse(res, null, 'Bed deactivated')
  } catch (err) {
    console.error('[deleteBed]', err)
    return errorResponse(res, 'Failed to delete bed', 500)
  }
}

module.exports = {
  listBeds,
  getBedBoard,
  createBed,
  bulkCreateBeds,
  suggestNextBedNumber,
  updateBed,
  updateBedRate,
  deleteBed,
}
