// IPD permission middleware. Two-layer gate:
//   1. Clinic must have ipdEnabled = true (Super Admin controls this)
//   2. User must hold the specific IPD permission (e.g. manageBeds)
//
// SuperAdmin always passes both checks since they manage the platform.
//
// Use as: router.get('/path', authenticate, requireIPD('manageBeds'), ctrl.handler)

const { errorResponse } = require('../lib/response')
const permissionsLib = require('../lib/permissions')

function requireIPD(permission) {
  return (req, res, next) => {
    const user = req.user
    if (!user) return errorResponse(res, 'Authentication required', 401)

    // SuperAdmin bypasses all checks (also skips clinic.ipdEnabled gate so they can
    // configure IPD on a clinic before it's actually enabled).
    if (user.role === 'SUPER_ADMIN') return next()

    // Check IPD enabled at clinic level — req.user.clinic comes from auth middleware
    // which now includes ipdEnabled + facilityType after the IPD module rollout.
    if (!user.clinic?.ipdEnabled) {
      return errorResponse(res, 'IPD module not enabled for this clinic', 403, {
        ipdDisabled: true,
      })
    }

    // Defer to standard permission resolution
    if (!permissionsLib || typeof permissionsLib.userCan !== 'function') {
      console.error('[requireIPD] permissions lib not loaded')
      return errorResponse(res, 'Server configuration error', 500)
    }

    if (permissionsLib.userCan(user, permission)) return next()
    return errorResponse(res, `You do not have permission: ${permission}`, 403, {
      missingPermission: permission,
    })
  }
}

module.exports = { requireIPD }
