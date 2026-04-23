const { verifyToken } = require('../lib/jwt');
const { errorResponse } = require('../lib/response');
const prisma = require('../lib/prisma');

// Verify JWT and attach user to request
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Fetch fresh user from DB
    let user = null;

    if (decoded.role === 'SUPER_ADMIN') {
      user = await prisma.superAdmin.findUnique({ where: { id: decoded.id } });
      if (!user) return errorResponse(res, 'User not found', 401);
      req.user = { ...user, role: 'SUPER_ADMIN', isSuperAdmin: true };
    } else {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { clinic: { select: { id: true, name: true, status: true, subscriptionPlan: true } } },
      });

      if (!user || !user.isActive) return errorResponse(res, 'User not found or inactive', 401);
      if (user.clinic.status !== 'Active') return errorResponse(res, 'Clinic is not active', 403);

      req.user = user;
      req.clinicId = user.clinicId;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return errorResponse(res, 'Token expired', 401);
    if (err.name === 'JsonWebTokenError') return errorResponse(res, 'Invalid token', 401);
    return errorResponse(res, 'Authentication failed', 401);
  }
}

// Role-based authorization
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
}

// Check specific permission — respects role defaults + per-user overrides.
// SuperAdmin always passes. ADMIN/DOCTOR/RECEPTIONIST are resolved via permissions lib.
const { userCan } = require('../lib/permissions');

function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return errorResponse(res, 'Authentication required', 401);
    if (userCan(user, permission)) return next();
    // Include the missing permission so frontend can show a specific message
    return errorResponse(res, `You do not have permission: ${permission}`, 403, { missingPermission: permission });
  };
}

// Backward-compatible alias — older code uses hasPermission(...)
const hasPermission = requirePermission;

// Ensure user belongs to the clinic they're accessing
function sameClinic(req, res, next) {
  const clinicId = req.params.clinicId || req.body.clinicId || req.query.clinicId;
  if (req.user.isSuperAdmin) return next();
  if (clinicId && clinicId !== req.clinicId) {
    return errorResponse(res, 'Access denied to this clinic', 403);
  }
  next();
}

module.exports = { authenticate, authorize, hasPermission, requirePermission, sameClinic };
