const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

function masterController(model, uniqueField = 'nameEn') {
  const getAll = async (req, res) => {
    try {
      const { search = '', includeInactive = false } = req.query;
      const where = { clinicId: req.clinicId };
      if (!includeInactive) where.isActive = true;
      if (search) where[uniqueField] = { contains: search, mode: 'insensitive' };
      const items = await prisma[model].findMany({
        where,
        orderBy: [{ usageCount: 'desc' }, { [uniqueField]: 'asc' }],
      });
      return successResponse(res, items);
    } catch (err) {
      console.error(err);
      return errorResponse(res, `Failed to fetch ${model}`, 500);
    }
  };

  const create = async (req, res) => {
    try {
      const data = { clinicId: req.clinicId, ...req.body };
      const existing = await prisma[model].findFirst({
        where: { clinicId: req.clinicId, [uniqueField]: { equals: req.body[uniqueField], mode: 'insensitive' } },
      });
      if (existing) {
        if (!existing.isActive) {
          const updated = await prisma[model].update({ where: { id: existing.id }, data: { isActive: true, ...req.body } });
          return successResponse(res, updated, 'Item restored', 200);
        }
        return errorResponse(res, `${req.body[uniqueField]} already exists`, 409);
      }
      const item = await prisma[model].create({ data });
      return successResponse(res, item, 'Created successfully', 201);
    } catch (err) {
      console.error(err);
      return errorResponse(res, `Failed to create ${model}`, 500);
    }
  };

  const update = async (req, res) => {
    try {
      const existing = await prisma[model].findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
      if (!existing) return errorResponse(res, 'Not found', 404);
      const item = await prisma[model].update({ where: { id: req.params.id }, data: req.body });
      return successResponse(res, item, 'Updated successfully');
    } catch (err) {
      return errorResponse(res, `Failed to update ${model}`, 500);
    }
  };

  const remove = async (req, res) => {
    try {
      const existing = await prisma[model].findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
      if (!existing) return errorResponse(res, 'Not found', 404);
      await prisma[model].update({ where: { id: req.params.id }, data: { isActive: false } });
      return successResponse(res, null, 'Removed successfully');
    } catch (err) {
      return errorResponse(res, `Failed to remove ${model}`, 500);
    }
  };

  return { getAll, create, update, remove };
}

