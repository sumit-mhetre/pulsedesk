import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, Settings, LogOut, Database, FileText, Receipt, BookOpen,
  Menu, X, User, ChevronDown, Building2, CalendarDays, BarChart3,
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import Logo from '../components/ui/Logo'
import { getGlobalDirty, onGlobalDirtyChange } from '../hooks/useUnsavedChanges'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/dashboard',     roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Patients',     icon: User,            to: '/patients',      roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Queue',        icon: CalendarDays,    to: '/queue',         roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Prescriptions',icon: FileText,        to: '/prescriptions', roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Billing',      icon: Receipt,         to: '/billing',       roles: ['ADMIN','DOCTOR','RECEPTIONIST'] },
  { label: 'Reports',      icon: BarChart3,       to: '/reports',       roles: ['ADMIN','DOCTOR'] },
  { label: 'Templates',    icon: BookOpen,        to: '/templates',     roles: ['ADMIN','DOCTOR'] },
  { label: 'Master Data',  icon: Database,        to: '/master-data',   roles: ['ADMIN'] },
  { label: 'Users',        icon: Users,           to: '/users',         roles: ['ADMIN'] },
  { label: 'Settings',     icon: Settings,        to: '/settings',      roles: ['ADMIN'] },
]

function DiscardDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">Discard Changes?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">You have unsaved changes. If you leave now, all entered data will be lost.</p>
        </div>
        <div className="flex border-t border-slate-100">
          <button onClick={onCancel} className="flex-1 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100">Keep Editing</button>
          <button onClick={onConfirm} className="flex-1 py-3.5 text-sm font-bold text-white bg-warning hover:bg-warning/90 transition-colors">Yes, Discard</button>
        </div>
      </div>
    </div>
  )
}

export default function DashLayout() {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()
  const location         = useLocation()
  useSessionTimeout()  // Auto-logout after 30 min inactivity
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isDirty,       setIsDirty]       = useState(false)
  const [discardTarget, setDiscardTarget] = useState(null)

  // Subscribe to global dirty state
  useEffect(() => {
    const unsub = onGlobalDirtyChange(v => setIsDirty(v))
    return unsub
  }, [])

  // Reset dirty on route change
  useEffect(() => { setIsDirty(false) }, [location.pathname])

  const handleLogout = () => setConfirmLogout(true)
  const doLogout = async () => {
    setConfirmLogout(false)
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const handleNavClick = (e, to) => {
    if (isDirty && location.pathname !== to) {
      e.preventDefault()
      setDiscardTarget(to)
    } else {
      setSidebarOpen(false)
    }
  }

  const confirmDiscard = () => {
    setIsDirty(false)
    setDiscardTarget(null)
    setSidebarOpen(false)
    if (discardTarget) navigate(discardTarget)
  }

  const visibleNav = navItems.filter(item => item.roles.includes(user?.role))

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'w-full h-full' : 'w-64 min-h-screen'} bg-primary flex flex-col`}>
      <div className="flex items-center justify-between p-5 border-b border-white/10">
       <div className="flex items-center gap-3 min-w-0">
          <Logo variant="dark" size="sm" showText={false}/>
          <div className="min-w-0">
            <div className="text-white font-extrabold text-base leading-none">
              Simple<span className="text-accent">Rx</span>
              <span className="ml-1.5">EMR</span>
            </div>
            <p className="text-blue-200 text-xs mt-1 truncate max-w-[120px]">{user?.clinic?.name || 'Clinic'}</p>
          </div>
        </div>
        {mobile && <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5"/></button>}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider px-4 mb-2">Menu</p>
        {visibleNav.map((item) => (
          <NavLink key={item.to} to={item.to}
            onClick={(e) => handleNavClick(e, item.to)}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <item.icon className="w-4 h-4 flex-shrink-0"/>
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
        <button onClick={handleLogout} className="sidebar-link w-full mt-1 text-red-300 hover:text-red-200 hover:bg-red-500/20">
          <LogOut className="w-4 h-4"/> Logout
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=>setConfirmLogout(false)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-orange-100">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-7 h-7 text-warning"/>
              </div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">Logout?</h3>
              <p className="text-sm text-slate-500">Are you sure you want to logout from SimpleRx EMR?</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button onClick={()=>setConfirmLogout(false)} className="flex-1 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100">Cancel</button>
              <button onClick={doLogout} className="flex-1 py-3.5 text-sm font-bold text-white bg-danger hover:bg-danger/90 transition-colors">Yes, Logout</button>
            </div>
          </div>
        </div>
      )}

      {discardTarget && <DiscardDialog onConfirm={confirmDiscard} onCancel={() => setDiscardTarget(null)}/>}

      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block sticky top-0 h-screen no-print"><Sidebar/></div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <div className="w-72"><Sidebar mobile/></div>
            <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)}/>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-blue-50 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button className="lg:hidden btn-ghost btn-icon" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5"/></button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                <Building2 className="w-4 h-4"/>
                <span>{user?.clinic?.name}</span>
                <span className="text-slate-200">•</span>
                <span className="badge-primary badge capitalize">{user?.clinic?.subscriptionPlan}</span>
              </div>
            </div>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase()}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-700 leading-none">{user?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.role}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400"/>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-modal border border-blue-50 py-1 z-50 animate-in">
                  <button onClick={() => { navigate('/profile'); setProfileOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 transition-colors">
                    <User className="w-4 h-4 text-primary"/> My Profile
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button onClick={() => { navigate('/settings'); setProfileOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 transition-colors">
                      <Settings className="w-4 h-4 text-primary"/> Settings
                    </button>
                  )}
                  <div className="border-t border-slate-100 my-1"/>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4"/> Logout
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 fade-in"><Outlet/></main>
        </div>
      </div>
    </>
  )
}
