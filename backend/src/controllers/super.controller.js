const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// ── Create Super Admin (one time setup) ──────────────────
async function createSuperAdmin(req, res) {
  try {
    const { name, email, password, setupKey } = req.body;

    if (setupKey !== process.env.SETUP_KEY && setupKey !== 'PULSEDESK_SETUP_2024') {
      return errorResponse(res, 'Invalid setup key', 403);
    }

    const existing = await prisma.superAdmin.findFirst();
    if (existing) return errorResponse(res, 'Super admin already exists', 409);

    const hashed = await bcrypt.hash(password, 12);
    const superAdmin = await prisma.superAdmin.create({
      data: { name, email, password: hashed },
    });

    const { password: _, ...safe } = superAdmin;
    return successResponse(res, safe, 'Super admin created', 201);
  } catch (err) {
    return errorResponse(res, 'Failed to create super admin', 500);
  }
}

// ── Dashboard stats (Super Admin) ────────────────────────
async function getDashboardStats(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

    const [
      totalClinics, activeClinics,
      totalPatients, totalPrescriptions, totalAdmissions, totalBills,
      patientsToday, prescriptionsToday, admissionsToday, billsToday,
      byPlan, recentClinics,
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { status: 'Active' } }),
      prisma.patient.count(),
      prisma.prescription.count(),
      prisma.admission.count(),
      prisma.bill.count(),

      prisma.patient.count({       where: { createdAt: { gte: startOfToday } } }),
      prisma.prescription.count({  where: { createdAt: { gte: startOfToday } } }),
      prisma.admission.count({     where: { createdAt: { gte: startOfToday } } }),
      prisma.bill.count({          where: { createdAt: { gte: startOfToday } } }),

      prisma.clinic.groupBy({ by: ['subscriptionPlan'], _count: { id: true } }),
      prisma.clinic.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, code: true, status: true, subscriptionPlan: true, createdAt: true },
      }),
    ]);

    const growthByMonth = await prisma.$queryRaw`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
             COUNT(*)::int AS clinics
      FROM clinics
      WHERE "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    `;

    const dailyActivityLast30 = await prisma.$queryRaw`
      WITH days AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW()) - INTERVAL '29 days',
          DATE_TRUNC('day', NOW()),
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT TO_CHAR(d, 'YYYY-MM-DD') AS date,
        COALESCE((SELECT COUNT(*) FROM prescriptions WHERE DATE_TRUNC('day', "createdAt")::date = d), 0)::int AS prescriptions,
        COALESCE((SELECT COUNT(*) FROM admissions    WHERE DATE_TRUNC('day', "createdAt")::date = d), 0)::int AS admissions,
        COALESCE((SELECT COUNT(*) FROM bills         WHERE DATE_TRUNC('day', "createdAt")::date = d), 0)::int AS bills
      FROM days
      ORDER BY date
    `;

    const topClinicsThisMonth = await prisma.$queryRaw`
      SELECT
        c.id, c.name, c.code,
        c."subscriptionPlan" AS plan,
        COALESCE(rx.cnt, 0)::int AS prescriptions,
        COALESCE(ad.cnt, 0)::int AS admissions,
        COALESCE(b.cnt,  0)::int AS bills,
        (COALESCE(rx.cnt, 0) + COALESCE(ad.cnt, 0) + COALESCE(b.cnt, 0))::int AS activity
      FROM clinics c
      LEFT JOIN (
        SELECT "clinicId", COUNT(*) AS cnt FROM prescriptions
        WHERE "createdAt" >= DATE_TRUNC('month', NOW()) GROUP BY "clinicId"
      ) rx ON rx."clinicId" = c.id
      LEFT JOIN (
        SELECT "clinicId", COUNT(*) AS cnt FROM admissions
        WHERE "createdAt" >= DATE_TRUNC('month', NOW()) GROUP BY "clinicId"
      ) ad ON ad."clinicId" = c.id
      LEFT JOIN (
        SELECT "clinicId", COUNT(*) AS cnt FROM bills
        WHERE "createdAt" >= DATE_TRUNC('month', NOW()) GROUP BY "clinicId"
      ) b ON b."clinicId" = c.id
      WHERE c.status = 'Active'
      ORDER BY activity DESC, c.name ASC
      LIMIT 5
    `;

    const [allActiveClinics, lastActivityRows] = await Promise.all([
      prisma.clinic.findMany({
        where: { status: 'Active' },
        select: { id: true, name: true, code: true, subscriptionPlan: true, createdAt: true },
      }),
      prisma.auditLog.groupBy({ by: ['clinicId'], _max: { createdAt: true } }),
    ]);

    const lastByClinic = {};
    for (const r of lastActivityRows) lastByClinic[r.clinicId] = r._max.createdAt;

    const dayMs = 24 * 60 * 60 * 1000;
    const decorated = allActiveClinics.map(c => {
      const last = lastByClinic[c.id] || null;
      const ref  = last || c.createdAt;
      const ageDays = Math.floor((now.getTime() - new Date(ref).getTime()) / dayMs);
      return {
        id: c.id, name: c.name, code: c.code,
        subscriptionPlan: c.subscriptionPlan,
        lastActivityAt: last,
        ageDays,
      };
    });

    const dormantOver7  = decorated.filter(c => c.ageDays >= 7 ).sort((a, b) => b.ageDays - a.ageDays);
    const dormantOver30 = decorated.filter(c => c.ageDays >= 30).sort((a, b) => b.ageDays - a.ageDays);

    return successResponse(res, {
      totalClinics,
      activeClinics,
      inactiveClinics: totalClinics - activeClinics,
      totalPatients,
      totalPrescriptions,
      totalAdmissions,
      totalBills,
      today: {
        patients: patientsToday, prescriptions: prescriptionsToday,
        admissions: admissionsToday, bills: billsToday,
      },
      byPlan,
      recentClinics,
      growthByMonth,
      dailyActivityLast30,
      topClinicsThisMonth,
      dormantClinics: { over7days: dormantOver7, over30days: dormantOver30 },
    });
  } catch (err) {
    console.error('SuperDashboard stats error:', err);
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
}

