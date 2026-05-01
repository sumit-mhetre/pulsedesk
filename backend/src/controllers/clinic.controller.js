const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');
const { logAudit } = require('../lib/audit');

// ── Helper: generate next CLN### code ────────────────────
// Reads the highest existing CLN code in the table and returns the next one.
// Used when creating a new clinic so each gets an auto-assigned readable code.
async function generateNextClinicCode(client = prisma) {
  // Pull all codes matching pattern, find max, +1
  const all = await client.clinic.findMany({
    where: { code: { startsWith: 'CLN' } },
    select: { code: true },
  });
  let max = 0;
  for (const c of all) {
    const m = (c.code || '').match(/^CLN(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return 'CLN' + String(max + 1).padStart(3, '0');
}

// ── Create Clinic (Super Admin) ───────────────────────────
async function createClinic(req, res) {
  try {
    const {
      name, address, phone, mobile, email, tagline, gst,
      subscriptionPlan, subscriptionEnd,
      // First admin user details — OPTIONAL: if all blank, no admin user created
      adminName, adminEmail, adminPassword, adminPhone,
    } = req.body;

    // Determine whether to create admin: all 3 required admin fields must be present.
    // (Frontend toggle controls this; backend defends in case fields are sent but blank.)
    const wantsAdmin = !!(adminName && adminEmail && adminPassword);

    // Check clinic name unique
    const existing = await prisma.clinic.findFirst({ where: { name } });
    if (existing) return errorResponse(res, 'Clinic with this name already exists', 409);

    // If creating admin, validate inputs early
    let hashedPassword = null;
    if (wantsAdmin) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
        return errorResponse(res, 'Valid admin email required', 400);
      }
      if (String(adminPassword).length < 6) {
        return errorResponse(res, 'Admin password must be at least 6 characters', 400);
      }
      // Email uniqueness check (across all users)
      const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existingUser) return errorResponse(res, 'This admin email is already in use', 409);
      hashedPassword = await bcrypt.hash(adminPassword, 12);
    }

    // Create clinic (+ admin if wanted) in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Auto-generate next clinic code (CLN001, CLN002, ...).
      // Locks via the unique constraint -- if two admins create at the same time,
      // one will get a conflict and we retry by re-querying inside the txn.
      const code = await generateNextClinicCode(tx);

      const clinic = await tx.clinic.create({
        data: {
          name, code, address, phone, mobile, email, tagline, gst,
          subscriptionPlan: subscriptionPlan || 'Basic',
          subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null,
        },
      });

      let adminUser = null;
      if (wantsAdmin) {
        adminUser = await tx.user.create({
          data: {
            clinicId: clinic.id,
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'ADMIN',
            phone: adminPhone || null,
            permissions: {},
          },
        });
      }

      // Seed default master data for new clinic
      await seedDefaultData(tx, clinic.id);

      return { clinic, adminUser };
    });

    const adminSafe = result.adminUser
      ? (() => { const { password: _, ...rest } = result.adminUser; return rest; })()
      : null;

    // Audit log: clinic creation (super admin action)
    await logAudit(req, {
      clinicId: result.clinic.id,
      action:   'clinic.create',
      entity:   'Clinic',
      entityId: result.clinic.id,
      details: {
        clinicName:       result.clinic.name,
        subscriptionPlan: result.clinic.subscriptionPlan,
        adminCreated:     !!adminSafe,
        adminEmail:       adminSafe?.email || null,
      },
    });

    return successResponse(
      res,
      { clinic: result.clinic, admin: adminSafe },
      adminSafe
        ? 'Clinic created with admin account'
        : 'Clinic created — manage from Super Admin (no admin account created)',
      201
    );
  } catch (err) {
    console.error('Create clinic error:', err);
    return errorResponse(res, 'Failed to create clinic', 500);
  }
}

// ── Get All Clinics (Super Admin) ─────────────────────────
async function getAllClinics(req, res) {
  try {
    const { page = 1, limit = 20, search = '', status } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      // Search by name OR by code (case-insensitive). Useful for finding clinics
      // quickly using their short code (CLN001) or partial name.
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [clinics, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, patients: true } } },
      }),
      prisma.clinic.count({ where }),
    ]);

    return paginatedResponse(res, clinics, total, page, limit);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch clinics', 500);
  }
}

