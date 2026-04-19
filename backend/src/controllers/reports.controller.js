const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// ── Daily Report ──────────────────────────────────────────
async function getDailyReport(req, res) {
  try {
    const { date } = req.query;
    const d     = date ? new Date(date) : new Date();
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    const cid   = req.clinicId;

    const [patients, prescriptions, bills, queue] = await Promise.all([
      prisma.patient.count({ where: { clinicId: cid, createdAt: { gte: start, lte: end } } }),
      prisma.prescription.count({ where: { clinicId: cid, date: { gte: start, lte: end } } }),
      prisma.bill.findMany({ where: { clinicId: cid, date: { gte: start, lte: end } } }),
      prisma.appointment.count({ where: { clinicId: cid, tokenDate: { gte: start, lte: end } } }),
    ]);

    const totalBilled    = bills.reduce((s, b) => s + b.total, 0);
    const totalCollected = bills.reduce((s, b) => s + b.amountPaid, 0);
    const totalPending   = bills.reduce((s, b) => s + b.balance, 0);
    const byMode = {};
    bills.forEach(b => { if (b.amountPaid > 0) byMode[b.paymentMode] = (byMode[b.paymentMode] || 0) + b.amountPaid; });

    return successResponse(res, {
      date: start,
      newPatients: patients,
      prescriptions,
      billCount: bills.length,
      queueCount: queue,
      totalBilled, totalCollected, totalPending,
      byMode,
    });
  } catch (err) { return errorResponse(res, 'Failed', 500); }
}

// ── Monthly Report ────────────────────────────────────────
async function getMonthlyReport(req, res) {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    const cid   = req.clinicId;
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);

    const [bills, prescriptions, patients] = await Promise.all([
      prisma.bill.findMany({ where: { clinicId: cid, date: { gte: start, lte: end } } }),
      prisma.prescription.count({ where: { clinicId: cid, date: { gte: start, lte: end } } }),
      prisma.patient.count({ where: { clinicId: cid, createdAt: { gte: start, lte: end } } }),
    ]);

    // Build daily breakdown
    const dailyMap = {};
    bills.forEach(b => {
      const day = new Date(b.date).getDate();
      if (!dailyMap[day]) dailyMap[day] = { day, billed: 0, collected: 0, bills: 0 };
      dailyMap[day].billed    += b.total;
      dailyMap[day].collected += b.amountPaid;
      dailyMap[day].bills     += 1;
    });
    const daily = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => ({
      day: i + 1, label: `${i + 1}`,
      billed:    dailyMap[i+1]?.billed    || 0,
      collected: dailyMap[i+1]?.collected || 0,
      bills:     dailyMap[i+1]?.bills     || 0,
    }));

    const byMode = {};
    bills.forEach(b => { if (b.amountPaid > 0) byMode[b.paymentMode] = (byMode[b.paymentMode] || 0) + b.amountPaid; });

    return successResponse(res, {
      year: parseInt(year), month: parseInt(month),
      totalBilled:     bills.reduce((s, b) => s + b.total, 0),
      totalCollected:  bills.reduce((s, b) => s + b.amountPaid, 0),
      totalPending:    bills.reduce((s, b) => s + b.balance, 0),
      billCount:       bills.length,
      prescriptions,
      newPatients:     patients,
      byMode,
      daily,
    });
  } catch (err) { console.error(err); return errorResponse(res, 'Failed', 500); }
}

// ── Top Medicines ─────────────────────────────────────────
async function getTopMedicines(req, res) {
  try {
    const { limit = 10, from, to } = req.query;
    const where = { clinicId: req.clinicId, isActive: true };
    const medicines = await prisma.medicine.findMany({
      where,
      orderBy: { usageCount: 'desc' },
      take: parseInt(limit),
      select: { id: true, name: true, type: true, category: true, usageCount: true },
    });
    return successResponse(res, medicines);
  } catch { return errorResponse(res, 'Failed', 500); }
}

// ── Top Diagnoses ─────────────────────────────────────────
async function getTopDiagnoses(req, res) {
  try {
    const diagnoses = await prisma.diagnosis.findMany({
      where: { clinicId: req.clinicId, isActive: true },
      orderBy: { usageCount: 'desc' },
      take: 10,
    });
    return successResponse(res, diagnoses);
  } catch { return errorResponse(res, 'Failed', 500); }
}

// ── Patient Stats ─────────────────────────────────────────
async function getPatientStats(req, res) {
  try {
    const cid = req.clinicId;
    const [total, byGender, withChronic, thisMonth] = await Promise.all([
      prisma.patient.count({ where: { clinicId: cid, isActive: true } }),
      prisma.patient.groupBy({ by: ['gender'], where: { clinicId: cid, isActive: true }, _count: true }),
      prisma.patient.count({ where: { clinicId: cid, isActive: true, chronicConditions: { isEmpty: false } } }),
      prisma.patient.count({
        where: {
          clinicId: cid, isActive: true,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);
    return successResponse(res, {
      total, thisMonth, withChronic,
      byGender: byGender.reduce((acc, g) => ({ ...acc, [g.gender]: g._count }), {}),
    });
  } catch { return errorResponse(res, 'Failed', 500); }
}

// ── Collection Summary ────────────────────────────────────
async function getCollectionSummary(req, res) {
  try {
    const { from, to } = req.query;
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end   = to   ? new Date(new Date(to).setHours(23,59,59)) : new Date();

    const bills = await prisma.bill.findMany({
      where: { clinicId: req.clinicId, date: { gte: start, lte: end } },
      select: { total: true, amountPaid: true, balance: true, paymentMode: true, paymentStatus: true },
    });

    const byStatus = { Paid: 0, Partial: 0, Pending: 0 };
    bills.forEach(b => { byStatus[b.paymentStatus] = (byStatus[b.paymentStatus] || 0) + 1; });

    const byMode = {};
    bills.forEach(b => { if (b.amountPaid > 0) byMode[b.paymentMode] = (byMode[b.paymentMode] || 0) + b.amountPaid; });

    return successResponse(res, {
      totalBilled:    bills.reduce((s, b) => s + b.total, 0),
      totalCollected: bills.reduce((s, b) => s + b.amountPaid, 0),
      totalPending:   bills.reduce((s, b) => s + b.balance, 0),
      billCount: bills.length,
      byStatus, byMode,
    });
  } catch { return errorResponse(res, 'Failed', 500); }
}

module.exports = { getDailyReport, getMonthlyReport, getTopMedicines, getTopDiagnoses, getPatientStats, getCollectionSummary };
