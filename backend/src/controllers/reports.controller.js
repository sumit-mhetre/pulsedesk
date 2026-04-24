const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');
const { runReportQuery, listAvailableColumns } = require('../lib/reportQuery');
const { startOfDay, endOfDay, resolveDateRange, daysBetween } = require('../lib/dates');
const { toCSV }  = require('../lib/exportCsv');
const { toXLSX } = require('../lib/exportXlsx');
const { toPDF }  = require('../lib/exportPdf');
const { toDOCX } = require('../lib/exportDocx');

// ═══════════════════════════════════════════════════════════
//  LEGACY ENDPOINTS — backward compatibility
// ═══════════════════════════════════════════════════════════

async function getDailyReport(req, res) {
  try {
    const { date } = req.query;
    const d     = date ? new Date(date) : new Date();
    const start = startOfDay(d);
    const end   = endOfDay(d);
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
  } catch (err) { console.error('[getDailyReport]', err); return errorResponse(res, 'Failed', 500); }
}

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
  } catch (err) { console.error('[getMonthlyReport]', err); return errorResponse(res, 'Failed', 500); }
}

async function getTopMedicines(req, res) {
  try {
    const { limit = 10 } = req.query;
    const medicines = await prisma.medicine.findMany({
      where: { clinicId: req.clinicId, isActive: true },
      orderBy: { usageCount: 'desc' },
      take: parseInt(limit),
      select: { id: true, name: true, type: true, category: true, usageCount: true },
    });
    return successResponse(res, medicines);
  } catch { return errorResponse(res, 'Failed', 500); }
}

async function getTopDiagnoses(req, res) {
  try {
    const { limit = 10 } = req.query;
    const diagnoses = await prisma.diagnosis.findMany({
      where: { clinicId: req.clinicId, isActive: true },
      orderBy: { usageCount: 'desc' },
      take: parseInt(limit),
      select: { id: true, nameEn: true, nameHi: true, nameMr: true, usageCount: true },
    });
    // Map to unified `name` for frontend
    const mapped = diagnoses.map(d => ({
      id: d.id,
      name: d.nameEn || d.nameHi || d.nameMr || '—',
      nameEn: d.nameEn, nameHi: d.nameHi, nameMr: d.nameMr,
      usageCount: d.usageCount,
    }));
    return successResponse(res, mapped);
  } catch { return errorResponse(res, 'Failed', 500); }
}

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

