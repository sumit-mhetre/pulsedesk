const { audit } = require('../middleware/audit.middleware');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../lib/jwt');
const { successResponse, errorResponse } = require('../lib/response');
const { resolvePermissions } = require('../lib/permissions');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : email;
    console.log(`[LOGIN] attempt for: "${emailNorm}"`);

    // Check super admin first
    const superAdmin = await prisma.superAdmin.findUnique({ where: { email: emailNorm } });
    if (superAdmin) {
      const valid = await bcrypt.compare(password, superAdmin.password);
      console.log(`[LOGIN] super admin path — password valid: ${valid}`);
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
      where: { email: emailNorm },
      // Clinic include MUST mirror the auth middleware's include so the user
      // object returned at login matches what /auth/me returns later. If we
      // omit fields here, the frontend's first render after login is missing
      // them and gates like `clinic.ipdEnabled` evaluate to false until the
      // page reloads. This caused the "IPD section only appears after refresh"
      // bug — the data simply wasn't in the login payload.
      include: { clinic: { select: { id: true, name: true, logo: true, headerImageUrl: true, hideTextOnHeader: true, footerImageUrl: true, letterheadUrl: true, letterheadMode: true, status: true, subscriptionPlan: true, settings: true, facilityType: true, ipdEnabled: true, ipdSettings: true } } },
    });

    if (!user) {
      console.log(`[LOGIN] no user found for "${emailNorm}"`);
      return errorResponse(res, 'Invalid credentials', 401);
    }
    console.log(`[LOGIN] user found: ${user.email}, active=${user.isActive}, role=${user.role}, clinicStatus=${user.clinic?.status}`);
    if (!user.isActive) return errorResponse(res, 'Account deactivated. Contact admin.', 403);
    if (user.clinic.status !== 'Active') return errorResponse(res, 'Clinic is not active', 403);

    const valid = await bcrypt.compare(password, user.password);
    console.log(`[LOGIN] password valid: ${valid}`);
    if (!valid) return errorResponse(res, 'Invalid credentials', 401);

    const payload = { id: user.id, clinicId: user.clinicId, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token — non-blocking, won't crash login if DB issue
    prisma.refreshToken.upsert({
      where: { token: refreshToken },
      create: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + 7*24*60*60*1000) },
      update: { userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) },
    }).catch(err => console.error('RefreshToken save error (non-fatal):', err.message));

    const { password: _, ...userSafe } = user;
    userSafe.permissions = resolvePermissions(user);
    // Audit login
    req.clinicId = user.clinicId; req.user = user;
    audit(req, 'LOGIN', 'user', user.id, { email: user.email, role: user.role })
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
    audit(req, 'LOGOUT', 'user', req.user?.id)
    return successResponse(res, null, 'Logged out successfully');
  } catch {
    return successResponse(res, null, 'Logged out');
  }
}

async function getMe(req, res) {
  try {
    const { password: _, ...userSafe } = req.user;
    userSafe.permissions = resolvePermissions(req.user);
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

// ── Forgot Password ──────────────────────────────────────────
// Always returns success (even if email doesn't exist) to prevent email enumeration.
// Generates a 1-hour token. Since we don't have email service yet, the reset URL
// is logged to the server console — admin/dev can copy it from Render logs.
// SuperAdmin accounts NOT supported here (separate recovery path via direct DB).
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return errorResponse(res, 'Email is required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always wait briefly to prevent timing-based email enumeration
    await new Promise(r => setTimeout(r, 300));

    if (user && user.isActive) {
      // Invalidate any previous unused tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data:  { usedAt: new Date() },
      });

      // Generate cryptographically-random token — 48 hex chars = 192 bits of entropy
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      // Build reset URL — FRONTEND_URL falls back to request origin
      const frontendUrl = process.env.FRONTEND_URL
        || req.headers.origin
        || req.headers.referer?.replace(/\/[^/]*$/, '')
        || 'https://www.simplerxemr.com';
      const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

      // Log the reset link (until email service is integrated).
      // Readable in Render logs: Dashboard → Service → Logs
      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('  PASSWORD RESET REQUESTED');
      console.log(`  User:  ${user.email}  (${user.name})`);
      console.log(`  Link:  ${resetUrl}`);
      console.log(`  Token expires: ${expiresAt.toISOString()}  (1 hour)`);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');
    }

    // Uniform response either way
    return successResponse(res, null,
      'If an account exists for that email, a reset link has been generated. Contact your administrator if you do not receive it.');
  } catch (err) {
    console.error('[forgotPassword]', err);
    return errorResponse(res, 'Failed to process password reset', 500);
  }
}

// ── Reset Password ──────────────────────────────────────────
// Takes token + newPassword, sets the new password, invalidates all sessions.
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return errorResponse(res, 'Token and new password are required', 400);
    }
    if (newPassword.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters', 400);
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      return errorResponse(res, 'Invalid or expired reset link', 400);
    }
    if (record.usedAt) {
      return errorResponse(res, 'This reset link has already been used', 400);
    }
    if (record.expiresAt < new Date()) {
      return errorResponse(res, 'This reset link has expired. Please request a new one.', 400);
    }
    if (!record.user.isActive) {
      return errorResponse(res, 'Account deactivated. Contact admin.', 403);
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // Atomic: update password, mark token used, invalidate refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data:  { password: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data:  { usedAt: new Date() },
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);

    // Audit (best-effort, shouldn't block response)
    try {
      req.clinicId = record.user.clinicId; req.user = record.user;
      audit(req, 'PASSWORD_RESET', 'user', record.userId, { email: record.user.email });
    } catch {}

    return successResponse(res, null, 'Password reset successful. You can now log in with your new password.');
  } catch (err) {
    console.error('[resetPassword]', err);
    return errorResponse(res, 'Failed to reset password', 500);
  }
}

module.exports = { login, refreshToken, logout, getMe, changePassword, forgotPassword, resetPassword };
