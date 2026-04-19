const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

// ── Generate Rx Number ────────────────────────────────────
async function generateRxNo(clinicId, doctorId) {
  const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true } });
  const count = await prisma.prescription.count({ where: { clinicId } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, '0');
  return `RX/${year}/${seq}`;
}

// ── Calculate quantity from dosage + days ─────────────────
function calcQty(dosageCode, days) {
  if (!dosageCode || !days) return null;
  const dosageMap = {
    '1-0-0': 1, '0-1-0': 1, '0-0-1': 1,
    '1-0-1': 2, '1-1-0': 2, '0-1-1': 2,
    '1-1-1': 3, '1-1-1-1': 4,
    'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'HS': 1,
  };
  const times = dosageMap[dosageCode];
  if (!times) return null;
  return times * parseInt(days);
}

// ── Get all prescriptions ─────────────────────────────────
async function getPrescriptions(req, res) {
  try {
    const { page = 1, limit = 20, patientId, doctorId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { clinicId: req.clinicId };
    if (patientId) where.patientId = patientId;
    if (doctorId)  where.doctorId  = doctorId;
    if (search) {
      where.OR = [
        { rxNo:    { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { date: 'desc' },
        include: {
          patient: { select: { id: true, patientCode: true, name: true, age: true, gender: true } },
          doctor:  { select: { id: true, name: true } },
          medicines: { select: { medicineName: true }, take: 3 },
        },
      }),
      prisma.prescription.count({ where }),
    ]);

    return paginatedResponse(res, prescriptions, total, page, limit);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch prescriptions', 500);
  }
}

// ── Get single prescription ───────────────────────────────
async function getPrescription(req, res) {
  try {
    const rx = await prisma.prescription.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        patient: true,
        doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true } },
        medicines: { orderBy: { sortOrder: 'asc' } },
        labTests:  true,
      },
    });
    if (!rx) return errorResponse(res, 'Prescription not found', 404);
    return successResponse(res, rx);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch prescription', 500);
  }
}

