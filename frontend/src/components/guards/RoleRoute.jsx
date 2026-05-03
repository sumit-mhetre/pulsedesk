import { Navigate, Outlet } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useEffect, useRef } from 'react'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'

/**
 * Route guard supporting both role and permission checks.
 *
 * Usage:
 *   <RoleRoute roles={['ADMIN','DOCTOR']} />              // role-based (legacy)
 *   <RoleRoute requires={['manageUsers']} />              // permission-based (preferred)
 *   <RoleRoute requires={['viewBilling','viewReports']} /> // ALL of these required
 *
 * If both are provided, both must pass.
 */
export default function RoleRoute({ roles = [], requires = [] }) {
  const user = useAuthStore(s => s.user)
  const notifiedRef = useRef(false)

  // Permission list - must have all
  const hasAllPermissions = requires.length === 0 || requires.every(p => can(user, p))

  // Role list - must be one of
  const hasRole = roles.length === 0 || roles.includes(user?.role)

  const allowed = hasAllPermissions && hasRole

  useEffect(() => {
    if (!allowed && !notifiedRef.current) {
      notifiedRef.current = true
      toast.error('You do not have access to that page')
    }
  }, [allowed])

  if (!allowed) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