// ── Medicine controller ───────────────────────────────────
const medicineCtrl = {
  getAll: async (req, res) => {
    try {
      const { search = '', type, includeInactive } = req.query;
      const where = { clinicId: req.clinicId };
      if (!includeInactive) where.isActive = true;
      if (type)   where.type = type;
      if (search) where.name = { contains: search, mode: 'insensitive' };
      const medicines = await prisma.medicine.findMany({
        where,
        orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      });
      return successResponse(res, medicines);
    } catch (err) {
      return errorResponse(res, 'Failed to fetch medicines', 500);
    }
  },

  create: async (req, res) => {
    try {
      const { name, type, category, genericName, defaultDosage, defaultDays, defaultTiming, notesEn, notesHi, notesMr } = req.body;
      const existing = await prisma.medicine.findFirst({
        where: { clinicId: req.clinicId, name: { equals: name, mode: 'insensitive' } },
      });
      if (existing) {
        if (!existing.isActive) {
          const updated = await prisma.medicine.update({ where: { id: existing.id }, data: { isActive: true, ...req.body, defaultDays: defaultDays ? parseInt(defaultDays) : null } });
          return successResponse(res, updated, 'Medicine restored');
        }
        return errorResponse(res, `${name} already exists`, 409);
      }

      // Auto-detect type
      let detectedType = type || 'tablet';
      if (!type) {
        const n = name.toLowerCase();
        if (n.includes('syrup') || n.includes('suspension') || n.includes('liquid')) detectedType = 'liquid';
        else if (n.includes('drops') || n.includes('drop'))   detectedType = 'drops';
        else if (n.includes('cream') || n.includes('gel') || n.includes('ointment')) detectedType = 'cream';
        else if (n.includes('inhaler') || n.includes('puff')) detectedType = 'inhaler';
        else if (n.includes('injection') || n.includes('inj')) detectedType = 'injection';
        else if (n.includes('sachet') || n.includes('powder')) detectedType = 'sachet';
        else if (n.includes('capsule') || n.includes('cap'))   detectedType = 'capsule';
      }

      const medicine = await prisma.medicine.create({
        data: {
          clinicId: req.clinicId,
          name,
          genericName:    genericName?.trim() || null,
          type: detectedType,
          category:       category       || null,
          defaultDosage:  defaultDosage  || null,
          defaultDays:    defaultDays    ? parseInt(defaultDays) : null,
          defaultTiming:  defaultTiming  || null,
          notesEn:        notesEn        || null,
          notesHi:        notesHi        || null,
          notesMr:        notesMr        || null,
        },
      });
      return successResponse(res, medicine, 'Medicine created', 201);
    } catch (err) {
      console.error(err);
      return errorResponse(res, 'Failed to create medicine', 500);
    }
  },

  update: async (req, res) => {
    try {
      const existing = await prisma.medicine.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
      if (!existing) return errorResponse(res, 'Medicine not found', 404);
      const data = { ...req.body };
      if (data.defaultDays) data.defaultDays = parseInt(data.defaultDays);
      const medicine = await prisma.medicine.update({ where: { id: req.params.id }, data });
      return successResponse(res, medicine, 'Medicine updated');
    } catch (err) {
      return errorResponse(res, 'Failed to update medicine', 500);
    }
  },

  remove: async (req, res) => {
    try {
      const existing = await prisma.medicine.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
      if (!existing) return errorResponse(res, 'Medicine not found', 404);
      await prisma.medicine.update({ where: { id: req.params.id }, data: { isActive: false } });
      return successResponse(res, null, 'Medicine removed');
    } catch (err) {
      return errorResponse(res, 'Failed to remove medicine', 500);
    }
  },

  // Focused endpoint for inline generic-name edit from the prescription form.
  // Doctor/Admin only - enforced on the route via requireRoles middleware.
  setGeneric: async (req, res) => {
    try {
      const { genericName } = req.body;
      const existing = await prisma.medicine.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
      if (!existing) return errorResponse(res, 'Medicine not found', 404);
      const updated = await prisma.medicine.update({
        where: { id: req.params.id },
        data:  { genericName: genericName?.trim() || null },
      });
      return successResponse(res, updated, 'Generic name saved');
    } catch (err) {
      console.error('[setGeneric]', err?.message);
      return errorResponse(res, 'Failed to save generic name', 500);
    }
  },
};

// ── Billing items ─────────────────────────────────────────
const billingItemCtrl = {
  getAll: async (req, res) => {
    try {
      const { search = '' } = req.query;
      const where = { clinicId: req.clinicId, isActive: true };
      if (search) where.name = { contains: search, mode: 'insensitive' };
      const items = await prisma.billingItem.findMany({ where, orderBy: { category: 'asc' } });
      return successResponse(res, items);
    } catch { return errorResponse(res, 'Failed to fetch billing items', 500); }
  },
  create: async (req, res) => {
    try {
      const { name, defaultPrice, category } = req.body;
      const existing = await prisma.billingItem.findFirst({
        where: { clinicId: req.clinicId, name: { equals: name, mode: 'insensitive' } },
      });
      if (existing) {
        if (!existing.isActive) {
          const u = await prisma.billingItem.update({ where: { id: existing.id }, data: { isActive: true, defaultPrice: parseFloat(defaultPrice) || 0, category } });
          return successResponse(res, u, 'Billing item restored');
        }
        return errorResponse(res, `${name} already exists`, 409);
      }
      const item = await prisma.billingItem.create({
        data: { clinicId: req.clinicId, name, defaultPrice: parseFloat(defaultPrice) || 0, category },
      });
      return successResponse(res, item, 'Billing item created', 201);
    } catch { return errorResponse(res, 'Failed to create billing item', 500); }
  },
  update: async (req, res) => {
    try {
      const item = await prisma.billingItem.update({ where: { id: req.params.id }, data: req.body });
      return successResponse(res, item, 'Updated');
    } catch { return errorResponse(res, 'Failed to update', 500); }
  },
  remove: async (req, res) => {
    try {
      await prisma.billingItem.update({ where: { id: req.params.id }, data: { isActive: false } });
      return successResponse(res, null, 'Removed');
    } catch { return errorResponse(res, 'Failed to remove', 500); }
  },
};