// ── Create prescription ───────────────────────────────────
async function createPrescription(req, res) {
  try {
    const {
      patientId, complaint, diagnosis, advice,
      nextVisit, templateUsed, printLang,
      medicines: rxMeds = [],
      labTests:  rxTests = [],
      customRxNo,
    } = req.body;

    const doctorId = req.user.id;

    // Validate patient
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
    if (!patient) return errorResponse(res, 'Patient not found', 404);

    const rxNo = customRxNo || await generateRxNo(req.clinicId, doctorId);

    // Check rxNo unique
    const existing = await prisma.prescription.findFirst({ where: { clinicId: req.clinicId, rxNo } });
    if (existing) return errorResponse(res, `Prescription number ${rxNo} already exists`, 409);

    const prescription = await prisma.$transaction(async (tx) => {
      // Create prescription
      const rx = await tx.prescription.create({
        data: {
          clinicId: req.clinicId,
          rxNo,
          doctorId,
          patientId,
          complaint,
          diagnosis,
          advice,
          nextVisit: nextVisit ? new Date(nextVisit) : null,
          templateUsed,
          printLang: printLang || 'en',
        },
      });

      // Add medicines
      if (rxMeds.length > 0) {
        // Auto-create medicines that don't exist in master yet
        const processedMeds = await Promise.all(rxMeds.map(async (m, idx) => {
          let medicineId   = m.medicineId || null
          let medicineName = m.medicineName || ''
          let medicineType = m.medicineType || 'tablet'

          // If medicineId provided, verify it exists
          if (medicineId) {
            const med = await tx.medicine.findFirst({ where: { id: medicineId, clinicId: req.clinicId } })
            if (!med) medicineId = null  // invalid id - treat as custom
            else { medicineName = med.name; medicineType = med.type }
          }

          // If no valid medicineId but name exists, auto-save to master
          if (!medicineId && medicineName) {
            const existing = await tx.medicine.findFirst({
              where: { clinicId: req.clinicId, name: { equals: medicineName, mode: 'insensitive' } }
            })
            if (existing) {
              medicineId   = existing.id
              medicineType = existing.type
            } else {
              const newMed = await tx.medicine.create({
                data: { clinicId: req.clinicId, name: medicineName, type: medicineType }
              })
              medicineId = newMed.id
            }
          }

          if (!medicineName) return null  // skip empty rows

          const qty = m.qty ?? calcQty(m.dosage, m.days)
          return {
            prescriptionId: rx.id,
            medicineId,
            medicineName,
            medicineType,
            dosage:   m.dosage  || null,
            days:     m.days    ? parseInt(m.days) : null,
            timing:   m.timing  || null,
            qty:      qty !== null && qty !== '' ? parseInt(qty) : null,
            notesEn:  m.notesEn || null,
            notesHi:  m.notesHi || null,
            notesMr:  m.notesMr || null,
            sortOrder: idx,
          }
        }))

        const validMeds = processedMeds.filter(Boolean)
        if (validMeds.length > 0) {
          await tx.prescriptionMedicine.createMany({ data: validMeds })
          // Increment usage for known medicines
          for (const med of validMeds) {
            if (med.medicineId) {
              await tx.medicine.updateMany({
                where: { id: med.medicineId, clinicId: req.clinicId },
                data: { usageCount: { increment: 1 } },
              })
            }
          }
        }
      }

      // Add lab tests — only include those with valid labTestId
      if (rxTests.length > 0) {
        const validTests = rxTests.filter(t => t.labTestId && t.labTestId !== 'undefined');
        // Deduplicate by labTestId
        const uniqueTests = validTests.filter((t, i, arr) => arr.findIndex(x => x.labTestId === t.labTestId) === i);
        if (uniqueTests.length > 0) {
          const testData = await Promise.all(uniqueTests.map(async (t) => {
            const test = await tx.labTest.findFirst({ where: { id: t.labTestId, clinicId: req.clinicId } });
            if (!test) return null;
            await tx.labTest.update({ where: { id: t.labTestId }, data: { usageCount: { increment: 1 } } });
            return {
              prescriptionId: rx.id,
              labTestId:   t.labTestId,
              labTestName: test.name || t.labTestName || '',
              referredTo:  t.referredTo || null,
            };
          }));
          const cleanTests = testData.filter(Boolean);
          if (cleanTests.length > 0) {
            await tx.prescriptionLabTest.createMany({ data: cleanTests });
          }
        }
      }

      return tx.prescription.findUnique({
        where: { id: rx.id },
        include: {
          patient:  true,
          doctor:   { select: { id: true, name: true, qualification: true, specialization: true, regNo: true } },
          medicines: { orderBy: { sortOrder: 'asc' } },
          labTests:  true,
        },
      });
    });

    return successResponse(res, prescription, 'Prescription created successfully', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to create prescription', 500);
  }
}

// ── Update prescription ───────────────────────────────────
async function updatePrescription(req, res) {
  try {
    const existing = await prisma.prescription.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Prescription not found', 404);

    const { complaint, diagnosis, advice, nextVisit, printLang, medicines: rxMeds, labTests: rxTests } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.prescription.update({
        where: { id: req.params.id },
        data: {
          ...(complaint  !== undefined && { complaint }),
          ...(diagnosis  !== undefined && { diagnosis }),
          ...(advice     !== undefined && { advice }),
          ...(nextVisit  !== undefined && { nextVisit: nextVisit ? new Date(nextVisit) : null }),
          ...(printLang  !== undefined && { printLang }),
        },
      });

      // Replace medicines if provided
      if (rxMeds !== undefined) {
        await tx.prescriptionMedicine.deleteMany({ where: { prescriptionId: req.params.id } });
        if (rxMeds.length > 0) {
          const processedMeds = await Promise.all(rxMeds.map(async (m, idx) => {
            let medicineId   = m.medicineId || null
            let medicineName = m.medicineName || ''
            let medicineType = m.medicineType || 'tablet'

            if (!medicineName) return null  // skip blank rows

            // Verify or resolve medicineId
            if (medicineId) {
              const med = await tx.medicine.findFirst({ where: { id: medicineId, clinicId: req.clinicId } })
              if (!med) medicineId = null
              else { medicineName = med.name; medicineType = med.type }
            }

            // Auto-create if typed without selecting
            if (!medicineId && medicineName) {
              const existing = await tx.medicine.findFirst({
                where: { clinicId: req.clinicId, name: { equals: medicineName, mode: 'insensitive' } }
              })
              if (existing) { medicineId = existing.id; medicineType = existing.type }
              else {
                const newMed = await tx.medicine.create({
                  data: { clinicId: req.clinicId, name: medicineName, type: medicineType }
                })
                medicineId = newMed.id
              }
            }

            const qty = m.qty ?? calcQty(m.dosage, m.days)
            return {
              prescriptionId: req.params.id,
              medicineId,
              medicineName,
              medicineType,
              dosage:   m.dosage  || null,
              days:     m.days    ? parseInt(m.days) : null,
              timing:   m.timing  || null,
              qty:      qty !== null && qty !== '' ? parseInt(qty) : null,
              notesEn:  m.notesEn || null,
              notesHi:  m.notesHi || null,
              notesMr:  m.notesMr || null,
              sortOrder: idx,
            }
          }))
          const validMeds = processedMeds.filter(Boolean)
          if (validMeds.length > 0) {
            await tx.prescriptionMedicine.createMany({ data: validMeds })
          }
        }
      }

      // Replace lab tests if provided
      if (rxTests !== undefined) {
        await tx.prescriptionLabTest.deleteMany({ where: { prescriptionId: req.params.id } });
        if (rxTests.length > 0) {
          await tx.prescriptionLabTest.createMany({
            data: rxTests.map(t => ({
              prescriptionId: req.params.id,
              labTestId:   t.labTestId,
              labTestName: t.labTestName || '',
              referredTo:  t.referredTo || null,
            })),
          });
        }
      }

      return tx.prescription.findUnique({
        where: { id: req.params.id },
        include: {
          patient:  true,
          doctor:   { select: { id: true, name: true, qualification: true, specialization: true, regNo: true } },
          medicines: { orderBy: { sortOrder: 'asc' } },
          labTests:  true,
        },
      });
    });

    return successResponse(res, updated, 'Prescription updated');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to update prescription', 500);
  }
}

