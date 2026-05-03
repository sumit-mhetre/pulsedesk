const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');
const { doctorPrivacyWhere, getClinicSharingFlags } = require('../lib/dataPrivacy');

// ── Generate Rx Number ────────────────────────────────────
async function generateRxNo(clinicId, doctorId) {
  const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true } });
  const count = await prisma.prescription.count({ where: { clinicId } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, '0');
  return `RX/${year}/${seq}`;
}

// ── Calculate quantity from dosage + days + frequency ─────
// days can be: "7 days" | "2 weeks" | "1 month" | "1 year" | bare number
// frequency: DAILY | ALT_DAYS | EVERY_3D | WEEKLY | SOS
function calcQty(dosageCode, days, frequency = 'DAILY') {
  if (!dosageCode || !days) return null;
  if (frequency === 'SOS') return null;  // As-needed — doctor fills manually
  const dosageMap = {
    '1-0-0': 1, '0-1-0': 1, '0-0-1': 1,
    '1-0-1': 2, '1-1-0': 2, '0-1-1': 2,
    '1-1-1': 3, '1-1-1-1': 4,
    'OD': 1, 'BD': 2, 'TDS': 3, 'QID': 4, 'HS': 1,
  };
  const freqDiv = { DAILY: 1, ALT_DAYS: 2, EVERY_3D: 3, WEEKLY: 7 };
  const times = dosageMap[dosageCode];
  if (!times) return null;
  const daysStr = String(days).toLowerCase();
  const n = parseInt(daysStr.match(/\d+/)?.[0]);
  if (!n) return null;
  const multiplier = daysStr.includes('week')  ? 7
                   : daysStr.includes('month') ? 30
                   : daysStr.includes('year')  ? 365 : 1;
  const totalDays = n * multiplier;
  const divisor = freqDiv[frequency] || 1;
  // Ceil so the patient never runs short of medication
  return times * Math.ceil(totalDays / divisor);
}