// ── Dosage options ────────────────────────────────────────
const dosageCtrl = {
  getAll: async (req, res) => {
    try {
      const items = await prisma.dosageOption.findMany({ where: { clinicId: req.clinicId, isActive: true }, orderBy: { code: 'asc' } });
      return successResponse(res, items);
    } catch { return errorResponse(res, 'Failed', 500); }
  },
  create: async (req, res) => {
    try {
      const { code, label, timesPerDay } = req.body;
      const existing = await prisma.dosageOption.findFirst({ where: { clinicId: req.clinicId, code } });
      if (existing) return errorResponse(res, `${code} already exists`, 409);
      const item = await prisma.dosageOption.create({ data: { clinicId: req.clinicId, code, label, timesPerDay: timesPerDay ? parseInt(timesPerDay) : null } });
      return successResponse(res, item, 'Created', 201);
    } catch { return errorResponse(res, 'Failed', 500); }
  },
  remove: async (req, res) => {
    try {
      await prisma.dosageOption.update({ where: { id: req.params.id }, data: { isActive: false } });
      return successResponse(res, null, 'Removed');
    } catch { return errorResponse(res, 'Failed', 500); }
  },
};

// ── Timing options ────────────────────────────────────────
const timingCtrl = {
  getAll: async (req, res) => {
    try {
      const items = await prisma.timingOption.findMany({ where: { clinicId: req.clinicId, isActive: true }, orderBy: { code: 'asc' } });
      return successResponse(res, items);
    } catch { return errorResponse(res, 'Failed', 500); }
  },
  create: async (req, res) => {
    try {
      const { code, labelEn, labelHi, labelMr } = req.body;
      const existing = await prisma.timingOption.findFirst({ where: { clinicId: req.clinicId, code } });
      if (existing) return errorResponse(res, `${code} already exists`, 409);
      const item = await prisma.timingOption.create({ data: { clinicId: req.clinicId, code, labelEn, labelHi, labelMr } });
      return successResponse(res, item, 'Created', 201);
    } catch { return errorResponse(res, 'Failed', 500); }
  },
  remove: async (req, res) => {
    try {
      await prisma.timingOption.update({ where: { id: req.params.id }, data: { isActive: false } });
      return successResponse(res, null, 'Removed');
    } catch { return errorResponse(res, 'Failed', 500); }
  },
};

// ── Seed bulk ─────────────────────────────────────────────
// Regular flow: clinic admin/doctor with `loadDefaultMasterData` permission seeds their own clinic
//   (clinicId comes from req.clinicId via auth middleware).
// Super admin flow: super admin seeds any clinic (clinicId comes from req.params.clinicId via the
//   /clinics/:clinicId/seed-master-data route).
async function seedMasterData(req, res) {
  try {
    // Determine target clinic: super admin sets it via URL param, regular users use their own.
    const clinicId = (req.user?.role === 'SUPER_ADMIN' && req.params.clinicId)
      ? req.params.clinicId
      : req.clinicId;
    if (!clinicId) return errorResponse(res, 'Clinic context missing', 400);

    const { medicines, labTests, complaints, diagnoses, adviceOptions, billingItems } = req.body;
    const results = {};
    if (medicines?.length) {
      await prisma.medicine.createMany({ data: medicines.map(m => ({ clinicId, ...m, defaultDays: m.defaultDays ? parseInt(m.defaultDays) : null })), skipDuplicates: true });
      results.medicines = medicines.length;
    }
    if (labTests?.length) { await prisma.labTest.createMany({ data: labTests.map(t => ({ clinicId, ...t })), skipDuplicates: true }); results.labTests = labTests.length; }
    if (complaints?.length) { await prisma.complaint.createMany({ data: complaints.map(c => ({ clinicId, ...c })), skipDuplicates: true }); results.complaints = complaints.length; }
    if (diagnoses?.length) { await prisma.diagnosis.createMany({ data: diagnoses.map(d => ({ clinicId, ...d })), skipDuplicates: true }); results.diagnoses = diagnoses.length; }
    if (adviceOptions?.length) { await prisma.adviceOption.createMany({ data: adviceOptions.map(a => ({ clinicId, ...a })), skipDuplicates: true }); results.adviceOptions = adviceOptions.length; }
    if (billingItems?.length) { await prisma.billingItem.createMany({ data: billingItems.map(b => ({ clinicId, ...b })), skipDuplicates: true }); results.billingItems = billingItems.length; }
    return successResponse(res, results, 'Master data seeded successfully');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to seed master data', 500);
  }
}

