const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// ── Create Super Admin (one time setup) ──────────────────
async function createSuperAdmin(req, res) {
  try {
    const { name, email, password, setupKey } = req.body;

    // Protect with a setup key
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
    const [totalClinics, activeClinics, totalPatients, totalPrescriptions] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { status: 'Active' } }),
      prisma.patient.count(),
      prisma.prescription.count(),
    ]);

    // Clinics by subscription plan
    const byPlan = await prisma.clinic.groupBy({
      by: ['subscriptionPlan'],
      _count: { id: true },
    });

    // Recent clinics
    const recentClinics = await prisma.clinic.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, subscriptionPlan: true, createdAt: true },
    });

    return successResponse(res, {
      totalClinics,
      activeClinics,
      inactiveClinics: totalClinics - activeClinics,
      totalPatients,
      totalPrescriptions,
      byPlan,
      recentClinics,
    });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
}

module.exports = { createSuperAdmin, getDashboardStats };
