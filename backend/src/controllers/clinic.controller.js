const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

// ── Create Clinic (Super Admin) ───────────────────────────
async function createClinic(req, res) {
  try {
    const {
      name, address, phone, mobile, email, tagline, gst,
      subscriptionPlan, subscriptionEnd,
      // First admin user details
      adminName, adminEmail, adminPassword, adminPhone,
    } = req.body;

    // Check clinic name unique
    const existing = await prisma.clinic.findFirst({ where: { name } });
    if (existing) return errorResponse(res, 'Clinic with this name already exists', 409);

    // Hash admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create clinic + admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name, address, phone, mobile, email, tagline, gst,
          subscriptionPlan: subscriptionPlan || 'Basic',
          subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          clinicId: clinic.id,
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          phone: adminPhone,
          permissions: {},
        },
      });

      // Seed default master data for new clinic
      await seedDefaultData(tx, clinic.id);

      return { clinic, adminUser };
    });

    const { adminUser: { password: _, ...adminSafe }, clinic } = result;

    return successResponse(res, { clinic, admin: adminSafe }, 'Clinic created successfully', 201);
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
    if (search) where.name = { contains: search, mode: 'insensitive' };
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

    const { name, address, phone, mobile, email, tagline, gst, opdSeriesPrefix } = req.body;

    // Only include fields that were actually sent (avoid overwriting with undefined)
    const data = {};
    if (name             !== undefined) data.name = name;
    if (address          !== undefined) data.address = address;
    if (phone            !== undefined) data.phone = phone;
    if (mobile           !== undefined) data.mobile = mobile;
    if (email            !== undefined) data.email = email;
    if (tagline          !== undefined) data.tagline = tagline;
    if (gst              !== undefined) data.gst = gst;
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
}

module.exports = {
  createClinic, getAllClinics, getMyClinic,
  updateClinic, updateClinicStatus,
};
