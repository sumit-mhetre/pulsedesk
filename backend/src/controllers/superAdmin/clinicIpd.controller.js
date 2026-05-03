// Super Admin IPD configuration controller. Manages per-clinic IPD settings
// from within the existing "Edit Clinic" modal: toggle ipdEnabled, configure
// facility type, and set up bed inventory.
//
// Note on responsibilities: Super Admin only sets up bed STRUCTURE
// (number, type, ward, floor). Daily RATE is set later by clinic admin from
// the Bed Management page on the clinic side. This separates platform setup
// from clinic billing configuration.
//
// All endpoints require authorize('SUPER_ADMIN') in the route file.

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')
const { logAudit } = require('../../lib/audit')

// ── Get IPD configuration for a clinic ────────────────────
async function getClinicIPDConfig(req, res) {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true,
        facilityType: true, ipdEnabled: true, ipdSettings: true,
      },
    })
    if (!clinic) return errorResponse(res, 'Clinic not found', 404)

    const [bedCount, activeBedCount, occupiedBedCount, admissionCount, lastAdmission] = await Promise.all([
      prisma.bed.count({ where: { clinicId: clinic.id } }),
      prisma.bed.count({ where: { clinicId: clinic.id, isActive: true } }),
      prisma.bed.count({ where: { clinicId: clinic.id, status: 'OCCUPIED' } }),
      prisma.admission.count({ where: { clinicId: clinic.id } }),
      prisma.admission.findFirst({
        where: { clinicId: clinic.id },
        orderBy: { admittedAt: 'desc' },
        select: { id: true, admissionNumber: true, admittedAt: true },
      }),
    ])

    return successResponse(res, {
      clinic,
      stats: {
        bedCount,
        activeBedCount,
        occupiedBedCount,
        admissionCount,
        lastAdmission,
      },
    })
  } catch (err) {
    console.error('[getClinicIPDConfig]', err)
    return errorResponse(res, 'Failed to fetch IPD config', 500)
  }
}

// ── Toggle IPD on/off + facility type ─────────────────────
async function updateClinicIPDConfig(req, res) {
  try {
    const { facilityType, ipdEnabled, ipdSettings } = req.body

    const existing = await prisma.clinic.findUnique({
      where: { id: req.params.id },
      select: { id: true, ipdEnabled: true, ipdSettings: true },
    })
    if (!existing) return errorResponse(res, 'Clinic not found', 404)

    const data = {}
    if (facilityType !== undefined) {
      const valid = ['CLINIC_ONLY', 'NURSING_HOME', 'HOSPITAL']
      if (!valid.includes(facilityType)) {
        return errorResponse(res, 'Invalid facility type', 400)
      }
      data.facilityType = facilityType
    }
    if (ipdEnabled !== undefined) data.ipdEnabled = !!ipdEnabled

    if (ipdSettings && typeof ipdSettings === 'object' && !Array.isArray(ipdSettings)) {
      data.ipdSettings = { ...(existing.ipdSettings || {}), ...ipdSettings }
    }

    const clinic = await prisma.clinic.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, name: true,
        facilityType: true, ipdEnabled: true, ipdSettings: true,
      },
    })

    if (data.ipdEnabled !== undefined && data.ipdEnabled !== existing.ipdEnabled) {
      await logAudit(req, {
        clinicId: clinic.id,
        action:   data.ipdEnabled ? 'clinic.ipd_enabled' : 'clinic.ipd_disabled',
        entity:   'Clinic',
        entityId: clinic.id,
      })
    } else {
      await logAudit(req, {
        clinicId: clinic.id,
        action:   'clinic.ipd_config_update',
        entity:   'Clinic',
        entityId: clinic.id,
        details:  { fieldsChanged: Object.keys(data) },
      })
    }

    return successResponse(res, clinic, 'IPD configuration updated')
  } catch (err) {
    console.error('[updateClinicIPDConfig]', err)
    return errorResponse(res, 'Failed to update IPD config', 500)
  }
}

// ── List beds for a specific clinic (Super Admin) ─────────
async function listClinicBeds(req, res) {
  try {
    const beds = await prisma.bed.findMany({
      where: { clinicId: req.params.id },
      orderBy: [{ ward: 'asc' }, { bedNumber: 'asc' }],
    })
    return successResponse(res, beds)
  } catch (err) {
    console.error('[listClinicBeds]', err)
    return errorResponse(res, 'Failed to fetch beds', 500)
  }
}

