import { Outlet, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore()
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/super/dashboard' : '/dashboard'} replace />
  }
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[45%] bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="3.5" fill="white"/>
                <path d="M11 2 L11 6 M11 16 L11 20 M2 11 L6 11 M16 11 L20 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SimpleRx EMR</span>
          </div>
          <p className="text-blue-200 text-sm">Smart Clinic Management</p>
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

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="3.5" fill="white"/>
                <path d="M11 2 L11 6 M11 16 L11 20 M2 11 L6 11 M16 11 L20 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-primary text-xl">SimpleRx EMR</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
