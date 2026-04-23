import { Outlet, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import Logo from '../components/ui/Logo'

export default function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/super/dashboard' : '/dashboard'} replace />
  }
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — dark blue, uses white-variant logo */}
      <div className="hidden lg:flex w-[45%] bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative">
          <Logo variant="dark" size="md" />
          <p className="text-blue-200 text-sm mt-2">Smart Clinic Management</p>
        </div>
        <div className="relative">
          <h2 className="text-white text-3xl font-bold leading-snug mb-4">
            Everything your clinic needs,<br />in one place.
          </h2>
          <div className="space-y-3">
            {[
              'Smart prescription pad with auto-fill',
              'Self-learning templates & dosage calculator',
              'Patient history & chronic tracking',
              'Billing, reports & page designer',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-blue-100 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-blue-300 text-xs">© 2026 SimpleRx EMR. All rights reserved.</p>
      </div>

      {/* Right panel — white, uses blue-variant logo on mobile */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Logo variant="light" size="md" />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
