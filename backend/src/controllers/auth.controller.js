const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../lib/jwt');
const { successResponse, errorResponse } = require('../lib/response');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Check super admin first
    const superAdmin = await prisma.superAdmin.findUnique({ where: { email } });
    if (superAdmin) {
      const valid = await bcrypt.compare(password, superAdmin.password);
      if (!valid) return errorResponse(res, 'Invalid credentials', 401);
      const payload = { id: superAdmin.id, role: 'SUPER_ADMIN' };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      return successResponse(res, {
        accessToken, refreshToken,
        user: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email, role: 'SUPER_ADMIN' },
      }, 'Login successful');
    }

    // Clinic user — email globally unique
    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: { select: { id: true, name: true, logo: true, status: true, subscriptionPlan: true } } },
    });

    if (!user) return errorResponse(res, 'Invalid credentials', 401);
    if (!user.isActive) return errorResponse(res, 'Account deactivated. Contact admin.', 403);
    if (user.clinic.status !== 'Active') return errorResponse(res, 'Clinic is not active', 403);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return errorResponse(res, 'Invalid credentials', 401);

    const payload = { id: user.id, clinicId: user.clinicId, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7*24*60*60*1000) },
    });

    const { password: _, ...userSafe } = user;
    return successResponse(res, { accessToken, refreshToken, user: userSafe }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(res, 'Login failed', 500);
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return errorResponse(res, 'Refresh token required', 401);
    const decoded = verifyToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) return errorResponse(res, 'Invalid refresh token', 401);
    if (stored.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { token } });
      return errorResponse(res, 'Refresh token expired', 401);
    }
    const payload = { id: decoded.id, clinicId: decoded.clinicId, role: decoded.role };
    const newAccessToken = generateAccessToken(payload);
    return successResponse(res, { accessToken: newAccessToken }, 'Token refreshed');
  } catch {
    return errorResponse(res, 'Invalid refresh token', 401);
  }
}

async function logout(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });
    return successResponse(res, null, 'Logged out successfully');
  } catch {
    return successResponse(res, null, 'Logged out');
  }
}

async function getMe(req, res) {
  try {
    const { password: _, ...userSafe } = req.user;
    return successResponse(res, userSafe);
  } catch {
    return errorResponse(res, 'Failed to get profile', 500);
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return errorResponse(res, 'User not found', 404);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return errorResponse(res, 'Current password is incorrect', 400);
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });
    return successResponse(res, null, 'Password changed successfully');
  } catch {
    return errorResponse(res, 'Failed to change password', 500);
  }
}

module.exports = { login, refreshToken, logout, getMe, changePassword };
