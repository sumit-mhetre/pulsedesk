import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, FileText, Receipt, TrendingUp, Calendar, ArrowRight, BarChart3, Pill, ClipboardList } from 'lucide-react'
import { StatCard, Card, PageHeader, Badge } from '../../components/ui'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const [daily, setDaily] = useState(null)

  const fetchStats = async () => {
    try {
      const [clinic, rep] = await Promise.all([
        api.get('/clinics/me'),
        api.get('/reports/daily').catch(() => ({ data: { data: null } })),
      ])
      setStats(clinic.data.data)
      setDaily(rep.data.data)
    } catch {
    } finally {
      setLoading(false)
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
          value={stats?._count?.patients ?? '—'}
          icon={<Users className="w-6 h-6" />}
          color="bg-primary"
          sub="Registered patients"
        />
        <StatCard
          label="Prescriptions"
          value={stats?._count?.prescriptions ?? '—'}
          icon={<FileText className="w-6 h-6" />}
          color="bg-secondary"
          sub="Total written"
        />
        <StatCard
          label="Staff Members"
          value={stats?._count?.users ?? '—'}
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
              { label: 'Email',          value: stats?.email || '—' },
              { label: 'Phone',          value: stats?.mobile || stats?.phone || '—' },
              { label: 'Plan',           value: stats?.subscriptionPlan,  badge: true },
              { label: 'Status',         value: stats?.status, badge: true },
            ].map(({ label, value, badge }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
                {badge
                  ? <Badge variant={value === 'Active' || value === 'Pro' ? 'success' : value === 'Standard' ? 'accent' : 'primary'}>{value}</Badge>
                  : <span className="text-sm font-medium text-slate-700">{value || '—'}</span>
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
                <span className="text-sm font-medium text-slate-700">{value || '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Summary */}
      {daily && (
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
                  <p className={`text-xl font-black ${s.color}`}>{s.value ?? '—'}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <Card className="mt-6" title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Patient',      icon: '👤', to: '/patients',           color: 'bg-blue-50   text-primary',  desc: 'Register' },
            { label: 'Queue',            icon: '🏥', to: '/queue',              color: 'bg-cyan-50   text-accent',   desc: 'Today' },
            { label: 'New Prescription', icon: '💊', to: '/prescriptions/new',  color: 'bg-purple-50 text-purple-600', desc: 'Write Rx' },
            { label: 'New Bill',         icon: '🧾', to: '/billing/new',        color: 'bg-green-50  text-success',  desc: 'Billing' },
            { label: 'Reports',          icon: '📊', to: '/reports',            color: 'bg-orange-50 text-warning',  desc: 'Analytics' },
            { label: 'Master Data',      icon: '🗄️', to: '/master-data',        color: 'bg-slate-50  text-slate-600', desc: 'Setup' },
          ].map(({ label, icon, to, color, desc }) => (
            <button key={label} onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background border border-blue-50 hover:border-primary hover:shadow-card transition-all group">
              <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                {icon}
              </div>
              <span className="text-xs font-semibold text-slate-700">{label}</span>
              <span className="text-xs text-slate-400">{desc}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}