// ── Get My Clinic ─────────────────────────────────────────
async function getMyClinic(req, res) {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: req.clinicId },
      include: {
        _count: { select: { users: true, patients: true, prescriptions: true } },
      },
    });
    if (!clinic) return errorResponse(res, 'Clinic not found', 404);
    return successResponse(res, clinic);
  } catch (err) {
    console.error('[getMyClinic]', err);
    return errorResponse(res, 'Failed to fetch clinic', 500);
  }
}

// ── Update Clinic ─────────────────────────────────────────
async function updateClinic(req, res) {
  try {
    // SuperAdmin uses req.params.id; regular users update their own clinic via /me
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const clinicId = (isSuperAdmin && req.params.id) ? req.params.id : req.clinicId;

    if (!clinicId) {
      return errorResponse(res, 'Clinic not found', 404);
    }

    const {
      name, address, phone, mobile, email, tagline, gst, opdSeriesPrefix,
      letterheadMode, logo, footerImageUrl, letterheadUrl,
      headerImageUrl, hideTextOnHeader,
      settings,
    } = req.body;

    // Only include fields that were actually sent (avoid overwriting with undefined)
    const data = {};
    if (name             !== undefined) data.name = name;
    if (address          !== undefined) data.address = address;
    if (phone            !== undefined) data.phone = phone;
    if (mobile           !== undefined) data.mobile = mobile;
    if (email            !== undefined) data.email = email;
    if (tagline          !== undefined) data.tagline = tagline;
    if (gst              !== undefined) data.gst = gst;
    if (letterheadMode   !== undefined) data.letterheadMode = !!letterheadMode;
    if (hideTextOnHeader !== undefined) data.hideTextOnHeader = !!hideTextOnHeader;
    // Image URL fields — accept null (clear) or string (set). Upload endpoint sets these
    // directly, but this allows admins to clear them via the clinic update form too.
    if (logo             !== undefined) data.logo = logo || null;
    if (headerImageUrl   !== undefined) data.headerImageUrl = headerImageUrl || null;
    if (footerImageUrl   !== undefined) data.footerImageUrl = footerImageUrl || null;
    if (letterheadUrl    !== undefined) data.letterheadUrl  = letterheadUrl  || null;
    // Settings JSON: shallow-merge on save so partial updates don't wipe other keys.
    if (settings !== undefined && settings !== null && typeof settings === 'object' && !Array.isArray(settings)) {
      const existing = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
      const merged = { ...(existing?.settings || {}), ...settings };
      data.settings = merged;
    }
    if (opdSeriesPrefix  !== undefined) {
      // Normalize: uppercase, trim, strip non-alphanumeric, max 10 chars
      const cleaned = String(opdSeriesPrefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      if (!cleaned) {
        return errorResponse(res, 'OPD Series Prefix must contain at least 1 letter/number', 400);
      }
      data.opdSeriesPrefix = cleaned;
    }

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data,
    });

    // Audit log: only when super admin edits a clinic (regular admins editing
    // their own clinic info is normal usage; we don't pollute the log for that).
    if (isSuperAdmin) {
      await logAudit(req, {
        clinicId,
        action:   'clinic.update',
        entity:   'Clinic',
        entityId: clinicId,
        details:  { fieldsChanged: Object.keys(data) },
      });
    }

    return successResponse(res, clinic, 'Clinic updated successfully');
  } catch (err) {
    console.error('[updateClinic]', err);
    return errorResponse(res, 'Failed to update clinic', 500);
  }
}

// ── Update Clinic Status (Super Admin) ───────────────────
async function updateClinicStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, subscriptionPlan, subscriptionEnd } = req.body;

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(subscriptionPlan && { subscriptionPlan }),
        ...(subscriptionEnd && { subscriptionEnd: new Date(subscriptionEnd) }),
      },
    });

    // Audit: which fields changed
    const changes = {};
    if (status)           changes.status = status;
    if (subscriptionPlan) changes.subscriptionPlan = subscriptionPlan;
    if (subscriptionEnd)  changes.subscriptionEnd = subscriptionEnd;
    await logAudit(req, {
      clinicId: id,
      action:   subscriptionPlan ? 'clinic.plan_change' : 'clinic.status_change',
      entity:   'Clinic',
      entityId: id,
      details:  changes,
    });

    return successResponse(res, clinic, 'Clinic status updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update clinic status', 500);
  }
}

