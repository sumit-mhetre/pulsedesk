import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Users, Settings, LogOut, Database, FileText, Receipt, BookOpen,
  Menu, X, User, ChevronDown, ChevronRight, Building2, CalendarDays, BarChart3, FileCheck,
  BedDouble, Wrench, ClipboardList,
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import { can } from '../lib/permissions'
import { getGlobalDirty, onGlobalDirtyChange } from '../hooks/useUnsavedChanges'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import toast from 'react-hot-toast'

// Top-level nav. IPD is rendered as a special collapsible section -- not in this list.
const navItems = [
  { label: 'Dashboard',    icon: LayoutDashboard, to: '/dashboard',     requires: 'viewDashboard' },
  { label: 'Appointments', icon: CalendarDays,    to: '/queue',         requires: 'manageQueue' },
  { label: 'Prescriptions',icon: FileText,        to: '/prescriptions', requires: 'viewPrescriptions' },
  { label: 'Certificates', icon: FileCheck,       to: '/documents',     requires: 'viewDocuments' },
  { label: 'Billing',      icon: Receipt,         to: '/billing',       requires: 'viewBilling' },
  // IPD section inserted here -- see ipdItems below
  { label: 'Reports',      icon: BarChart3,       to: '/reports',       requires: 'viewReports' },
  { label: 'Templates',    icon: BookOpen,        to: '/templates',     requires: 'viewPrescriptions' },
  { label: 'Master Data',  icon: Database,        to: '/master-data',   requires: 'manageMasterData' },
  { label: 'Users',        icon: Users,           to: '/users',         requires: 'manageUsers' },
  { label: 'Settings',     icon: Settings,        to: '/settings',      requires: 'manageSettings' },
]

// IPD sub-items (shown when the IPD section is expanded).
// IPD section visibility: ipdEnabled flag on clinic + manageIPD permission.
const ipdItems = [
  { label: 'Bed Board',      icon: BedDouble,      to: '/ipd/beds',           requires: 'manageIPD' },
  { label: 'Bed Management', icon: Wrench,         to: '/ipd/bed-management', requires: 'manageBeds' },
  { label: 'Admissions',     icon: ClipboardList,  to: '/ipd/admissions',     requires: 'manageIPD' },
]

function DiscardDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
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
  useSessionTimeout()
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const profileRef                        = useRef(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isDirty,       setIsDirty]       = useState(false)
  const [discardTarget, setDiscardTarget] = useState(null)

  // Close the profile dropdown when clicking outside it, or pressing Escape.
  // Standard popover UX -- avoids the menu lingering open after the user
  // moves on to something else.
  useEffect(() => {
    if (!profileOpen) return
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown',   onKey)
    }
  }, [profileOpen])

  // IPD section auto-expands when user is on any IPD page; otherwise remembers
  // the user's manual toggle via localStorage.
  const isOnIpdPage = location.pathname.startsWith('/ipd')
  const [ipdExpanded, setIpdExpanded] = useState(() => {
    if (isOnIpdPage) return true
    try {
      const saved = localStorage.getItem('sidebar_ipd_expanded')
      return saved === 'true'
    } catch { return false }
  })

  // Persist user's expand/collapse choice.
  useEffect(() => {
    try {
      localStorage.setItem('sidebar_ipd_expanded', ipdExpanded ? 'true' : 'false')
    } catch { /* ignore */ }
  }, [ipdExpanded])

  // Auto-expand when navigating into IPD.
  useEffect(() => {
    if (isOnIpdPage && !ipdExpanded) setIpdExpanded(true)
  }, [isOnIpdPage])

  useEffect(() => {
    const unsub = onGlobalDirtyChange(v => setIsDirty(v))
    return unsub
  }, [])

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

  const visibleNav = navItems.filter(item => can(user, item.requires))
  // IPD section is gated by clinic.ipdEnabled AND user has manageIPD permission.
  const ipdEnabled = !!user?.clinic?.ipdEnabled
  const visibleIpdItems = ipdItems.filter(item => can(user, item.requires))
  const showIpdSection = ipdEnabled && visibleIpdItems.length > 0

  // Find the index of "Billing" so we render IPD section right after it.
  const billingIdx = visibleNav.findIndex(n => n.to === '/billing')

  const renderNav = (item) => (
    <NavLink key={item.to} to={item.to}
      onClick={(e) => handleNavClick(e, item.to)}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      <item.icon className="w-4 h-4 flex-shrink-0"/>
      {item.label}
    </NavLink>
  )

  const IPDSection = () => {
    if (!showIpdSection) return null
    return (
      <div>
        <button
          type="button"
          onClick={() => setIpdExpanded(v => !v)}
          className={`sidebar-link w-full ${isOnIpdPage ? 'text-white' : ''}`}>
          <BedDouble className="w-4 h-4 flex-shrink-0"/>
          <span className="flex-1 text-left">IPD</span>
          <ChevronRight
            className={`w-4 h-4 flex-shrink-0 transition-transform ${ipdExpanded ? 'rotate-90' : ''}`}
          />
        </button>
        {ipdExpanded && (
          <div className="mt-1 ml-3 pl-3 border-l border-white/10 space-y-1">
            {visibleIpdItems.map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={(e) => handleNavClick(e, item.to)}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <item.icon className="w-3.5 h-3.5 flex-shrink-0"/>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'w-full h-full' : 'w-64 min-h-screen'} bg-primary flex flex-col`}>
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="SimpleRx EMR" className="w-10 h-10 object-contain flex-shrink-0"/>
          <div>
            <p className="text-white font-bold text-base leading-none">SimpleRx EMR</p>
            <p className="text-blue-200 text-xs mt-0.5 truncate max-w-[120px]">{user?.clinic?.name || 'Clinic'}</p>
          </div>
        </div>
        {mobile && <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5"/></button>}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider px-4 mb-2">Menu</p>

        {visibleNav.map((item, idx) => (
          <div key={item.to}>
            {renderNav(item)}
            {/* Insert IPD section right after Billing */}
            {idx === billingIdx && <IPDSection/>}
          </div>
        ))}

        {/* Fallback: if Billing is hidden for this user but IPD is visible,
            render IPD at the end so it doesn't disappear. */}
        {billingIdx === -1 && <IPDSection/>}
      </nav>
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
          <div className="fixed inset-0 z-[55] lg:hidden flex no-print">
            <div className="w-72"><Sidebar mobile/></div>
            <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)}/>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-blue-50 sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button className="lg:hidden btn-ghost btn-icon" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5"/></button>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                <Building2 className="w-4 h-4"/>
                <span>{user?.clinic?.name}</span>
                <span className="text-slate-200">&bull;</span>
                <span className="badge-primary badge capitalize">{user?.clinic?.subscriptionPlan}</span>
              </div>
            </div>
            <div className="relative" ref={profileRef}>
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase()}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-700 leading-none">{user?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.role}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400"/>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-modal border border-blue-50 py-1 z-[60] animate-in">
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
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
            <Outlet/>
          </main>
        </div>
      </div>
    </>
  )
}
