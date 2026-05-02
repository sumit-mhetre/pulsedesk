// Super Admin Dashboard -- platform-wide overview.
//
// Top row: 4 hero counters (Clinics / Patients / Prescriptions / Admissions),
// each with a small "today" subtitle.
//
// Then two charts side-by-side:
//   - Activity Last 30 Days: stacked-line of Rx / admissions / bills per day
//   - Clinic Growth: bar chart of new clinic signups per month, last 12 months
//
// Then two info panels:
//   - Top 5 most active clinics this month (table)
//   - Dormant clinics (active but unused in 7d or 30d -- toggleable)
//
// Then the legacy two panels (by plan, recent clinics) at the bottom.
//
// All data comes from a single GET /super/dashboard call.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, FileText, BedDouble, ArrowRight,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { StatCard, Card, PageHeader, Badge, Button } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'

// Ocean Blue palette tokens -- recharts can't read CSS vars, so hex literals here.
const CHART_COLORS = {
  primary:   '#1565C0',
  secondary: '#42A5F5',
  accent:    '#00BCD4',
  success:   '#43A047',
  warning:   '#FB8C00',
  danger:    '#E53935',
  slate:     '#94A3B8',
}

export default function SuperDashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [dormantWindow, setDormantWindow] = useState(7) // 7 or 30

  useEffect(() => {
    api.get('/super/dashboard')
      .then(({ data }) => setStats(data.data))
      .finally(() => setLoading(false))
  }, [])

  // Format month labels for the bar chart (YYYY-MM -> "Apr 26")
  const growthData = useMemo(() => {
    if (!stats?.growthByMonth) return []
    return stats.growthByMonth.map(r => ({
      label: r.month
        ? format(new Date(r.month + '-01'), 'MMM yy')
        : '',
      clinics: Number(r.clinics) || 0,
    }))
  }, [stats])

  // Format daily activity (drop year for compactness on x-axis)
  const activityData = useMemo(() => {
    if (!stats?.dailyActivityLast30) return []
    return stats.dailyActivityLast30.map(r => ({
      label: format(new Date(r.date), 'd MMM'),
      Prescriptions: Number(r.prescriptions) || 0,
      Admissions:    Number(r.admissions)    || 0,
      Bills:         Number(r.bills)         || 0,
    }))
  }, [stats])

  const dormantList = dormantWindow === 30
    ? (stats?.dormantClinics?.over30days || [])
    : (stats?.dormantClinics?.over7days  || [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner text-primary w-8 h-8" />
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader title="Super Admin Dashboard" subtitle="Platform-wide overview" />

      {/* ── Hero counters with today subtitles ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Clinics"
          value={stats?.totalClinics ?? 0}
          sub={`${stats?.activeClinics ?? 0} active`}
          icon={<Building2 className="w-6 h-6" />}
          color="bg-primary"
        />
        <StatCard
          label="Total Patients"
          value={(stats?.totalPatients ?? 0).toLocaleString()}
          sub={`+${stats?.today?.patients ?? 0} today`}
          icon={<Users className="w-6 h-6" />}
          color="bg-secondary"
        />
        <StatCard
          label="Prescriptions"
          value={(stats?.totalPrescriptions ?? 0).toLocaleString()}
          sub={`+${stats?.today?.prescriptions ?? 0} today`}
          icon={<FileText className="w-6 h-6" />}
          color="bg-accent"
        />
        <StatCard
          label="Admissions"
          value={(stats?.totalAdmissions ?? 0).toLocaleString()}
          sub={`+${stats?.today?.admissions ?? 0} today`}
          icon={<BedDouble className="w-6 h-6" />}
          color="bg-success"
        />
      </div>

      {/* ── Activity + Growth charts ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Activity (Last 30 Days)">
          {activityData.every(d => d.Prescriptions === 0 && d.Admissions === 0 && d.Bills === 0) ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No platform activity in the last 30 days.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={activityData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="Prescriptions" stroke={CHART_COLORS.primary}   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Admissions"    stroke={CHART_COLORS.success}   strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bills"         stroke={CHART_COLORS.warning}   strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Clinic Growth (Last 12 Months)">
          {growthData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No clinic signups in the last 12 months.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growthData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="clinics" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Top clinics + Dormant clinics ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Top 5 Active Clinics This Month">
          {(!stats?.topClinicsThisMonth || stats.topClinicsThisMonth.length === 0) ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No clinic activity this month yet.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topClinicsThisMonth.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate('/super/clinics')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.code || '—'} · {c.plan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400">
                        {Number(c.prescriptions)} Rx · {Number(c.admissions)} adm · {Number(c.bills)} bills
                      </p>
                    </div>
                    <Badge variant="primary">{Number(c.activity)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Dormant Clinics"
          action={
            <div className="flex items-center gap-2">
              {dormantList.length > 0 && (
                <Badge variant={dormantWindow === 30 ? 'danger' : 'warning'}>{dormantList.length}</Badge>
              )}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setDormantWindow(7)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    dormantWindow === 7 ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  7+ days
                </button>
                <button
                  type="button"
                  onClick={() => setDormantWindow(30)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    dormantWindow === 30 ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  30+ days
                </button>
              </div>
            </div>
          }
        >
          {dormantList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-success font-medium">All active clinics are engaged</p>
              <p className="text-xs text-slate-400 mt-1">
                No active clinic has been quiet for {dormantWindow}+ days.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dormantList.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate('/super/clinics')}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{c.code || '—'} · {c.subscriptionPlan}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-warning">{c.ageDays} days quiet</p>
                    <p className="text-[10px] text-slate-400">
                      {c.lastActivityAt
                        ? `last: ${format(new Date(c.lastActivityAt), 'dd MMM')}`
                        : 'no activity ever'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Legacy panels: by plan, recent clinics ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="By Subscription Plan">
          {(!stats?.byPlan || stats.byPlan.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-400">No clinics yet.</div>
          ) : (
            <div className="space-y-3">
              {stats.byPlan.map(p => (
                <div key={p.subscriptionPlan} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <Badge variant={p.subscriptionPlan === 'Pro' ? 'success' : p.subscriptionPlan === 'Standard' ? 'accent' : 'primary'}>
                    {p.subscriptionPlan}
                  </Badge>
                  <span className="font-bold text-slate-700">{p._count.id} clinics</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Recently Added Clinics"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/super/clinics')}>
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          }
        >
          {(!stats?.recentClinics || stats.recentClinics.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-400">No clinics yet.</div>
          ) : (
            <div className="space-y-3">
              {stats.recentClinics.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">
                      {c.code ? <span className="font-mono">{c.code} · </span> : null}
                      {format(new Date(c.createdAt), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Badge variant={c.status === 'Active' ? 'success' : 'gray'}>{c.status}</Badge>
                    <Badge variant="primary">{c.subscriptionPlan}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
