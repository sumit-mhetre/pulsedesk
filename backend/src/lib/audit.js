// Centralised audit logging helper - keeps controllers simple.
// Usage: await logAudit(req, { clinicId, action, entity, entityId, details })
// - For super-admin actions: req.user.role === 'SUPER_ADMIN' → flagged + actorEmail captured
// - For regular user actions: userId captured from req.user.id
// All audit writes are best-effort (errors logged but never break the request).

const prisma = require('./prisma');

async function logAudit(req, { clinicId, action, entity, entityId = null, details = null }) {
  try {
    if (!clinicId) {
      console.warn('[audit] missing clinicId - skipping');
      return;
    }
    const isSuper = req?.user?.role === 'SUPER_ADMIN';
    await prisma.auditLog.create({
      data: {
        clinicId,
        userId:            isSuper ? null : (req?.user?.id || null),
        actorEmail:        req?.user?.email || null,
        actorIsSuperAdmin: !!isSuper,
        action:            String(action),
        entity:            String(entity),
        entityId:          entityId ? String(entityId) : null,
        details:           details ? JSON.parse(JSON.stringify(details)) : null,
        ip:                req?.ip || req?.headers?.['x-forwarded-for'] || null,
      },
    });
  } catch (err) {
    // Never let audit failures break the actual request
    console.error('[audit] failed to log:', err?.message);
  }
}

module.exports = { logAudit };