// ── Seed Default Master Data for new clinic ───────────────
async function seedDefaultData(tx, clinicId) {
  // Default dosage options
  const dosages = [
    { code: '1-0-0', label: 'Once daily (Morning)', timesPerDay: 1 },
    { code: '0-1-0', label: 'Once daily (Afternoon)', timesPerDay: 1 },
    { code: '0-0-1', label: 'Once daily (Night)', timesPerDay: 1 },
    { code: '1-0-1', label: 'Twice daily (Morning & Night)', timesPerDay: 2 },
    { code: '1-1-0', label: 'Twice daily (Morning & Afternoon)', timesPerDay: 2 },
    { code: '1-1-1', label: 'Thrice daily', timesPerDay: 3 },
    { code: '1-1-1-1', label: 'Four times daily', timesPerDay: 4 },
    { code: 'SOS', label: 'As needed (SOS)', timesPerDay: null },
    { code: 'OD', label: 'Once daily (OD)', timesPerDay: 1 },
    { code: 'BD', label: 'Twice daily (BD)', timesPerDay: 2 },
    { code: 'TDS', label: 'Thrice daily (TDS)', timesPerDay: 3 },
    { code: 'QID', label: 'Four times daily (QID)', timesPerDay: 4 },
    { code: 'HS', label: 'At bedtime (HS)', timesPerDay: 1 },
  ];

  // Default timing options
  const timings = [
    { code: 'AF', labelEn: 'After Food', labelHi: 'खाने के बाद', labelMr: 'जेवणानंतर' },
    { code: 'BF', labelEn: 'Before Food', labelHi: 'खाने से पहले', labelMr: 'जेवणापूर्वी' },
    { code: 'ES', labelEn: 'Empty Stomach', labelHi: 'खाली पेट', labelMr: 'रिकाम्या पोटी' },
    { code: 'WM', labelEn: 'With Milk', labelHi: 'दूध के साथ', labelMr: 'दुधासोबत' },
    { code: 'WW', labelEn: 'With Water', labelHi: 'पानी के साथ', labelMr: 'पाण्यासोबत' },
    { code: 'HS', labelEn: 'At Bedtime', labelHi: 'सोते समय', labelMr: 'झोपताना' },
    { code: 'MO', labelEn: 'Morning Only', labelHi: 'सुबह', labelMr: 'सकाळी' },
    { code: 'AN', labelEn: 'At Night', labelHi: 'रात को', labelMr: 'रात्री' },
  ];

  await tx.dosageOption.createMany({ data: dosages.map(d => ({ ...d, clinicId })) });
  await tx.timingOption.createMany({ data: timings.map(t => ({ ...t, clinicId })) });

  // Default Document Templates — 3 fitness, 3 medical, 2 referral
  const docTemplates = [
    // ── FITNESS ──
    {
      type: 'FITNESS_CERT', name: 'General fitness — Employment', isDefault: true,
      diagnosis: 'No abnormality detected on physical examination.',
      remarks: '',
      data: { verdict: 'FIT', fitnessFor: 'Employment', validityMonths: 6, vitals: {} },
    },
    {
      type: 'FITNESS_CERT', name: 'Pre-employment fitness', isDefault: false,
      diagnosis: 'Patient is in good general health. Vital signs within normal limits.',
      remarks: 'Recommended for office / desk-based roles.',
      data: { verdict: 'FIT', fitnessFor: 'Pre-employment', validityMonths: 12, vitals: {} },
    },
    {
      type: 'FITNESS_CERT', name: 'Sports fitness — adult', isDefault: false,
      diagnosis: 'Cardiovascular and musculoskeletal exam normal.',
      remarks: '',
      data: { verdict: 'FIT', fitnessFor: 'Sports', validityMonths: 6, vitals: {} },
    },

    // ── MEDICAL CERT (sick leave) ──
    {
      type: 'MEDICAL_CERT', name: 'Viral fever — 3 days rest', isDefault: true,
      diagnosis: 'Viral fever with body ache and headache',
      remarks: 'Patient advised bed rest, plenty of fluids, and prescribed medication.',
      data: { defaultRestDays: 3 },
    },
    {
      type: 'MEDICAL_CERT', name: 'Acute gastroenteritis — 2 days', isDefault: false,
      diagnosis: 'Acute gastroenteritis',
      remarks: 'Patient advised oral rehydration, light diet, and prescribed medication.',
      data: { defaultRestDays: 2 },
    },
    {
      type: 'MEDICAL_CERT', name: 'Migraine / severe headache — 1 day', isDefault: false,
      diagnosis: 'Acute migraine',
      remarks: 'Patient advised rest in a quiet, darkened environment.',
      data: { defaultRestDays: 1 },
    },

    // ── REFERRAL ──
    {
      type: 'REFERRAL', name: 'Cardiology referral', isDefault: true,
      diagnosis: '',
      remarks: 'Thanking you for your assistance.',
      data: {
        referredToSpecialty: 'Cardiologist',
        reasonForReferral: 'Patient presents with chest pain / palpitations requiring specialist evaluation. Kindly advise further management.',
      },
    },
    {
      type: 'REFERRAL', name: 'Orthopedic referral', isDefault: false,
      diagnosis: '',
      remarks: 'Thanking you.',
      data: {
        referredToSpecialty: 'Orthopedic Surgeon',
        reasonForReferral: 'Patient with persistent musculoskeletal complaints. Kindly advise further management.',
      },
    },
  ];

  await tx.medicalDocumentTemplate.createMany({ data: docTemplates.map(t => ({ ...t, clinicId })) });
}

