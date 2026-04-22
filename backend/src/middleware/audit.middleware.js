const prisma = require('../lib/prisma')

// ── Audit log helper ──────────────────────────────────────
async function audit(req, action, entity, entityId = null, details = null) {
  try {
    if (!req.clinicId) return  // skip unauthenticated
    await prisma.auditLog.create({
      data: {
        clinicId: req.clinicId,
        userId:   req.user?.id || null,
        action,               // CREATE | READ | UPDATE | DELETE | LOGIN | LOGOUT
        entity,               // patient | prescription | bill | user | clinic
        entityId: entityId ? String(entityId) : null,
        details:  details || null,
        ip:       req.ip || req.headers['x-forwarded-for'] || null,
      }
    })
  } catch (err) {
    // Non-blocking — never crash the main request
    console.error('Audit log error:', err.message)
  }
}

// ── Audit middleware — auto-logs all mutating requests ────
function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res)

  res.json = function (data) {
    // Only log successful mutations
    if (req.method !== 'GET' && res.statusCode < 400) {
      const parts   = req.path.split('/').filter(Boolean)
      const entity  = parts[0] || 'unknown'
      const entityId = parts[1] || data?.data?.id || null
      const actionMap = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }
      const action  = actionMap[req.method] || req.method

      // Don't log sensitive fields
      const safeBody = { ...req.body }
      delete safeBody.password
      delete safeBody.currentPassword
      delete safeBody.newPassword

      audit(req, action, entity, entityId, Object.keys(safeBody).length ? safeBody : null)
    }
    return originalJson(data)
  }
  next()
}

// ── Get audit logs ────────────────────────────────────────
async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 50, entity, action, userId } = req.query
    const where = { clinicId: req.clinicId }
    if (entity) where.entity = entity
    if (action) where.action = action
    if (userId) where.userId = userId

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where })
    ])

    return res.json({
      success: true,
      data: logs,
      meta: { total, page: parseInt(page), limit: parseInt(limit) }
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch logs' })
  }
}

module.exports = { audit, auditMiddleware, getAuditLogs }
