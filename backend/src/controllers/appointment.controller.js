const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// ── Get today's token number ──────────────────────────────
async function getNextToken(clinicId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const last = await prisma.appointment.findFirst({
    where: {
      clinicId,
      tokenDate: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { tokenNo: 'desc' },
  });

  return last ? last.tokenNo + 1 : 1;
}

// ── Get today's queue ─────────────────────────────────────
async function getTodayQueue(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { doctorId, status } = req.query;

    const where = {
      clinicId: req.clinicId,
      tokenDate: { gte: today, lt: tomorrow },
    };
    if (doctorId) where.doctorId = doctorId;
    if (status)   where.status   = status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { tokenNo: 'asc' },
      include: {
        patient: {
          select: {
            id: true, patientCode: true, name: true,
            age: true, gender: true, phone: true,
            allergies: true, chronicConditions: true,
          },
        },
      },
    });

    // Stats
    const stats = {
      total:          appointments.length,
      waiting:        appointments.filter(a => a.status === 'Waiting').length,
      inConsultation: appointments.filter(a => a.status === 'InConsultation').length,
      done:           appointments.filter(a => a.status === 'Done').length,
      skipped:        appointments.filter(a => a.status === 'Skipped').length,
    };

    return successResponse(res, { appointments, stats });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch queue', 500);
  }
}

// ── Add patient to today's queue ──────────────────────────
async function addToQueue(req, res) {
  try {
    const { patientId, doctorId, notes } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check patient exists in this clinic
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: req.clinicId },
    });
    if (!patient) return errorResponse(res, 'Patient not found', 404);

    // Check not already in today's queue
    const alreadyIn = await prisma.appointment.findFirst({
      where: {
        clinicId:  req.clinicId,
        patientId,
        tokenDate: { gte: today, lt: tomorrow },
        status:    { notIn: ['Done', 'Skipped'] },
      },
    });
    if (alreadyIn) return errorResponse(res, `Patient already in queue — Token #${alreadyIn.tokenNo}`, 409);

    const tokenNo = await getNextToken(req.clinicId, new Date());

    const appointment = await prisma.appointment.create({
      data: {
        clinicId:  req.clinicId,
        patientId,
        doctorId:  doctorId || null,
        tokenNo,
        tokenDate: today,
        notes:     notes || null,
        status:    'Waiting',
      },
      include: {
        patient: {
          select: {
            id: true, patientCode: true, name: true,
            age: true, gender: true, phone: true,
          },
        },
      },
    });

    return successResponse(res, appointment, `Token #${tokenNo} assigned`, 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to add to queue', 500);
  }
}

// ── Update token status ───────────────────────────────────
async function updateTokenStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ['Waiting', 'InConsultation', 'Done', 'Skipped'];
    if (!validStatuses.includes(status)) return errorResponse(res, 'Invalid status', 400);

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!appointment) return errorResponse(res, 'Appointment not found', 404);

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data:  { status },
      include: {
        patient: {
          select: { id: true, patientCode: true, name: true, age: true, gender: true },
        },
      },
    });

    return successResponse(res, updated, 'Status updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update status', 500);
  }
}

// ── Call next patient ─────────────────────────────────────
async function callNext(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { doctorId } = req.query;
    const where = {
      clinicId:  req.clinicId,
      status:    'Waiting',
      tokenDate: { gte: today, lt: tomorrow },
    };
    if (doctorId) where.doctorId = doctorId;

    const next = await prisma.appointment.findFirst({
      where,
      orderBy: { tokenNo: 'asc' },
      include: {
        patient: {
          select: {
            id: true, patientCode: true, name: true,
            age: true, gender: true, phone: true,
            allergies: true, chronicConditions: true,
          },
        },
      },
    });

    if (!next) return successResponse(res, null, 'No more patients in queue');

    // Mark as InConsultation
    const updated = await prisma.appointment.update({
      where: { id: next.id },
      data:  { status: 'InConsultation' },
      include: {
        patient: {
          select: {
            id: true, patientCode: true, name: true,
            age: true, gender: true, phone: true,
            allergies: true, chronicConditions: true,
          },
        },
      },
    });

    return successResponse(res, updated, `Now calling Token #${next.tokenNo}`);
  } catch (err) {
    return errorResponse(res, 'Failed to call next patient', 500);
  }
}

// ── Reorder token ─────────────────────────────────────────
async function reorderToken(req, res) {
  try {
    const { newTokenNo } = req.body;

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!appointment) return errorResponse(res, 'Appointment not found', 404);

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data:  { tokenNo: parseInt(newTokenNo) },
    });

    return successResponse(res, updated, 'Token reordered');
  } catch (err) {
    return errorResponse(res, 'Failed to reorder token', 500);
  }
}

// ── Get queue for a specific date ─────────────────────────
async function getQueueByDate(req, res) {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId:  req.clinicId,
        tokenDate: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { tokenNo: 'asc' },
      include: {
        patient: {
          select: {
            id: true, patientCode: true, name: true,
            age: true, gender: true, phone: true,
          },
        },
      },
    });

    return successResponse(res, appointments);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch queue', 500);
  }
}

module.exports = {
  getTodayQueue, addToQueue, updateTokenStatus,
  callNext, reorderToken, getQueueByDate,
};
