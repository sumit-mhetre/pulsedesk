import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Users, Settings, LogOut, Database, FileText, Receipt, BookOpen, Palette,
  Menu, X, User, ChevronDown, Building2,
  CalendarDays, BarChart3, Palette,
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/dashboard',   roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Patients',     icon: User,            to: '/patients',    roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Queue',         icon: CalendarDays,    to: '/queue',         roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Prescriptions', icon: FileText,        to: '/prescriptions', roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Billing',       icon: Receipt,        to: '/billing',       roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Reports',       icon: BarChart3,      to: '/reports',       roles: ['ADMIN','DOCTOR'] },
  { label: 'Templates',     icon: BookOpen,       to: '/templates',     roles: ['ADMIN','DOCTOR'] },
  { label: 'Page Designer',  icon: Palette,        to: '/page-designer', roles: ['ADMIN','DOCTOR'] },
  { label: 'Master Data', icon: Database, to: '/master-data', roles: ['ADMIN'] },
  { label: 'Clinic Setup', icon: Building2,       to: '/clinic/setup',roles: ['ADMIN'] },
  { label: 'Users',        icon: Users,           to: '/users',       roles: ['ADMIN'] },
]



export default function DashLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const visibleNav = navItems.filter(item => item.roles.includes(user?.role))

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'w-full h-full' : 'w-64 min-h-screen'} bg-primary flex flex-col`}>
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="3.5" fill="white"/>
              <path d="M11 2L11 6M11 16L11 20M2 11L6 11M16 11L20 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">PulseDesk</p>
            <p className="text-blue-200 text-xs mt-0.5 truncate max-w-[120px]">{user?.clinic?.name || 'Clinic'}</p>
          </div>
        </div>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider px-4 mb-2">Menu</p>
        {visibleNav.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}


      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
          onClick={() => { navigate('/profile'); setSidebarOpen(false) }}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-blue-300 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="sidebar-link w-full mt-1 text-red-300 hover:text-red-200 hover:bg-red-500/20">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block sticky top-0 h-screen no-print"><Sidebar /></div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="w-72"><Sidebar mobile /></div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-blue-50 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden btn-ghost btn-icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <Building2 className="w-4 h-4" />
              <span>{user?.clinic?.name}</span>
              <span className="text-slate-200">•</span>
              <span className="badge-primary badge capitalize">{user?.clinic?.subscriptionPlan}</span>
            </div>
          </div>

          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-700 leading-none">{user?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.role}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-modal border border-blue-50 py-1 z-50 animate-in">
                <button onClick={() => { navigate('/profile'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 transition-colors">
                  <User className="w-4 h-4 text-primary" /> My Profile
                </button>
                {user?.role === 'ADMIN' && (
                  <button onClick={() => { navigate('/clinic/setup'); setProfileOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 transition-colors">
                    <Settings className="w-4 h-4 text-primary" /> Clinic Settings
                  </button>
                )}
                <div className="border-t border-slate-100 my-1" />
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 fade-in"><Outlet /></main>
      </div>
    </div>
  )
}