// ── Get patient's prescription history ───────────────────
async function getPatientPrescriptions(req, res) {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: req.params.patientId, clinicId: req.clinicId },
      orderBy: { date: 'desc' },
      include: {
        doctor:   { select: { name: true } },
        medicines: { orderBy: { sortOrder: 'asc' } },
        labTests:  true,
      },
    });
    return successResponse(res, prescriptions);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch history', 500);
  }
}

// ── Get last prescription (carry forward) ────────────────
async function getLastPrescription(req, res) {
  try {
    const last = await prisma.prescription.findFirst({
      where: { patientId: req.params.patientId, clinicId: req.clinicId },
      orderBy: { date: 'desc' },
      include: {
        medicines: { orderBy: { sortOrder: 'asc' } },
        labTests:  true,
      },
    });
    return successResponse(res, last);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch last prescription', 500);
  }
}

// ── Calculate quantity helper (API) ──────────────────────
async function calculateQty(req, res) {
  try {
    const { dosage, days } = req.body;
    const qty = calcQty(dosage, days);
    return successResponse(res, { qty });
  } catch (err) {
    return errorResponse(res, 'Calculation failed', 500);
  }
}

module.exports = {
  getPrescriptions, getPrescription, createPrescription,
  updatePrescription, getPatientPrescriptions,
  getLastPrescription, calculateQty,
};
