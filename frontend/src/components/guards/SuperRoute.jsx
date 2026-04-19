// SuperRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function SuperRoute() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
