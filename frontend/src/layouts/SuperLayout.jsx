import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, LogOut } from 'lucide-react'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import { ConfirmDialog } from '../components/ui'

export default function SuperLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const doLogout = async () => {
    setShowLogoutConfirm(false)
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-slate-900 min-h-screen flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="SimpleRx EMR" className="w-10 h-10 object-contain flex-shrink-0"/>
            <div>
              <p className="text-white font-bold text-sm">SimpleRx EMR</p>
              <p className="text-slate-400 text-xs">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { label: 'Dashboard', icon: LayoutDashboard, to: '/super/dashboard' },
            { label: 'All Clinics', icon: Building2, to: '/super/clinics' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                 ${isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium">{user?.name}</p>
            <p className="text-slate-400 text-xs">Super Administrator</p>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 w-full transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 fade-in">
        <Outlet />
      </main>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Logout?"
        message="Are you sure you want to logout? You'll need to sign in again to access Super Admin."
        variant="warning"
        confirmLabel="Yes, Logout"
        cancelLabel="Stay Signed In"
        onConfirm={doLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}