async function getCollectionSummary(req, res) {
  try {
    const { from, to } = req.query;
    const start = from ? startOfDay(new Date(from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end   = to   ? endOfDay(new Date(to)) : new Date();

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

// ═══════════════════════════════════════════════════════════
//  NEW — DASHBOARD
// ═══════════════════════════════════════════════════════════

async function getDashboard(req, res) {
  try {
    const cid = req.clinicId;
    const preset = req.query.preset || '30d';
    const range = req.query.from && req.query.to
      ? { from: startOfDay(new Date(req.query.from)), to: endOfDay(new Date(req.query.to)) }
      : resolveDateRange(preset);
    const { from, to } = range;
    const days = daysBetween(from, to);

    const [
      todayStats, rangeBills, rangePatients, rangePrescriptions, rangeAppointments,
      topMeds, topDiag, genderSplit, doctorCounts,
    ] = await Promise.all([
      (async () => {
        const t0 = startOfDay(new Date()); const t1 = endOfDay(new Date());
        const [p, rx, bills] = await Promise.all([
          prisma.patient.count({ where: { clinicId: cid, createdAt: { gte: t0, lte: t1 } } }),
          prisma.prescription.count({ where: { clinicId: cid, date: { gte: t0, lte: t1 } } }),
          prisma.bill.findMany({
            where: { clinicId: cid, date: { gte: t0, lte: t1 } },
            select: { total: true, amountPaid: true, balance: true },
          }),
        ]);
        return {
          newPatients: p, prescriptions: rx, billCount: bills.length,
          totalBilled:    bills.reduce((s, b) => s + b.total, 0),
          totalCollected: bills.reduce((s, b) => s + b.amountPaid, 0),
          totalPending:   bills.reduce((s, b) => s + b.balance, 0),
        };
      })(),
      prisma.bill.findMany({
        where: { clinicId: cid, date: { gte: from, lte: to } },
        select: { date: true, total: true, amountPaid: true, balance: true, paymentMode: true, paymentStatus: true },
      }),
      prisma.patient.findMany({
        where: { clinicId: cid, createdAt: { gte: from, lte: to } },
        select: { createdAt: true, gender: true, age: true },
      }),
      prisma.prescription.findMany({
        where: { clinicId: cid, date: { gte: from, lte: to } },
        select: { date: true, diagnosis: true, doctorId: true },
      }),
      prisma.appointment.findMany({
        where: { clinicId: cid, tokenDate: { gte: from, lte: to } },
        select: { tokenDate: true, status: true, createdAt: true },
      }),
      prisma.medicine.findMany({
        where: { clinicId: cid, isActive: true },
        orderBy: { usageCount: 'desc' }, take: 10,
        select: { name: true, usageCount: true, type: true },
      }),
      prisma.diagnosis.findMany({
        where: { clinicId: cid, isActive: true },
        orderBy: { usageCount: 'desc' }, take: 10,
        select: { nameEn: true, nameHi: true, nameMr: true, usageCount: true },
      }),
      prisma.patient.groupBy({ by: ['gender'], where: { clinicId: cid, isActive: true }, _count: true }),
      prisma.prescription.groupBy({
        by: ['doctorId'],
        where: { clinicId: cid, date: { gte: from, lte: to } },
        _count: true,
      }),
    ]);

    const dayBuckets = buildDayBuckets(from, to);
    const revenueByDay   = cloneZero(dayBuckets);
    const collectedByDay = cloneZero(dayBuckets);
    const footfallByDay  = cloneZero(dayBuckets);
    const newPatByDay    = cloneZero(dayBuckets);

    rangeBills.forEach(b => {
      const k = toDayKey(b.date);
      if (revenueByDay[k] != null) {
        revenueByDay[k]   += b.total;
        collectedByDay[k] += b.amountPaid;
      }
    });
    rangePrescriptions.forEach(r => {
      const k = toDayKey(r.date);
      if (footfallByDay[k] != null) footfallByDay[k] += 1;
    });
    rangePatients.forEach(p => {
      const k = toDayKey(p.createdAt);
      if (newPatByDay[k] != null) newPatByDay[k] += 1;
    });

    const trend = Object.keys(dayBuckets).map(k => ({
      date: k,
      revenue:   Math.round(revenueByDay[k]),
      collected: Math.round(collectedByDay[k]),
      patients:  footfallByDay[k],
      newPat:    newPatByDay[k],
    }));

    const byPaymentStatus = { Paid: 0, Partial: 0, Pending: 0 };
    const byPaymentMode   = {};
    rangeBills.forEach(b => {
      byPaymentStatus[b.paymentStatus] = (byPaymentStatus[b.paymentStatus] || 0) + 1;
      if (b.amountPaid > 0) byPaymentMode[b.paymentMode] = (byPaymentMode[b.paymentMode] || 0) + b.amountPaid;
    });

    const ageGroups = { '0-18': 0, '19-30': 0, '31-45': 0, '46-60': 0, '60+': 0, 'Unknown': 0 };
    rangePatients.forEach(p => {
      const a = p.age;
      if (a == null) { ageGroups.Unknown++; return; }
      if (a <= 18) ageGroups['0-18']++;
      else if (a <= 30) ageGroups['19-30']++;
      else if (a <= 45) ageGroups['31-45']++;
      else if (a <= 60) ageGroups['46-60']++;
      else ageGroups['60+']++;
    });

    const peakHours = Array.from({ length: 24 }, () => 0);
    rangeAppointments.forEach(a => {
      const h = new Date(a.createdAt).getHours();
      peakHours[h]++;
    });

    let doctorStats = [];
    if (doctorCounts.length) {
      const ids = doctorCounts.map(d => d.doctorId).filter(Boolean);
      const users = ids.length ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }) : [];
      const nameMap = Object.fromEntries(users.map(u => [u.id, u.name]));
      doctorStats = doctorCounts.map(d => ({
        doctorId: d.doctorId,
        name: nameMap[d.doctorId] || 'Unknown',
        count: d._count,
      })).sort((a, b) => b.count - a.count);
    }

    const diagCount = {};
    rangePrescriptions.forEach(r => {
      (r.diagnosis || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(d => {
        diagCount[d] = (diagCount[d] || 0) + 1;
      });
    });
    const topDiagnosesInRange = Object.entries(diagCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const rangeStats = {
      totalBilled:    rangeBills.reduce((s, b) => s + b.total, 0),
      totalCollected: rangeBills.reduce((s, b) => s + b.amountPaid, 0),
      totalPending:   rangeBills.reduce((s, b) => s + b.balance, 0),
      billCount:      rangeBills.length,
      prescriptionCount: rangePrescriptions.length,
      appointmentCount:  rangeAppointments.length,
      newPatientsCount:  rangePatients.length,
    };

    return successResponse(res, {
      dateRange: { from, to, days, preset },
      today: todayStats,
      range: rangeStats,
      trend,
      payments: { byStatus: byPaymentStatus, byMode: byPaymentMode },
      ageGroups,
      genderSplit: genderSplit.reduce((a, g) => ({ ...a, [g.gender]: g._count }), {}),
      peakHours,
      topMedicines: topMeds,
      topDiagnoses: topDiagnosesInRange.length
        ? topDiagnosesInRange
        : topDiag.map(d => ({ name: d.nameEn || d.nameHi || d.nameMr || '—', count: d.usageCount })),
      doctorStats,
    });
  } catch (err) {
    console.error('[getDashboard]', err);
    return errorResponse(res, 'Failed to build dashboard', 500);
  }
}

// ═══════════════════════════════════════════════════════════
//  NEW — CUSTOM REPORT QUERY
// ═══════════════════════════════════════════════════════════

async function getReportMeta(req, res) {
  try {
    const meta = {
      types: [
        { key: 'patients',      label: 'Patients' },
        { key: 'prescriptions', label: 'Prescriptions' },
        { key: 'bills',         label: 'Bills' },
        { key: 'appointments',  label: 'Appointments' },
      ],
      columns: {
        patients:      listAvailableColumns('patients'),
        prescriptions: listAvailableColumns('prescriptions'),
        bills:         listAvailableColumns('bills'),
        appointments:  listAvailableColumns('appointments'),
      },
      presets: [
        { key: 'today',     label: 'Today' },
        { key: 'yesterday', label: 'Yesterday' },
        { key: '7d',        label: 'Last 7 days' },
        { key: '30d',       label: 'Last 30 days' },
        { key: '90d',       label: 'Last 90 days' },
        { key: 'month',     label: 'This month' },
        { key: 'lastMonth', label: 'Last month' },
        { key: 'quarter',   label: 'This quarter' },
        { key: 'year',      label: 'This year' },
      ],
    };
    return successResponse(res, meta);
  } catch (err) {
    return errorResponse(res, 'Failed to load report meta', 500);
  }
}

async function runQuery(req, res) {
  try {
    const config = req.body || {};
    const result = await runReportQuery(config, req.clinicId, req.user);
    return successResponse(res, result);
  } catch (err) {
    console.error('[runQuery]', err);
    return errorResponse(res, err.message || 'Report query failed', 400);
  }
}

// ═══════════════════════════════════════════════════════════
//  NEW — EXPORT
// ═══════════════════════════════════════════════════════════

async function exportReport(req, res) {
  try {
    const { format = 'csv', config = {} } = req.body || {};
    const fmt = String(format).toLowerCase();
    if (!['csv', 'xlsx', 'pdf', 'docx'].includes(fmt)) {
      return errorResponse(res, 'Unsupported format', 400);
    }

    const result = await runReportQuery({ ...config, full: true, pageSize: 10000 }, req.clinicId, req.user);

    const clinic = await prisma.clinic.findUnique({
      where: { id: req.clinicId },
      select: { name: true },
    });

    const typeName = (config.type || 'report').charAt(0).toUpperCase() + (config.type || 'report').slice(1);
    const title    = `${typeName} Report`;
    const subtitle = buildSubtitle(config, result.total);

    const filename = `simplerx-${(config.type || 'report')}-${Date.now()}`;

    switch (fmt) {
      case 'csv': {
        const csv = toCSV(result.columns, result.rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csv);
      }
      case 'xlsx': {
        const buf = await toXLSX({
          title, subtitle,
          columnsMeta: result.columns,
          rows: result.rows,
          summary: result.summary,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        return res.send(buf);
      }
      case 'pdf': {
        const doc = toPDF({
          title, subtitle,
          clinicName: clinic?.name || '',
          columnsMeta: result.columns,
          rows: result.rows,
          summary: result.summary,
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        doc.pipe(res);
        doc.end();
        return;
      }
      case 'docx': {
        const buf = await toDOCX({
          title, subtitle,
          clinicName: clinic?.name || '',
          columnsMeta: result.columns,
          rows: result.rows,
          summary: result.summary,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
        return res.send(buf);
      }
    }
  } catch (err) {
    console.error('[exportReport]', err);
    return errorResponse(res, 'Export failed', 500);
  }
}

function buildSubtitle(config, total) {
  const parts = [];
  if (config.dateRange?.from || config.dateRange?.to) {
    const f = config.dateRange.from ? new Date(config.dateRange.from).toLocaleDateString('en-IN') : '…';
    const t = config.dateRange.to   ? new Date(config.dateRange.to).toLocaleDateString('en-IN')   : '…';
    parts.push(`${f} → ${t}`);
  }
  parts.push(`${total} record${total === 1 ? '' : 's'}`);
  return parts.join('  •  ');
}

// ═══════════════════════════════════════════════════════════
//  NEW — SAVED REPORTS
// ═══════════════════════════════════════════════════════════

async function listSavedReports(req, res) {
  try {
    const userId = req.user.id;
    const reports = await prisma.savedReport.findMany({
      where: {
        clinicId: req.clinicId,
        OR: [{ isShared: true }, { userId }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return successResponse(res, reports);
  } catch (err) {
    console.error('[listSavedReports]', err);
    return errorResponse(res, 'Failed to list saved reports', 500);
  }
}

async function createSavedReport(req, res) {
  try {
    const { name, description, reportType, config, isShared } = req.body;
    if (!name || !reportType || !config) {
      return errorResponse(res, 'name, reportType and config are required', 400);
    }
    if (!['patients','prescriptions','bills','appointments'].includes(reportType)) {
      return errorResponse(res, 'Invalid reportType', 400);
    }
    const report = await prisma.savedReport.create({
      data: {
        clinicId:    req.clinicId,
        userId:      req.user.id,
        name:        String(name).slice(0, 120),
        description: description ? String(description).slice(0, 500) : null,
        reportType,
        config,
        isShared:    isShared !== false,
      },
    });
    return successResponse(res, report, 'Report saved', 201);
  } catch (err) {
    console.error('[createSavedReport]', err);
    return errorResponse(res, 'Failed to save report', 500);
  }
}

async function updateSavedReport(req, res) {
  try {
    const { name, description, config, isShared } = req.body;
    const existing = await prisma.savedReport.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Report not found', 404);
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'Only the creator or admin can edit this report', 403);
    }
    const report = await prisma.savedReport.update({
      where: { id: req.params.id },
      data: {
        ...(name        !== undefined && { name: String(name).slice(0, 120) }),
        ...(description !== undefined && { description: description ? String(description).slice(0, 500) : null }),
        ...(config      !== undefined && { config }),
        ...(isShared    !== undefined && { isShared }),
      },
    });
    return successResponse(res, report, 'Report updated');
  } catch (err) {
    console.error('[updateSavedReport]', err);
    return errorResponse(res, 'Failed to update report', 500);
  }
}

async function deleteSavedReport(req, res) {
  try {
    const existing = await prisma.savedReport.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Report not found', 404);
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'Only the creator or admin can delete this report', 403);
    }
    await prisma.savedReport.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Report deleted');
  } catch (err) {
    console.error('[deleteSavedReport]', err);
    return errorResponse(res, 'Failed to delete report', 500);
  }
}

async function runSavedReport(req, res) {
  try {
    const existing = await prisma.savedReport.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'Report not found', 404);
    if (!existing.isShared && existing.userId !== req.user.id) {
      return errorResponse(res, 'This report is private', 403);
    }

    const config = { ...existing.config, ...(req.body?.overrides || {}) };
    const result = await runReportQuery(config, req.clinicId, req.user);

    prisma.savedReport.update({
      where: { id: req.params.id },
      data: { lastRunAt: new Date(), runCount: { increment: 1 } },
    }).catch(() => {});

    return successResponse(res, { savedReport: existing, result });
  } catch (err) {
    console.error('[runSavedReport]', err);
    return errorResponse(res, 'Failed to run saved report', 500);
  }
}

// ── Helpers ────────────────────────────────────────────────
function buildDayBuckets(from, to) {
  const out = {};
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  while (cur <= to) { out[toDayKey(cur)] = 0; cur.setDate(cur.getDate() + 1); }
  return out;
}
function cloneZero(obj) { const out = {}; for (const k of Object.keys(obj)) out[k] = 0; return out; }
function toDayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

module.exports = {
  getDailyReport, getMonthlyReport, getTopMedicines, getTopDiagnoses,
  getPatientStats, getCollectionSummary,
  getDashboard, getReportMeta, runQuery, exportReport,
  listSavedReports, createSavedReport, updateSavedReport, deleteSavedReport, runSavedReport,
};
