const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

const VALID_TYPES = ['FITNESS_CERT', 'MEDICAL_CERT', 'REFERRAL'];

// Maps DocType → 2-3 letter code used in doc number
const TYPE_CODES = {
  FITNESS_CERT: 'FC',
  MEDICAL_CERT: 'MC',
  REFERRAL:     'REF',
};

// ── Doc number generator ─────────────────────────────────
// Format: <OPDPrefix>-<TypeCode>-<NNNN>
// Example: MH-FC-0001, MH-MC-0042, SH-REF-0007
async function generateDocNo(clinicId, type) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { opdSeriesPrefix: true },
  });
  const prefix = (clinic?.opdSeriesPrefix || 'MD').toUpperCase();
  const typeCode = TYPE_CODES[type];

  const last = await prisma.medicalDocument.findFirst({
    where: {
      clinicId,
      type,
      docNo: { startsWith: `${prefix}-${typeCode}-` },
    },
    orderBy: { createdAt: 'desc' },
    select: { docNo: true },
  });

  let nextN = 1;
  if (last?.docNo) {
    const m = last.docNo.match(/-(\d+)$/);
    if (m) nextN = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${typeCode}-${String(nextN).padStart(4, '0')}`;
}

// ── List documents ───────────────────────────────────────
async function listDocuments(req, res) {
  try {
    const { type, patientId, q, page = 1, limit = 20 } = req.query;

    const where = { clinicId: req.clinicId };
    if (type && VALID_TYPES.includes(type)) where.type = type;
    if (patientId) where.patientId = patientId;
    if (q && q.trim()) {
      where.OR = [
        { docNo:       { contains: q.trim(), mode: 'insensitive' } },
        { patientName: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const take = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

    const [docs, total] = await Promise.all([
      prisma.medicalDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take, skip,
        include: {
          doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true } },
          patient: { select: { id: true, patientCode: true, name: true } },
        },
      }),
      prisma.medicalDocument.count({ where }),
    ]);

    return successResponse(res, { items: docs, total, page: parseInt(page) || 1, limit: take });
  } catch (err) {
    console.error('[listDocuments]', err);
    return errorResponse(res, 'Failed to list documents', 500);
  }
}

// ── Get one ──────────────────────────────────────────────
async function getDocument(req, res) {
  try {
    const doc = await prisma.medicalDocument.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      include: {
        doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
        patient: true,
      },
    });
    if (!doc) return errorResponse(res, 'Document not found', 404);
    return successResponse(res, doc);
  } catch (err) {
    console.error('[getDocument]', err);
    return errorResponse(res, 'Failed to fetch document', 500);
  }
}

// ── Create document ──────────────────────────────────────
async function createDocument(req, res) {
  try {
    const {
      type, patientId, examDate, diagnosis, remarks, data, templateUsed,
    } = req.body || {};

    // Validation
    if (!type || !VALID_TYPES.includes(type)) {
      return errorResponse(res, `type must be one of: ${VALID_TYPES.join(', ')}`, 400);
    }
    if (!patientId) {
      return errorResponse(res, 'patientId is required', 400);
    }

    // Verify patient belongs to this clinic + grab snapshot fields
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId },
    });
    if (!patient) return errorResponse(res, 'Patient not found in this clinic', 404);

    // Type-specific validation
    const dataObj = (data && typeof data === 'object') ? data : {};
    if (type === 'MEDICAL_CERT') {
      if (!dataObj.restFromDate || !dataObj.restToDate) {
        return errorResponse(res, 'Medical certificate requires rest from/to dates', 400);
      }
    }
    if (type === 'REFERRAL') {
      if (!dataObj.referredToName || !String(dataObj.referredToName).trim()) {
        return errorResponse(res, 'Referral requires referred-to doctor name', 400);
      }
      if (!dataObj.reasonForReferral || !String(dataObj.reasonForReferral).trim()) {
        return errorResponse(res, 'Referral requires reason for referral', 400);
      }
    }
    if (type === 'FITNESS_CERT') {
      const okVerdicts = ['FIT', 'UNFIT', 'FIT_WITH_RESTRICTIONS'];
      if (dataObj.verdict && !okVerdicts.includes(dataObj.verdict)) {
        return errorResponse(res, 'Invalid fitness verdict', 400);
      }
    }

    const docNo = await generateDocNo(req.clinicId, type);
    const exam = examDate ? new Date(examDate) : new Date();
    if (isNaN(exam.getTime())) return errorResponse(res, 'Invalid examDate', 400);

    const doc = await prisma.medicalDocument.create({
      data: {
        clinicId: req.clinicId,
        docNo,
        type,
        doctorId: req.user.id,
        patientId,
        // Snapshot fields from current patient record
        patientName:     patient.name,
        patientAge:      patient.age,
        patientGender:   patient.gender,
        patientGuardian: req.body?.patientGuardian || null,
        patientEmpId:    req.body?.patientEmpId    || null,
        patientAddress:  patient.address,
        patientPhone:    patient.phone,
        examDate:        exam,
        diagnosis:       (diagnosis || '').trim() || null,
        remarks:         (remarks   || '').trim() || null,
        data:            dataObj,
        templateUsed:    templateUsed || null,
      },
      include: {
        doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
        patient: true,
      },
    });

    return successResponse(res, doc, 'Document created', 201);
  } catch (err) {
    console.error('[createDocument]', err);
    return errorResponse(res, err?.message || 'Failed to create document', 500);
  }
}

// ── Update (patient/type/docNo are immutable; only content fields) ───
async function updateDocument(req, res) {
  try {
    const existing = await prisma.medicalDocument.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Document not found', 404);

    const {
      examDate, diagnosis, remarks, data,
      patientGuardian, patientEmpId, patientAddress, patientPhone,
    } = req.body || {};

    const updateData = {};
    if (examDate          !== undefined) {
      const d = new Date(examDate);
      if (isNaN(d.getTime())) return errorResponse(res, 'Invalid examDate', 400);
      updateData.examDate = d;
    }
    if (diagnosis        !== undefined) updateData.diagnosis = (diagnosis || '').trim() || null;
    if (remarks          !== undefined) updateData.remarks   = (remarks   || '').trim() || null;
    if (data             !== undefined) updateData.data      = (data && typeof data === 'object') ? data : {};
    if (patientGuardian  !== undefined) updateData.patientGuardian = patientGuardian || null;
    if (patientEmpId     !== undefined) updateData.patientEmpId    = patientEmpId    || null;
    if (patientAddress   !== undefined) updateData.patientAddress  = patientAddress  || null;
    if (patientPhone     !== undefined) updateData.patientPhone    = patientPhone    || null;

    const doc = await prisma.medicalDocument.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        doctor:  { select: { id: true, name: true, qualification: true, specialization: true, regNo: true, signature: true, stamp: true } },
        patient: true,
      },
    });

    return successResponse(res, doc, 'Document updated');
  } catch (err) {
    console.error('[updateDocument]', err);
    return errorResponse(res, 'Failed to update document', 500);
  }
}

// ── Delete ───────────────────────────────────────────────
async function deleteDocument(req, res) {
  try {
    const existing = await prisma.medicalDocument.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Document not found', 404);

    await prisma.medicalDocument.delete({ where: { id: existing.id } });
    return successResponse(res, null, 'Document deleted');
  } catch (err) {
    console.error('[deleteDocument]', err);
    return errorResponse(res, 'Failed to delete document', 500);
  }
}

// ── Documents for a specific patient ─────────────────────
async function getDocumentsForPatient(req, res) {
  try {
    const { patientId } = req.params;
    const docs = await prisma.medicalDocument.findMany({
      where: { clinicId: req.clinicId, patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { id: true, name: true } },
      },
    });
    return successResponse(res, docs);
  } catch (err) {
    console.error('[getDocumentsForPatient]', err);
    return errorResponse(res, 'Failed to fetch patient documents', 500);
  }
}

module.exports = {
  listDocuments, getDocument, createDocument, updateDocument, deleteDocument,
  getDocumentsForPatient,
};
