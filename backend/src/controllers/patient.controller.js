const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');
const { logAudit } = require('../lib/audit');

// ── Normalize a custom patient code (uppercase, alphanumeric only, max 20) ──
// Returns null when input is empty/invalid so caller can fall back to auto-gen.
function normalizeCustomCode(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  return cleaned || null;
}

// ── Generate unique patient code ──────────────────────────
// Behaviour:
//   prefix = "MH"      -> MH1, MH2, MH3, ... (no padding)
//   prefix = "MH03"    -> starts at MH3, then MH4, MH5, ...
//   prefix = "MH15"    -> starts at MH15, then MH16, MH17, ...
//   prefix empty       -> derive 3-letter prefix from clinic name (SHA, etc), no padding
// We always look up the highest existing code with the same letter prefix in
// the clinic and return max + 1 (never below the typed starting number).
// This avoids the old "startNum + count" formula which produced confusing gaps.
async function generatePatientCode(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, opdSeriesPrefix: true },
  });

  // Resolve the prefix: use admin-configured value or derive from clinic name.
  let raw = clinic?.opdSeriesPrefix?.trim() || '';
  if (!raw) {
    raw = (clinic?.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'PAT';
  }

  // Split into the letter prefix and the (optional) numeric starting point.
  // "MH" -> letters=MH, startNum=1 (default)
  // "MH03" -> letters=MH, startNum=3 (parseInt strips the leading zero)
  // "MH100" -> letters=MH, startNum=100
  const m = raw.match(/^([a-zA-Z]+)(\d*)$/);
  const letters  = m ? m[1].toUpperCase() : raw.toUpperCase();
  const startNum = m && m[2] ? parseInt(m[2], 10) : 1;

  // Find the highest existing patient code for this clinic that uses the
  // same letter prefix. We escape the letters because they go straight into a
  // SQL LIKE pattern.
  const escapedLetters = letters.replace(/[%_\\]/g, m => '\\' + m);
  const rows = await prisma.$queryRaw`
    SELECT "patientCode" FROM patients
    WHERE "clinicId" = ${clinicId}
      AND "patientCode" LIKE ${escapedLetters + '%'} ESCAPE '\\'
  `;
  let maxNum = startNum - 1;
  for (const r of rows) {
    const tail = (r.patientCode || '').slice(letters.length);
    // Only consider codes whose tail is a pure number - skip variants like
    // "MH-OLD-12" if any exist.
    if (/^\d+$/.test(tail)) {
      const n = parseInt(tail, 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = Math.max(maxNum + 1, startNum);
  return `${letters}${next}`;
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
      customPatientCode,
    } = req.body;

    if (!name) return errorResponse(res, 'Name is required', 400);
    if (!phone) return errorResponse(res, 'Phone is required', 400);

    // Warn (not block) if duplicate phone — return existing patient info as warning
    const duplicate = await prisma.patient.findFirst({
      where: { clinicId: req.clinicId, phone, isActive: true },
      select: { patientCode: true, name: true, id: true },
    });

    // Use the custom code if the user provided one, else auto-generate.
    // The unique (clinicId, patientCode) constraint catches collisions either way.
    const customCode = normalizeCustomCode(customPatientCode);
    const patientCode = customCode || await generatePatientCode(req.clinicId);
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

    let patient;
    try {
      patient = await prisma.patient.create({
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
    } catch (err) {
      // Prisma P2002 = unique constraint failed. Friendlier message than generic 500.
      if (err?.code === 'P2002') {
        return errorResponse(res, `Patient code "${patientCode}" is already in use. Please choose a different code.`, 409);
      }
      throw err;
    }

    return successResponse(res, {
      ...patient,
      warning: duplicate ? `Note: Phone ${phone} also used by ${duplicate.patientCode} - ${duplicate.name}` : null,
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
      customPatientCode,
    } = req.body;

    const fullName = prefix ? `${prefix} ${name?.replace(/^(Mr|Mrs|Ms|Dr|Baby|Master|Miss)\s+/i,'')}` : name;

    // Detect a patient-code change. Only triggered when the client sent
    // customPatientCode AND it normalizes to a value different from the
    // current one. Empty / null leaves the existing code untouched.
    const newCode = normalizeCustomCode(customPatientCode);
    const codeChanging = newCode && newCode !== existing.patientCode;

    let patient;
    try {
      patient = await prisma.patient.update({
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
          ...(codeChanging && { patientCode: newCode }),
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        return errorResponse(res, `Patient code "${newCode}" is already in use. Please choose a different code.`, 409);
      }
      throw err;
    }

    // Audit-log code changes so we always know what the code used to be.
    // Old printed Rx / bills still show the previous code; this trail explains why.
    if (codeChanging) {
      await logAudit(req, {
        clinicId: req.clinicId,
        action:   'PATIENT_CODE_CHANGED',
        entity:   'Patient',
        entityId: patient.id,
        details:  { from: existing.patientCode, to: newCode, name: existing.name },
      });
    }

    return successResponse(res, patient, 'Patient updated successfully');
  } catch (err) {
    console.error('Update patient error:', err?.message);
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
  updatePatient, deletePatient, addVitalRecord, searchPatients, getNextCode,
};
