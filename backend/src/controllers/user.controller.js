const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');
const { sanitizeOverrides, resolvePermissions, PERMISSION_KEYS } = require('../lib/permissions');

// ── Get all users in clinic ───────────────────────────────
async function getUsers(req, res) {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const skip = (page - 1) * limit;

    const where = { clinicId: req.clinicId };
    if (role) where.role = role;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, email: true, role: true,
          phone: true, qualification: true, specialization: true,
          regNo: true, isActive: true, permissions: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(res, users, total, page, limit);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch users', 500);
  }
}

// ── Get single user ───────────────────────────────────────
async function getUser(req, res) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, qualification: true, specialization: true,
        regNo: true, signature: true, isActive: true,
        permissions: true, createdAt: true,
      },
    });
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, user);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch user', 500);
  }
}

// ── Create user (doctor / receptionist) ──────────────────
async function createUser(req, res) {
  try {
    const {
      name, email, password, role, phone,
      qualification, specialization, regNo, permissions,
    } = req.body;

    // Check email unique within clinic
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) return errorResponse(res, 'Email already registered in this clinic', 409);

    const hashed = await bcrypt.hash(password, 12);

    const userRole = role || 'DOCTOR';
    const overrides = sanitizeOverrides(userRole, permissions);

    const user = await prisma.user.create({
      data: {
        clinicId: req.clinicId,
        name, email, password: hashed,
        role: userRole,
        phone, qualification, specialization, regNo,
        permissions: overrides,
      },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, qualification: true, specialization: true,
        regNo: true, isActive: true, permissions: true, createdAt: true,
      },
    });

    return successResponse(res, user, 'User created successfully', 201);
  } catch (err) {
    console.error('Create user error:', err);
    return errorResponse(res, 'Failed to create user', 500);
  }
}

// ── Update user ───────────────────────────────────────────
async function updateUser(req, res) {
  try {
    const {
      name, phone, qualification, specialization,
      regNo, permissions, isActive, role,
    } = req.body;

    // Ensure user belongs to same clinic
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'User not found', 404);

    // Determine the role after update (role can be changed in the same request)
    const newRole = role || existing.role;

    // Sanitize incoming permission overrides against the target role's defaults.
    // Only set when permissions key is explicitly present in the request body.
    let permsOverride;
    if (permissions !== undefined) {
      permsOverride = sanitizeOverrides(newRole, permissions);

      // Safety rail: prevent admin from removing their own Manage Users permission
      // (would lock themselves out).
      if (req.user && req.user.id === req.params.id) {
        const resolvedNext = resolvePermissions({ role: newRole, permissions: permsOverride });
        if (!resolvedNext.manageUsers) {
          return errorResponse(res,
            'You cannot remove your own "Manage Users" permission — it would lock you out.', 400);
        }
      }
    }

    // Safety rail: prevent deactivating yourself
    if (isActive === false && req.user && req.user.id === req.params.id) {
      return errorResponse(res, 'You cannot deactivate your own account.', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(qualification !== undefined && { qualification }),
        ...(specialization !== undefined && { specialization }),
        ...(regNo !== undefined && { regNo }),
        ...(permsOverride !== undefined && { permissions: permsOverride }),
        ...(isActive !== undefined && { isActive }),
        ...(role && { role }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, qualification: true, specialization: true,
        regNo: true, isActive: true, permissions: true,
      },
    });

    return successResponse(res, user, 'User updated successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to update user', 500);
  }
}

// ── Reset password (admin action) ────────────────────────
async function resetUserPassword(req, res) {
  try {
    const { newPassword } = req.body;

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing) return errorResponse(res, 'User not found', 404);

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });

    // Invalidate refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });

    return successResponse(res, null, 'Password reset successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to reset password', 500);
  }
}

// ── Update my profile ─────────────────────────────────────
async function updateMyProfile(req, res) {
  try {
    const { name, phone, qualification, specialization, regNo } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(qualification !== undefined && { qualification }),
        ...(specialization !== undefined && { specialization }),
        ...(regNo !== undefined && { regNo }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, qualification: true, specialization: true,
        regNo: true, isActive: true, permissions: true,
      },
    });

    return successResponse(res, user, 'Profile updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update profile', 500);
  }
}

// ── Get all doctors (for dropdowns) ──────────────────────
async function getDoctors(req, res) {
  try {
    const doctors = await prisma.user.findMany({
      where: {
        clinicId: req.clinicId,
        role: { in: ['DOCTOR', 'ADMIN'] },
        isActive: true,
      },
      select: {
        id: true, name: true, qualification: true,
        specialization: true, regNo: true,
      },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, doctors);
  } catch (err) {
    return errorResponse(res, 'Failed to fetch doctors', 500);
  }
}

// ── Permissions metadata — for the admin UI to render the checkboxes ──
async function getPermissionsMeta(req, res) {
  try {
    const { ROLE_DEFAULTS } = require('../lib/permissions');
    // Pretty labels + grouping for the admin UI. Keep in sync with frontend.
    const groups = [
      {
        label: 'Clinical',
        keys: ['viewDashboard','managePatients','manageQueue','viewPrescriptions','createPrescriptions','viewReports','manageTemplates'],
      },
      {
        label: 'Billing',
        keys: ['viewBilling','createBilling'],
      },
      {
        label: 'Administration',
        keys: ['manageMasterData','manageSettings','manageUsers'],
      },
    ];
    const labels = {
      viewDashboard: 'View Dashboard',
      managePatients: 'Manage Patients',
      manageQueue: 'Manage Queue',
      viewPrescriptions: 'View Prescriptions',
      createPrescriptions: 'Create / Edit Prescriptions',
      viewBilling: 'View Billing',
      createBilling: 'Create / Edit Bills',
      viewReports: 'View Reports',
      manageTemplates: 'Manage Templates',
      manageMasterData: 'Manage Master Data',
      manageSettings: 'Manage Settings',
      manageUsers: 'Manage Users',
    };
    return successResponse(res, { keys: PERMISSION_KEYS, labels, groups, roleDefaults: ROLE_DEFAULTS });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch permissions metadata', 500);
  }
}

module.exports = {
  getUsers, getUser, createUser, updateUser,
  resetUserPassword, updateMyProfile, getDoctors,
  getPermissionsMeta,
};
