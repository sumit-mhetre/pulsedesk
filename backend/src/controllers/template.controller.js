const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// ── Get all templates ─────────────────────────────────────
async function getTemplates(req, res) {
  try {
    const { search = '' } = req.query;
    const where = { clinicId: req.clinicId, isActive: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const templates = await prisma.prescriptionTemplate.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      include: {
        medicines: {
          orderBy: { sortOrder: 'asc' },
          include: { template: false },
        },
      },
    });
    return successResponse(res, templates);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch templates', 500);
  }
}

// ── Get single template ───────────────────────────────────
async function getTemplate(req, res) {
  try {
    const template = await prisma.prescriptionTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: { medicines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) return errorResponse(res, 'Template not found', 404);
    return successResponse(res, template);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch template', 500);
  }
}

// ── Create template ───────────────────────────────────────
async function createTemplate(req, res) {
  try {
    const { name, complaint, diagnosis, advice, nextVisit, labTests = [], medicines = [] } = req.body;

    if (!name) return errorResponse(res, 'Template name is required', 400);

    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { clinicId: req.clinicId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return errorResponse(res, `Template "${name}" already exists`, 409);

    const template = await prisma.$transaction(async (tx) => {
      const t = await tx.prescriptionTemplate.create({
        data: {
          clinicId:  req.clinicId,
          name,
          complaint: complaint || null,
          diagnosis: diagnosis || null,
          advice:    advice    || null,
          nextVisit: nextVisit ? parseInt(nextVisit) : null,
          labTests:  labTests,
        },
      });

      if (medicines.length > 0) {
        await tx.templateMedicine.createMany({
          data: medicines.map((m, idx) => ({
            templateId: t.id,
            medicineId: m.medicineId,
            dosage:     m.dosage  || null,
            days:       m.days    || null,
            timing:     m.timing  || null,
            frequency:  m.frequency || null,
            notesEn:    m.notesEn || null,
            sortOrder:  idx,
          })),
        });
      }

      return tx.prescriptionTemplate.findUnique({
        where: { id: t.id },
        include: { medicines: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return successResponse(res, template, 'Template created', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to create template', 500);
  }
}

// ── Update template ───────────────────────────────────────
async function updateTemplate(req, res) {
  try {
    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Template not found', 404);

    const { name, complaint, diagnosis, advice, nextVisit, labTests, medicines } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.prescriptionTemplate.update({
        where: { id: req.params.id },
        data: {
          ...(name      !== undefined && { name }),
          ...(complaint !== undefined && { complaint }),
          ...(diagnosis !== undefined && { diagnosis }),
          ...(advice    !== undefined && { advice }),
          ...(nextVisit !== undefined && { nextVisit: nextVisit ? parseInt(nextVisit) : null }),
          ...(labTests  !== undefined && { labTests }),
        },
      });

      if (medicines !== undefined) {
        await tx.templateMedicine.deleteMany({ where: { templateId: req.params.id } });
        if (medicines.length > 0) {
          await tx.templateMedicine.createMany({
            data: medicines.map((m, idx) => ({
              templateId: req.params.id,
              medicineId: m.medicineId,
              dosage:     m.dosage  || null,
              days:       m.days    || null,
              timing:     m.timing  || null,
              frequency:  m.frequency || null,
              notesEn:    m.notesEn || null,
              sortOrder:  idx,
            })),
          });
        }
      }

      return tx.prescriptionTemplate.findUnique({
        where: { id: req.params.id },
        include: { medicines: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return successResponse(res, updated, 'Template updated');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to update template', 500);
  }
}

// ── Delete template ───────────────────────────────────────
async function deleteTemplate(req, res) {
  try {
    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Template not found', 404);
    await prisma.prescriptionTemplate.update({ where: { id: req.params.id }, data: { isActive: false } });
    return successResponse(res, null, 'Template deleted');
  } catch (err) {
    return errorResponse(res, 'Failed to delete template', 500);
  }
}

// ── Use template (increments usage count) ────────────────
async function useTemplate(req, res) {
  try {
    const template = await prisma.prescriptionTemplate.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        medicines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            // Get medicine name from master
          },
        },
      },
    });
    if (!template) return errorResponse(res, 'Template not found', 404);

    // Get medicine names
    const medicinesWithNames = await Promise.all(
      template.medicines.map(async (m) => {
        const med = await prisma.medicine.findFirst({ where: { id: m.medicineId } });
        return {
          medicineId:   m.medicineId,
          medicineName: med?.name || '',
          medicineType: med?.type || 'tablet',
          dosage:  m.dosage || '',
          days:    m.days ? String(m.days) : '',
          timing:  m.timing || 'AF',
          frequency: m.frequency || 'DAILY',
          notesEn: m.notesEn || '',
          qty:     m.dosage && m.days ? String((({ '1-0-0':1,'0-1-0':1,'0-0-1':1,'1-0-1':2,'1-1-0':2,'0-1-1':2,'1-1-1':3,'1-1-1-1':4,'OD':1,'BD':2,'TDS':3,'QID':4,'HS':1 })[m.dosage] || 0) * (parseInt(String(m.days).match(/\d+/)?.[0]) || 0)) : '',
        };
      })
    );

    // Increment usage
    await prisma.prescriptionTemplate.update({
      where: { id: req.params.id },
      data: { usageCount: { increment: 1 } },
    });

    return successResponse(res, {
      ...template,
      medicines: medicinesWithNames,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to load template', 500);
  }
}

// ── Save current prescription as template ─────────────────
async function saveAsTemplate(req, res) {
  try {
    const { name, complaint, diagnosis, advice, nextVisit, labTests = [], medicines = [] } = req.body;
    if (!name) return errorResponse(res, 'Template name is required', 400);

    // Check if name exists and update, or create new
    const existing = await prisma.prescriptionTemplate.findFirst({
      where: { clinicId: req.clinicId, name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      // Update existing — increment version
      await prisma.$transaction(async (tx) => {
        await tx.templateMedicine.deleteMany({ where: { templateId: existing.id } });
        await tx.prescriptionTemplate.update({
          where: { id: existing.id },
          data: { complaint, diagnosis, advice, nextVisit: nextVisit ? parseInt(nextVisit) : null, labTests, version: { increment: 1 } },
        });
        if (medicines.length > 0) {
          await tx.templateMedicine.createMany({
            data: medicines.map((m, idx) => ({
              templateId: existing.id,
              medicineId: m.medicineId,
              dosage: m.dosage||null, days:       m.days    || null,
              timing: m.timing||null, notesEn: m.notesEn||null, sortOrder: idx,
            })),
          });
        }
      });
      return successResponse(res, { id: existing.id, name }, `Template "${name}" updated!`);
    }

    // Create new
    await prisma.$transaction(async (tx) => {
      const t = await tx.prescriptionTemplate.create({
        data: { clinicId: req.clinicId, name, complaint, diagnosis, advice, nextVisit: nextVisit?parseInt(nextVisit):null, labTests },
      });
      if (medicines.length > 0) {
        await tx.templateMedicine.createMany({
          data: medicines.map((m, idx) => ({
            templateId: t.id, medicineId: m.medicineId,
            dosage: m.dosage||null, days:       m.days    || null,
            timing: m.timing||null, notesEn: m.notesEn||null, sortOrder: idx,
          })),
        });
      }
    });
    return successResponse(res, { name }, `Template "${name}" saved!`, 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to save template', 500);
  }
}

module.exports = { getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, useTemplate, saveAsTemplate };