// ── Global audit logs (Super Admin) ──────────────────────
//
// Cross-clinic activity feed. Filters: clinicId, entity, action, userId,
// actorIsSuperAdmin, from, to, search. Cursor-paginated.
//
// In the new clinic-scoped UI the frontend always passes a clinicId.
// We still allow it to be omitted (returns all clinics) for flexibility.
async function getGlobalAuditLogs(req, res) {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const cursor = req.query.cursor || null;

    const where = {};
    if (req.query.clinicId) where.clinicId = req.query.clinicId;
    if (req.query.entity)   where.entity   = req.query.entity;
    if (req.query.action)   where.action   = req.query.action;
    if (req.query.userId)   where.userId   = req.query.userId;

    if (req.query.actorIsSuperAdmin === 'yes') where.actorIsSuperAdmin = true;
    if (req.query.actorIsSuperAdmin === 'no')  where.actorIsSuperAdmin = false;

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to)   where.createdAt.lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const s = String(req.query.search).trim();
      if (s) {
        where.OR = [
          { actorEmail: { contains: s, mode: 'insensitive' } },
          { action:     { contains: s, mode: 'insensitive' } },
          { entity:     { contains: s, mode: 'insensitive' } },
          { entityId:   { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        clinic: { select: { id: true, name: true, code: true } },
        user:   { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const hasMore    = logs.length > limit;
    const items      = hasMore ? logs.slice(0, -1) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return successResponse(res, { items, nextCursor, hasMore });
  } catch (err) {
    console.error('[getGlobalAuditLogs]', err);
    return errorResponse(res, 'Failed to fetch activity feed', 500);
  }
}

// ── Filter options for the activity feed UI ──────────────
//
// Returns:
//   - actions  : codes that exist (in scope) with counts
//   - entities : entity names that exist (in scope) with counts
//   - clinics  : full clinics list (with plan + status) for the picker
//
// If clinicId query param is provided, action/entity counts are scoped
// to that clinic so the dropdowns only show what's actually in that
// clinic's log. clinics list is always full.
async function getActivityFilters(req, res) {
  try {
    const clinicId = req.query.clinicId || null;
    const where = clinicId ? { clinicId } : {};

    const [actions, entities, clinics] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 50,
      }),
      prisma.auditLog.groupBy({
        by: ['entity'],
        where,
        _count: { entity: true },
        orderBy: { _count: { entity: 'desc' } },
        take: 50,
      }),
      prisma.clinic.findMany({
        select: {
          id: true, name: true, code: true,
          status: true, subscriptionPlan: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return successResponse(res, {
      actions:  actions.map(a => ({ value: a.action,  count: a._count.action  })),
      entities: entities.map(e => ({ value: e.entity, count: e._count.entity })),
      clinics,
    });
  } catch (err) {
    console.error('[getActivityFilters]', err);
    return errorResponse(res, 'Failed to fetch filter options', 500);
  }
}

module.exports = {
  createSuperAdmin,
  getDashboardStats,
  getGlobalAuditLogs,
  getActivityFilters,
};