// ── Get all prescriptions ─────────────────────────────────
async function getPrescriptions(req, res) {
  try {
    const { page = 1, limit = 20, patientId, doctorId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const flags = await getClinicSharingFlags(req);
    const privacy = doctorPrivacyWhere(req, flags.sharePrescriptions, { allowNull: false });
    const where = { clinicId: req.clinicId };
    if (patientId) where.patientId = patientId;
    if (doctorId)  where.doctorId  = doctorId;

    // Merge privacy filter into where. When `search` is also active, both
    // clauses go under AND so neither overrides the other (Prisma's top-level
    // OR would otherwise replace any earlier OR).
    if (search) {
      const andClauses = [];
      // Only add privacy clause if it's non-empty (admin/receptionist pass {})
      if (Object.keys(privacy).length > 0) andClauses.push(privacy);
      andClauses.push({
        OR: [
          { rxNo:    { contains: search, mode: 'insensitive' } },
          { patient: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
      where.AND = andClauses;
    } else {
      Object.assign(where, privacy);
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
    const flags = await getClinicSharingFlags(req);
    const rx = await prisma.prescription.findFirst({
      where: {
        id: req.params.id,
        clinicId: req.clinicId,
        ...doctorPrivacyWhere(req, flags.sharePrescriptions, { allowNull: false }),
      },
      include: {
        patient: true,
        doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
        medicines: { orderBy: { sortOrder: 'asc' } },
        labTests:  true,
        // Include recorded lab results so the print page can render the test outcomes
        // table. Sorted DESC so newest dates appear in the leftmost column on print.
        labResults: { include: { values: true }, orderBy: { resultDate: 'desc' } },
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
      customData,   // { fieldId: stringValue, ... } — custom fields added by the clinic
      vitals,       // snapshot of vitals taken at write-time — { systolicBP, diastolicBP, sugar, ... }
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
          customData: customData && typeof customData === 'object' ? customData : null,
          // Persist a snapshot only if the doctor actually entered values. We strip
          // empty/null fields so a later toggle-off-then-toggle-on of vitals doesn't
          // resurrect blanks. If nothing meaningful was recorded, store NULL.
          vitals: (() => {
            if (!vitals || typeof vitals !== 'object') return null
            const cleaned = {}
            for (const [k, v] of Object.entries(vitals)) {
              if (v === null || v === undefined) continue
              const s = String(v).trim()
              if (s === '') continue
              cleaned[k] = s
            }
            return Object.keys(cleaned).length > 0 ? cleaned : null
          })(),
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

          // Snapshot generic name: prefer what client sent; fall back to current master value
          let genericName = m.genericName || null
          if (!genericName && medicineId) {
            const med = await tx.medicine.findUnique({ where: { id: medicineId }, select: { genericName: true } })
            genericName = med?.genericName || null
          }

          const qty = m.qty ?? calcQty(m.dosage, m.days, m.frequency)
          return {
            prescriptionId: rx.id,
            medicineId,
            medicineName,
            genericName,
            medicineType,
            dosage:   m.dosage  || null,
            days:     m.days    || null,
            timing:   m.timing  || null,
            frequency: m.frequency || 'DAILY',
            qty:      qty !== null && qty !== '' ? String(qty) : null,
            notesEn:  m.notesEn || null,
            notesHi:  m.notesHi || null,
            notesMr:  m.notesMr || null,
            sortOrder: idx,
          }
        }))

        const validMeds = processedMeds.filter(Boolean)
        if (validMeds.length > 0) {
          await tx.prescriptionMedicine.createMany({ data: validMeds })
          // Increment usage + save doctor's medicine preferences
          for (const med of validMeds) {
            if (med.medicineId) {
              await tx.medicine.updateMany({
                where: { id: med.medicineId, clinicId: req.clinicId },
                data: { usageCount: { increment: 1 } },
              })
              // Save per-doctor preference (dosage/timing/days/frequency/notes used last time) — non-blocking
              if (med.dosage || med.timing || med.days || med.frequency || med.notesEn) {
                prisma.doctorMedicinePreference.upsert({
                  where: { clinicId_doctorId_medicineId: { clinicId: req.clinicId, doctorId, medicineId: med.medicineId } },
                  create: { clinicId: req.clinicId, doctorId, medicineId: med.medicineId, dosage: med.dosage||null, timing: med.timing||null, days: med.days||null, frequency: med.frequency||null, notesEn: med.notesEn||null, notesHi: med.notesHi||null, notesMr: med.notesMr||null },
                  update: { dosage: med.dosage||null, timing: med.timing||null, days: med.days||null, frequency: med.frequency||null, notesEn: med.notesEn||null, notesHi: med.notesHi||null, notesMr: med.notesMr||null, usageCount: { increment: 1 } },
                }).catch((e)=>{ console.error('[pref upsert failed]', e?.message) })
              }
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
          doctor:   { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
          medicines: { orderBy: { sortOrder: 'asc' } },
          labTests:  true,
        },
      });
    });

    // Successful save → clean up any matching draft so it doesn't reappear
    prisma.prescriptionDraft.deleteMany({
      where: { doctorId: req.user.id, patientId },
    }).catch(() => {});

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

    const { complaint, diagnosis, advice, nextVisit, printLang, medicines: rxMeds, labTests: rxTests, customData, vitals } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.prescription.update({
        where: { id: req.params.id },
        data: {
          ...(complaint  !== undefined && { complaint }),
          ...(diagnosis  !== undefined && { diagnosis }),
          ...(advice     !== undefined && { advice }),
          ...(nextVisit  !== undefined && { nextVisit: nextVisit ? new Date(nextVisit) : null }),
          ...(printLang  !== undefined && { printLang }),
          ...(customData !== undefined && { customData: customData && typeof customData === 'object' ? customData : null }),
          ...(vitals !== undefined && {
            vitals: (() => {
              if (!vitals || typeof vitals !== 'object') return null
              const cleaned = {}
              for (const [k, v] of Object.entries(vitals)) {
                if (v === null || v === undefined) continue
                const s = String(v).trim()
                if (s === '') continue
                cleaned[k] = s
              }
              return Object.keys(cleaned).length > 0 ? cleaned : null
            })(),
          }),
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

            // Snapshot generic name: prefer client-sent, fall back to master
            let genericName = m.genericName || null
            if (!genericName && medicineId) {
              const med = await tx.medicine.findUnique({ where: { id: medicineId }, select: { genericName: true } })
              genericName = med?.genericName || null
            }

            const qty = m.qty ?? calcQty(m.dosage, m.days, m.frequency)
            return {
              prescriptionId: req.params.id,
              medicineId,
              medicineName,
              genericName,
              medicineType,
              dosage:   m.dosage  || null,
              days:     m.days    || null,
              timing:   m.timing  || null,
              frequency: m.frequency || 'DAILY',
              qty:      qty !== null && qty !== '' ? String(qty) : null,
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
          doctor:   { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
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
    const flags = await getClinicSharingFlags(req);
    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId: req.params.patientId,
        clinicId: req.clinicId,
        ...doctorPrivacyWhere(req, flags.sharePrescriptions, { allowNull: false }),
      },
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
    const flags = await getClinicSharingFlags(req);
    const last = await prisma.prescription.findFirst({
      where: {
        patientId: req.params.patientId,
        clinicId: req.clinicId,
        ...doctorPrivacyWhere(req, flags.sharePrescriptions, { allowNull: false }),
      },
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
    const { dosage, days, frequency } = req.body;
    const qty = calcQty(dosage, days, frequency);
    return successResponse(res, { qty });
  } catch (err) {
    return errorResponse(res, 'Calculation failed', 500);
  }
}

// ── Get doctor's medicine preferences ────────────────────
async function getDoctorPreferences(req, res) {
  try {
    const prefs = await prisma.doctorMedicinePreference.findMany({
      where: { clinicId: req.clinicId, doctorId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    })
    // Return as map: { medicineId: { dosage, timing, days, frequency, notesEn, updatedAt } }
    const map = {}
    prefs.forEach(p => {
      map[p.medicineId] = {
        dosage:    p.dosage,
        timing:    p.timing,
        days:      p.days,
        frequency: p.frequency,
        notesEn:   p.notesEn,
        notesHi:   p.notesHi,
        notesMr:   p.notesMr,
        updatedAt: p.updatedAt,
      }
    })
    return successResponse(res, map)
  } catch (err) {
    return successResponse(res, {}) // non-critical, return empty on error
  }
}

// ═══════════════════════════════════════════════════════════
//  DRAFTS — autosave snapshots
// ═══════════════════════════════════════════════════════════

// Upsert draft for (doctor, patient).
// Body: { patientId, formState }
async function upsertDraft(req, res) {
  try {
    const { patientId, formState } = req.body || {}
    if (!patientId) return errorResponse(res, 'patientId is required', 400)
    if (!formState || typeof formState !== 'object') {
      return errorResponse(res, 'formState must be an object', 400)
    }

    // Safety: cap JSON payload to ~500KB
    const approxSize = JSON.stringify(formState).length
    if (approxSize > 512000) {
      return errorResponse(res, 'Draft too large to save', 413)
    }

    // Verify patient belongs to this clinic
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId },
      select: { id: true },
    })
    if (!patient) return errorResponse(res, 'Patient not found', 404)

    const doctorId = req.user.id

    const draft = await prisma.prescriptionDraft.upsert({
      where: { doctorId_patientId: { doctorId, patientId } },
      create: {
        clinicId: req.clinicId,
        doctorId, patientId,
        formState,
        version: 1,
      },
      update: {
        formState,
        version: { increment: 1 },
      },
      select: { id: true, updatedAt: true, version: true },
    })

    return successResponse(res, draft)
  } catch (err) {
    console.error('[upsertDraft]', err)
    return errorResponse(res, 'Failed to save draft', 500)
  }
}

// Return draft for this doctor + patient, IF exists & updated within last 24h
async function getDraftForPatient(req, res) {
  try {
    const { patientId } = req.params
    if (!patientId) return errorResponse(res, 'patientId required', 400)

    const draft = await prisma.prescriptionDraft.findUnique({
      where: { doctorId_patientId: { doctorId: req.user.id, patientId } },
    })

    if (!draft) return successResponse(res, null)

    // Expire if older than 24h (don't resurrect stale drafts)
    const ageMs = Date.now() - new Date(draft.updatedAt).getTime()
    if (ageMs > 24 * 60 * 60 * 1000) {
      // Delete stale; best-effort
      prisma.prescriptionDraft.delete({ where: { id: draft.id } }).catch(() => {})
      return successResponse(res, null)
    }

    return successResponse(res, draft)
  } catch (err) {
    console.error('[getDraftForPatient]', err)
    return errorResponse(res, 'Failed to fetch draft', 500)
  }
}

// Discard a draft
async function deleteDraft(req, res) {
  try {
    const { id } = req.params
    const draft = await prisma.prescriptionDraft.findUnique({ where: { id } })
    if (!draft) return successResponse(res, null, 'Already deleted')
    if (draft.doctorId !== req.user.id) {
      return errorResponse(res, 'Not allowed to delete this draft', 403)
    }
    await prisma.prescriptionDraft.delete({ where: { id } })
    return successResponse(res, null, 'Draft discarded')
  } catch (err) {
    console.error('[deleteDraft]', err)
    return errorResponse(res, 'Failed to discard draft', 500)
  }
}

// List current doctor's drafts (for UI indicator / resume menu)
async function listMyDrafts(req, res) {
  try {
    const drafts = await prisma.prescriptionDraft.findMany({
      where: { doctorId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true, patientId: true, updatedAt: true, createdAt: true, version: true,
      },
    })

    if (!drafts.length) return successResponse(res, [])

    // Enrich with patient names
    const patientIds = drafts.map(d => d.patientId)
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, name: true, patientCode: true },
    })
    const patientMap = Object.fromEntries(patients.map(p => [p.id, p]))

    return successResponse(res, drafts.map(d => ({
      ...d,
      patient: patientMap[d.patientId] || null,
    })))
  } catch (err) {
    console.error('[listMyDrafts]', err)
    return errorResponse(res, 'Failed to list drafts', 500)
  }
}

module.exports = {
  getPrescriptions, getPrescription, createPrescription,
  updatePrescription, getPatientPrescriptions,
  getLastPrescription, calculateQty, getDoctorPreferences,
  // drafts
  upsertDraft, getDraftForPatient, deleteDraft, listMyDrafts,
};
