const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

// ── Generate unique patient code ──────────────────────────
async function generatePatientCode(clinicId) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } });
  const prefix = clinic.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'PAT';
  const count = await prisma.patient.count({ where: { clinicId } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// ── Get all patients ──────────────────────────────────────
async function getPatients(req, res) {
  try {
    const { page = 1, limit = 20, search = '', gender } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { clinicId: req.clinicId, isActive: true };
    if (gender) where.gender = gender;
    if (search) {
      where.OR = [
        { name:        { contains: search, mode: 'insensitive' } },
        { phone:       { contains: search } },
        { patientCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, patientCode: true, name: true, age: true,
          gender: true, phone: true, email: true, bloodGroup: true,
          allergies: true, chronicConditions: true, photo: true,
          createdAt: true,
          _count: { select: { prescriptions: true, appointments: true } },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return paginatedResponse(res, patients, total, page, limit);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch patients', 500);
  }
}

// ── Get single patient ────────────────────────────────────
async function getPatient(req, res) {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        vitalRecords: { orderBy: { date: 'desc' }, take: 10 },
        appointments: {
          orderBy: { createdAt: 'desc' }, take: 5,
          select: { id: true, tokenNo: true, tokenDate: true, status: true },
        },
        _count: { select: { prescriptions: true, appointments: true, bills: true } },
      },
    });
    if (!patient) return errorResponse(res, 'Patient not found', 404);
    return successResponse(res, patient);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch patient', 500);
  }
}

// ── Create patient ────────────────────────────────────────
async function createPatient(req, res) {
  try {
    const {
      name, age, gender, phone, email, address,
      bloodGroup, allergies, chronicConditions,
    } = req.body;

    // Check duplicate phone in same clinic
    const existing = await prisma.patient.findFirst({
      where: { clinicId: req.clinicId, phone, isActive: true },
    });
    if (existing) return errorResponse(res, `Patient with phone ${phone} already exists (${existing.patientCode} — ${existing.name})`, 409);

    const patientCode = await generatePatientCode(req.clinicId);

    const patient = await prisma.patient.create({
      data: {
        clinicId: req.clinicId,
        patientCode, name, age: parseInt(age), gender,
        phone, email, address, bloodGroup,
        allergies:         Array.isArray(allergies) ? allergies : [],
        chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [],
      },
    });

    return successResponse(res, patient, 'Patient registered successfully', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to create patient', 500);
  }
}

// ── Update patient ────────────────────────────────────────
async function updatePatient(req, res) {
  try {
    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Patient not found', 404);

    const {
      name, age, gender, phone, email, address,
      bloodGroup, allergies, chronicConditions,
    } = req.body;

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...(name  && { name }),
        ...(age   && { age: parseInt(age) }),
        ...(gender && { gender }),
        ...(phone  && { phone }),
        ...(email  !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(bloodGroup !== undefined && { bloodGroup }),
        ...(allergies !== undefined && { allergies: Array.isArray(allergies) ? allergies : [] }),
        ...(chronicConditions !== undefined && { chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [] }),
      },
    });

    return successResponse(res, patient, 'Patient updated successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to update patient', 500);
  }
}

// ── Soft delete patient ───────────────────────────────────
async function deletePatient(req, res) {
  try {
    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Patient not found', 404);

    await prisma.patient.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    return successResponse(res, null, 'Patient removed');
  } catch (err) {
    return errorResponse(res, 'Failed to delete patient', 500);
  }
}

// ── Add vital record ──────────────────────────────────────
async function addVitalRecord(req, res) {
  try {
    const { bp, sugar, weight, temp, spo2, pulse, notes } = req.body;

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!patient) return errorResponse(res, 'Patient not found', 404);

    const vital = await prisma.vitalRecord.create({
      data: { patientId: req.params.id, bp, sugar, weight, temp, spo2, pulse, notes },
    });

    return successResponse(res, vital, 'Vital record added', 201);
  } catch (err) {
    return errorResponse(res, 'Failed to add vital record', 500);
  }
}

// ── Search patients (quick search for prescription) ───────
async function searchPatients(req, res) {
  try {
    const { q = '' } = req.query;

    // If empty query → return recent 15 patients (for show-on-focus)
    const where = { clinicId: req.clinicId, isActive: true };
    if (q && q.length >= 1) {
      where.OR = [
        { name:        { contains: q, mode: 'insensitive' } },
        { phone:       { contains: q } },
        { patientCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, patientCode: true, name: true,
        age: true, gender: true, phone: true,
        allergies: true, chronicConditions: true,
      },
    });

    return successResponse(res, patients);
  } catch (err) {
    return errorResponse(res, 'Search failed', 500);
  }
}

module.exports = {
  getPatients, getPatient, createPatient,
  updatePatient, deletePatient, addVitalRecord, searchPatients,
};