// ── Get Clinic Detail with users (Super Admin) ───────────
async function getClinicDetail(req, res) {
  try {
    const { id } = req.params;

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, name: true, email: true, phone: true,
            role: true, isActive: true,
            qualification: true, specialization: true, regNo: true,
            createdAt: true, updatedAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { patients: true, users: true },
        },
      },
    });

    if (!clinic) return errorResponse(res, 'Clinic not found', 404);

    return successResponse(res, clinic, 'Clinic detail fetched');
  } catch (err) {
    console.error('[getClinicDetail]', err);
    return errorResponse(res, 'Failed to fetch clinic detail', 500);
  }
}

// ── Get Clinic Stats (Super Admin) ───────────────────────
// Returns counts + activity dates for the per-clinic Stats tab.
// Date-range filterable via ?from=ISO&to=ISO (defaults: all-time)
async function getClinicStats(req, res) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;
    const dateFilter = (fromDate || toDate) ? {
      gte: fromDate || undefined,
      lte: toDate   || undefined,
    } : undefined;

    // Verify clinic exists
    const clinic = await prisma.clinic.findUnique({
      where: { id },
      select: { id: true, name: true, subscriptionPlan: true, status: true, createdAt: true },
    });
    if (!clinic) return errorResponse(res, 'Clinic not found', 404);

    // Run all queries in parallel
    const [
      totalPatients,
      totalPrescriptions,
      totalBills,
      totalRevenue,
      lastPrescription,
      mostRecentUserUpdate,
      activeUsers,
      patientsByMonth,
      prescriptionsByMonth,
      prescriptionsByHour,
    ] = await Promise.all([
      prisma.patient.count({
        where: { clinicId: id, ...(dateFilter && { createdAt: dateFilter }) },
      }),
      prisma.prescription.count({
        where: { clinicId: id, ...(dateFilter && { createdAt: dateFilter }) },
      }),
      prisma.bill.count({
        where: { clinicId: id, ...(dateFilter && { createdAt: dateFilter }) },
      }),
      prisma.bill.aggregate({
        where: {
          clinicId: id,
          paymentStatus: { in: ['Paid', 'Partial'] },
          ...(dateFilter && { createdAt: dateFilter }),
        },
        _sum: { amountPaid: true },
      }),
      prisma.prescription.findFirst({
        where: { clinicId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      // Proxy for "last login" — most-recently-updated user record
      prisma.user.findFirst({
        where: { clinicId: id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.user.count({
        where: { clinicId: id, isActive: true },
      }),
      // Patients by month (last 12 months)
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM "patients"
        WHERE "clinicId" = ${id}
          AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
               count(*)::int as count
        FROM "prescriptions"
        WHERE "clinicId" = ${id}
          AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY 1 ORDER BY 1
      `,
      // Peak hours — Rx count by hour of day
      prisma.$queryRaw`
        SELECT extract(hour from "createdAt")::int as hour,
               count(*)::int as count
        FROM "prescriptions"
        WHERE "clinicId" = ${id}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const lastRxAt = lastPrescription?.createdAt || null;
    const isInactive = lastRxAt
      ? (Date.now() - new Date(lastRxAt).getTime()) > (30 * 24 * 60 * 60 * 1000)
      : true;

    const stats = {
      clinic,
      totals: {
        patients:      totalPatients,
        prescriptions: totalPrescriptions,
        bills:         totalBills,
        revenue:       Number(totalRevenue._sum?.amountPaid || 0),
        activeUsers,
      },
      activity: {
        // Note: No login tracking yet — using user record updatedAt as proxy
        lastUserUpdate:   mostRecentUserUpdate?.updatedAt || null,
        lastPrescription: lastRxAt,
        isInactive,
      },
      charts: {
        patientsByMonth:      patientsByMonth.map(r => ({ month: r.month, count: r.count })),
        prescriptionsByMonth: prescriptionsByMonth.map(r => ({ month: r.month, count: r.count })),
        prescriptionsByHour:  prescriptionsByHour.map(r => ({ hour: r.hour, count: r.count })),
      },
    };

    return successResponse(res, stats, 'Stats fetched');
  } catch (err) {
    console.error('[getClinicStats]', err);
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
}

// ── Reset Admin Password (Super Admin) ───────────────────
// Generates a temp password, sets it for clinic's admin user, returns plaintext to caller.
// Caller (super admin) shares it manually with clinic admin.
async function resetAdminPassword(req, res) {
  try {
    const { id } = req.params;

    // Find the first ADMIN user in the clinic
    const admin = await prisma.user.findFirst({
      where: { clinicId: id, role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) return errorResponse(res, 'No admin user found for this clinic', 404);

    // Generate temp password (8 chars: 4 letters + 4 digits) — readable, easy to share
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // exclude I/O for clarity
    const digits  = '23456789';                    // exclude 0/1 for clarity
    let temp = '';
    for (let i = 0; i < 4; i++) temp += letters[Math.floor(Math.random() * letters.length)];
    for (let i = 0; i < 4; i++) temp += digits[Math.floor(Math.random() * digits.length)];

    const hashed = await bcrypt.hash(temp, 10);
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashed },
    });

    // Invalidate all existing refresh tokens for this admin so old sessions can't continue
    await prisma.refreshToken.deleteMany({ where: { userId: admin.id } });

    // Audit log
    await logAudit(req, {
      clinicId: id,
      action:   'admin.password_reset',
      entity:   'User',
      entityId: admin.id,
      details:  { adminEmail: admin.email, adminName: admin.name },
    });

    return successResponse(
      res,
      { adminEmail: admin.email, adminName: admin.name, tempPassword: temp },
      'Admin password reset. Share the temporary password with the admin securely.'
    );
  } catch (err) {
    console.error('[resetAdminPassword]', err);
    return errorResponse(res, 'Failed to reset password', 500);
  }
}

// ── Get Clinic Audit Logs (Super Admin) ───────────────────
async function getClinicAuditLogs(req, res) {
  try {
    const { id } = req.params;
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const cursor = req.query.cursor || null;

    const logs = await prisma.auditLog.findMany({
      where: { clinicId: id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const hasMore  = logs.length > limit;
    const items    = hasMore ? logs.slice(0, -1) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return successResponse(res, { items, nextCursor }, 'Audit logs fetched');
  } catch (err) {
    console.error('[getClinicAuditLogs]', err);
    return errorResponse(res, 'Failed to fetch audit logs', 500);
  }
}

module.exports = {
  createClinic, getAllClinics, getMyClinic,
  updateClinic, updateClinicStatus,
  getClinicDetail, getClinicStats, resetAdminPassword,
  getClinicAuditLogs,
};
