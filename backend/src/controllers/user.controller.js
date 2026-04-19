const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../lib/response');

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

    const user = await prisma.user.create({
      data: {
        clinicId: req.clinicId,
        name, email, password: hashed,
        role: role || 'DOCTOR',
        phone, qualification, specialization, regNo,
        permissions: permissions || {},
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

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(qualification !== undefined && { qualification }),
        ...(specialization !== undefined && { specialization }),
        ...(regNo !== undefined && { regNo }),
        ...(permissions !== undefined && { permissions }),
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

module.exports = {
  getUsers, getUser, createUser, updateUser,
  resetUserPassword, updateMyProfile, getDoctors,
};