// ── Bulk add beds (Super Admin - initial setup) ───────────
// Body: { bedType, ward, floor, prefix, startNumber, count, padDigits }
// Daily rate defaults to 0 - clinic admin sets it later via Bed Management page.
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
      where: { clinicId: req.params.id, bedNumber: { in: newBedNumbers } },
      select: { bedNumber: true },
    })
    if (existing.length > 0) {
      return errorResponse(res, `Bed numbers already exist: ${existing.map(b => b.bedNumber).join(', ')}`, 409)
    }

    const bedsToCreate = newBedNumbers.map(bedNumber => ({
      clinicId:  req.params.id,
      bedNumber,
      bedType,
      ward:      ward || null,
      floor:     floor || null,
      dailyRate: 0,
    }))
    await prisma.bed.createMany({ data: bedsToCreate })

    await logAudit(req, {
      clinicId: req.params.id,
      action:   'bed.bulk_create',
      entity:   'Bed',
      details:  { count, bedType, ward, prefix, startNumber },
    })

    return successResponse(res, { created: count }, `${count} beds created`, 201)
  } catch (err) {
    console.error('[bulkCreateBeds]', err)
    return errorResponse(res, 'Failed to create beds', 500)
  }
}

// ── Single bed CRUD for Super Admin ───────────────────────
async function createClinicBed(req, res) {
  try {
    const { bedNumber, bedType, ward, floor, notes, status } = req.body

    if (!bedNumber || !bedType) {
      return errorResponse(res, 'bedNumber and bedType are required', 400)
    }

    const existing = await prisma.bed.findFirst({
      where: { clinicId: req.params.id, bedNumber: bedNumber.trim() },
    })
    if (existing) return errorResponse(res, `Bed ${bedNumber} already exists`, 409)

    const bed = await prisma.bed.create({
      data: {
        clinicId:  req.params.id,
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
    console.error('[createClinicBed]', err)
    return errorResponse(res, 'Failed to create bed', 500)
  }
}

async function updateClinicBed(req, res) {
  try {
    const existing = await prisma.bed.findFirst({
      where: { id: req.params.bedId, clinicId: req.params.id },
    })
    if (!existing) return errorResponse(res, 'Bed not found', 404)

    const { bedNumber, bedType, ward, floor, notes, status, isActive } = req.body

    if (bedNumber !== undefined && bedNumber.trim() !== existing.bedNumber) {
      const dup = await prisma.bed.findFirst({
        where: { clinicId: req.params.id, bedNumber: bedNumber.trim(), id: { not: req.params.bedId } },
      })
      if (dup) return errorResponse(res, `Bed ${bedNumber} already exists`, 409)
    }

    if (status === 'OCCUPIED' && existing.status !== 'OCCUPIED') {
      return errorResponse(res, 'Cannot set OCCUPIED manually - admit a patient instead', 400)
    }
    if (status === 'VACANT' && existing.currentAdmissionId) {
      return errorResponse(res, 'Cannot mark vacant - bed is occupied', 400)
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
      where: { id: req.params.bedId },
      data,
    })
    return successResponse(res, bed, 'Bed updated')
  } catch (err) {
    console.error('[updateClinicBed]', err)
    return errorResponse(res, 'Failed to update bed', 500)
  }
}

async function deleteClinicBed(req, res) {
  try {
    const existing = await prisma.bed.findFirst({
      where: { id: req.params.bedId, clinicId: req.params.id },
    })
    if (!existing) return errorResponse(res, 'Bed not found', 404)
    if (existing.currentAdmissionId) {
      return errorResponse(res, 'Cannot delete - bed is occupied', 400)
    }
    await prisma.bed.update({
      where: { id: req.params.bedId },
      data: { isActive: false },
    })
    return successResponse(res, null, 'Bed deactivated')
  } catch (err) {
    console.error('[deleteClinicBed]', err)
    return errorResponse(res, 'Failed to delete bed', 500)
  }
}

module.exports = {
  getClinicIPDConfig,
  updateClinicIPDConfig,
  listClinicBeds,
  bulkCreateBeds,
  createClinicBed,
  updateClinicBed,
  deleteClinicBed,
}
