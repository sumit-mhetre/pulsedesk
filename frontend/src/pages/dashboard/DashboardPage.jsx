import { useEffect, useState } from 'react'
import { Users, UserCheck, FileText, Calendar } from 'lucide-react'
import { StatCard, Card, PageHeader, Badge } from '../../components/ui'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'
import api from '../../lib/api'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState(null)

  // Permission check - used to gate the daily-report fetch and the Today's Summary
  // panel below. Receptionists don't have viewReports, so they shouldn't trigger
  // the call (which 403s and leaks "viewReports" into a toast via the global axios
  // interceptor). The Clinic Overview cards still load via /clinics/me.
  const canViewReports = can(user, 'viewReports')

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async (attempt = 1) => {
    try {
      const clinic = await api.get('/clinics/me')
      setStats(clinic.data.data)

      // Daily report - only fetched for users who actually have permission.
      // Without this guard, Receptionist hits a 403 on every dashboard load.
      if (canViewReports) {
        api.get('/reports/daily')
          .then(r => setDaily(r.data.data))
          .catch(() => { /* swallow - clinic stats already showing */ })
      }
    } catch (err) {
      // Retry once after 3 seconds (Render cold start)
      if (attempt === 1) {
        setTimeout(() => fetchStats(2), 3000)
        return
      }
    } finally {
      if (attempt > 1 || true) setLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <div className="fade-in">
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0]} 👋`}
        subtitle={`${format(new Date(), 'EEEE, dd MMMM yyyy')} • ${user?.clinic?.name}`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Patients"
          value={stats?._count?.patients ?? '-'}
          icon={<Users className="w-6 h-6" />}
          color="bg-primary"
          sub="Registered patients"
        />
        <StatCard
          label="Prescriptions"
          value={stats?._count?.prescriptions ?? '-'}
          icon={<FileText className="w-6 h-6" />}
          color="bg-secondary"
          sub="Total written"
        />
        <StatCard
          label="Staff Members"
          value={stats?._count?.users ?? '-'}
          icon={<UserCheck className="w-6 h-6" />}
          color="bg-accent"
          sub="Active users"
        />
        <StatCard
          label="Today's Date"
          value={format(new Date(), 'dd MMM')}
          icon={<Calendar className="w-6 h-6" />}
          color="bg-success"
          sub={format(new Date(), 'yyyy')}
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinic Info */}
        <Card title="Clinic Overview">
          <div className="space-y-3">
            {[
              { label: 'Clinic Name',    value: stats?.name },
              { label: 'Email',          value: stats?.email || '-' },
              { label: 'Phone',          value: stats?.mobile || stats?.phone || '-' },
              { label: 'Plan',           value: stats?.subscriptionPlan,  badge: true },
              { label: 'Status',         value: stats?.status, badge: true },
            ].map(({ label, value, badge }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
                {badge
                  ? <Badge variant={value === 'Active' || value === 'Pro' ? 'success' : value === 'Standard' ? 'accent' : 'primary'}>{value}</Badge>
                  : <span className="text-sm font-medium text-slate-700">{value || '-'}</span>
                }
              </div>
            ))}
          </div>
        </Card>

        {/* My Profile */}
        <Card title="My Profile">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-2xl">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-800">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <Badge variant="primary" className="mt-1">{user?.role}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Qualification',   value: user?.qualification },
              { label: 'Specialization',  value: user?.specialization },
              { label: 'Reg. No.',        value: user?.regNo },
              { label: 'Phone',           value: user?.phone },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
                <span className="text-sm font-medium text-slate-700">{value || '-'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Summary - gated by viewReports permission. Receptionists won't see
          this panel since they don't have access to revenue/today's-Rx data. */}
      {canViewReports && daily && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Today's Queue",       value: daily.queueCount,    color: 'text-primary',  bg: 'bg-blue-50',   icon: '🏥' },
            { label: 'New Patients Today',  value: daily.newPatients,   color: 'text-success',  bg: 'bg-green-50',  icon: '👤' },
            { label: "Today's Rx",          value: daily.prescriptions, color: 'text-accent',   bg: 'bg-cyan-50',   icon: '💊' },
            { label: 'Collected Today',     value: `₹${(daily.totalCollected || 0).toLocaleString('en-IN')}`, color: 'text-warning', bg: 'bg-orange-50', icon: '💰' },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center text-xl flex-shrink-0`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-xl font-black ${s.color}`}>{s.value ?? '-'}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions block - REMOVED per user request.
          The same actions are reachable from the sidebar nav. */}
    </div>
  )
}