// ── Master Data Counts (for super admin's "this clinic has X items" preview) ──
async function getMasterDataCounts(req, res) {
  try {
    const clinicId = (req.user?.role === 'SUPER_ADMIN' && req.params.clinicId)
      ? req.params.clinicId
      : req.clinicId;
    if (!clinicId) return errorResponse(res, 'Clinic context missing', 400);

    const [medicines, labTests, complaints, diagnoses, adviceOptions, billingItems] = await Promise.all([
      prisma.medicine.count({ where: { clinicId } }),
      prisma.labTest.count({ where: { clinicId } }),
      prisma.complaint.count({ where: { clinicId } }),
      prisma.diagnosis.count({ where: { clinicId } }),
      prisma.adviceOption.count({ where: { clinicId } }),
      prisma.billingItem.count({ where: { clinicId } }),
    ]);
    const total = medicines + labTests + complaints + diagnoses + adviceOptions + billingItems;
    return successResponse(res, { medicines, labTests, complaints, diagnoses, adviceOptions, billingItems, total }, 'Counts fetched');
  } catch (err) {
    console.error('[getMasterDataCounts]', err);
    return errorResponse(res, 'Failed to fetch counts', 500);
  }
}

const complainCtrl    = masterController('complaint',    'nameEn');
const diagnosisCtrl   = masterController('diagnosis',    'nameEn');
const adviceCtrl      = masterController('adviceOption', 'nameEn');
const medicineNoteCtrl= masterController('medicineNote', 'nameEn');

// Lab tests get a custom wrapper to validate the JSON `expectedFields` shape on create/update.
// Acceptable shape: array of { key, label, unit?, normalLow?, normalHigh? }
function sanitizeExpectedFields(input) {
  if (input === undefined) return undefined;        // not in body → leave field untouched
  if (input === null) return null;                   // explicit clear
  if (!Array.isArray(input)) return null;            // garbage → clear

  // Coerce a value to a number, accepting both real numbers and numeric strings ("13", "13.5").
  // Returns null for anything else (empty string, null, undefined, "abc", NaN).
  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // If key is missing, auto-derive from label so the editor doesn't have to.
  // "Total WBC" → "totalWbc", "HbA1c" → "hbA1c"
  const slugify = (label) => {
    if (!label) return '';
    const parts = String(label).replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
    if (!parts.length) return '';
    return parts.map((w, i) => i === 0
      ? w.charAt(0).toLowerCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  };

  const cleaned = input
    .filter(f => f && typeof f === 'object' && f.label)              // label is required (key auto-derives)
    .map(f => ({
      key:   String(f.key || slugify(f.label)).trim(),
      label: String(f.label).trim(),
      unit:  f.unit ? String(f.unit).trim() : null,
      normalLow:  toNum(f.normalLow),
      normalHigh: toNum(f.normalHigh),
    }))
    .filter(f => f.key.length && f.label.length);
  return cleaned.length ? cleaned : null;
}
const labTestBase = masterController('labTest', 'name');
const labTestCtrl = {
  getAll: labTestBase.getAll,
  remove: labTestBase.remove,
  create: async (req, res) => {
    if ('expectedFields' in req.body) {
      req.body.expectedFields = sanitizeExpectedFields(req.body.expectedFields);
    }
    return labTestBase.create(req, res);
  },
  update: async (req, res) => {
    if ('expectedFields' in req.body) {
      req.body.expectedFields = sanitizeExpectedFields(req.body.expectedFields);
    }
    return labTestBase.update(req, res);
  },
};

module.exports = {
  medicineCtrl, labTestCtrl, complainCtrl,
  diagnosisCtrl, adviceCtrl, medicineNoteCtrl, billingItemCtrl,
  dosageCtrl, timingCtrl, seedMasterData, getMasterDataCounts,
};
