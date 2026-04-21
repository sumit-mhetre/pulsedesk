const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

// ── Generate unique patient code ──────────────────────────
async function generatePatientCode(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, opdSeriesPrefix: true }
  });
  // Use custom prefix if set, else derive from clinic name
  let prefix = clinic.opdSeriesPrefix?.trim() || '';
  if (!prefix) {
    prefix = clinic.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'PAT';
  }
  // Extract numeric part if prefix already has numbers (e.g. MH1000)
  const numMatch = prefix.match(/^([a-zA-Z]+)(\d+)$/);
  if (numMatch) {
    // prefix like MH1000 — use as starting counter
    const letters = numMatch[1];
    const startNum = parseInt(numMatch[2]);
    const count = await prisma.patient.count({ where: { clinicId } });
    return `${letters}${startNum + count}`;
  }
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
      prefix, name, age, dob, gender, phone, email, address,
      bloodGroup, allergies, chronicConditions, existingId,
    } = req.body;

    if (!name) return errorResponse(res, 'Name is required', 400);
    if (!phone) return errorResponse(res, 'Phone is required', 400);

    // Warn (not block) if duplicate phone — return existing patient info as warning
    const duplicate = await prisma.patient.findFirst({
      where: { clinicId: req.clinicId, phone, isActive: true },
      select: { patientCode: true, name: true, id: true },
    });

    const patientCode = await generatePatientCode(req.clinicId);
    const fullName = prefix ? `${prefix} ${name}` : name;

    // Calculate age from DOB if age not provided
    let finalAge = age ? parseInt(age) : null;
    if (!finalAge && dob) {
      const today = new Date();
      const birth = new Date(dob);
      finalAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) finalAge--;
    }

    const patient = await prisma.patient.create({
      data: {
        clinicId: req.clinicId,
        patientCode,
        prefix:   prefix || null,
        name:     fullName,
        age:      finalAge || 0,
        dob:      dob ? new Date(dob) : null,
        gender,
        phone,
        email:    email || null,
        address:  address || null,
        bloodGroup: bloodGroup || null,
        existingId: existingId || null,
        allergies:         Array.isArray(allergies) ? allergies : [],
        chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [],
      },
    });

    return successResponse(res, {
      ...patient,
      warning: duplicate ? `Note: Phone ${phone} also used by ${duplicate.patientCode} — ${duplicate.name}` : null,
    }, 'Patient registered successfully', 201);
  } catch (err) {
    console.error(err);
    console.error('Create patient error:', err.message);
    return errorResponse(res, err.message || 'Failed to create patient', 500);
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
      prefix, name, age, dob, gender, phone, email, address,
      bloodGroup, allergies, chronicConditions, existingId,
    } = req.body;

    const fullName = prefix ? `${prefix} ${name?.replace(/^(Mr|Mrs|Ms|Dr|Baby|Master|Miss)\s+/i,'')}` : name;

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: {
        ...(name      && { name: fullName }),
        ...(prefix    !== undefined && { prefix }),
        ...(age       !== undefined && { age: age ? parseInt(age) : null }),
        ...(dob       !== undefined && { dob: dob ? new Date(dob) : null }),
        ...(gender    && { gender }),
        ...(phone     && { phone }),
        ...(email     !== undefined && { email }),
        ...(address   !== undefined && { address }),
        ...(bloodGroup !== undefined && { bloodGroup }),
        ...(existingId !== undefined && { existingId }),
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

// ── Get next patient code preview ────────────────────────
async function getNextCode(req, res) {
  try {
    const nextCode = await generatePatientCode(req.clinicId);
    return successResponse(res, { nextCode });
  } catch (err) {
    return errorResponse(res, 'Failed to get next code', 500);
  }
}

module.exports = {
  getPatients, getPatient, createPatient,
  updatePatient, deletePatient, addVitalRecord, searchPatients,
};
