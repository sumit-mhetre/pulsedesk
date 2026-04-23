import useAuthStore from '../store/authStore'
import { can } from '../lib/permissions'

/**
 * usePermission('manageUsers') → boolean
 *
 * Reactively reflects the current user's permission state. Returns false when
 * not logged in.
 */
export default function usePermission(permissionKey) {
  const user = useAuthStore(s => s.user)
  return can(user, permissionKey)
}

/**
 * useCan() → function(key) → boolean
 *
 * Convenience when you need to check multiple keys in the same component.
 */
export function useCan() {
  const user = useAuthStore(s => s.user)
  return (key) => can(user, key)
}
