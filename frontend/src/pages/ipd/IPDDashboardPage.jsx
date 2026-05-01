// IPD Dashboard -- entry point for IPD module.
//
// Shows at-a-glance metrics and trends for clinic IPD operations.
// URL: /ipd/dashboard

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BedDouble, Users, ArrowDownToLine, AlertCircle, Clock, Pill,
  ClipboardList, RefreshCw, Stethoscope,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend,
} from 'recharts'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function IPDDashboardPage() {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/ipd/dashboard')
      setData(data.data)
    } catch (err) {
      if (err?.response?.data?.errors?.ipdDisabled) {
        toast.error('IPD module is not enabled for this clinic')
      } else {
        toast.error('Failed to load dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }
  if (!data) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
        <h3 className="text-lg font-semibold text-slate-700">Dashboard unavailable</h3>
        <p className="text-sm text-slate-500 mt-2">Could not load IPD dashboard data.</p>
      </Card>
    )
  }

  const { bedStats, admissionStats, pendingTasks, recentAdmissions, admissionsByDoctor, trend } = data

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="page-title">IPD Dashboard</h1>
          <p className="page-subtitle">Real-time inpatient operations overview</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4"/>} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* Top row: 4 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KPICard
          icon={Users}
          color="primary"
          label="Currently Admitted"
          value={admissionStats.admittedNow}
          onClick={() => navigate('/ipd/admissions')}
        />
        <KPICard
          icon={BedDouble}
          color="success"
          label="Bed Occupancy"
          value={`${bedStats.occupancyPercent}%`}
          sub={`${bedStats.occupied} / ${bedStats.total} beds`}
          onClick={() => navigate('/ipd/beds')}
        />
        <KPICard
          icon={ArrowDownToLine}
          color="accent"
          label="Today's Admissions"
          value={admissionStats.todayAdmissions}
        />
        <KPICard
          icon={ArrowDownToLine}
          color="warning"
          label="Today's Discharges"
          value={admissionStats.todayDischarges}
          rotate={180}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Bed status breakdown */}
        <Card>
          <p className="text-sm font-bold text-slate-700 mb-3">Bed Status</p>
          <div className="space-y-2">
            <BedStatusRow label="Vacant"   count={bedStats.vacant}   color="success" total={bedStats.total}/>
            <BedStatusRow label="Occupied" count={bedStats.occupied} color="danger"  total={bedStats.total}/>
            <BedStatusRow label="Cleaning" count={bedStats.cleaning} color="warning" total={bedStats.total}/>
            <BedStatusRow label="Reserved" count={bedStats.reserved} color="accent"  total={bedStats.total}/>
            <BedStatusRow label="Blocked"  count={bedStats.blocked}  color="gray"    total={bedStats.total}/>
          </div>
          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-700">Total active beds</span>
            <span className="text-lg font-black text-primary">{bedStats.total}</span>
          </div>
        </Card>

        {/* Pending tasks */}
        <Card>
          <p className="text-sm font-bold text-slate-700 mb-3">Pending Tasks</p>
          <div className="space-y-3">
            <TaskRow
              icon={Clock}
              color="primary"
              label="Upcoming MAR doses"
              sub="Next 4 hours"
              count={pendingTasks.upcomingDoses}
            />
            <TaskRow
              icon={AlertCircle}
              color="warning"
              label="Late doses"
              sub="Scheduled > 30 min ago, not given"
              count={pendingTasks.lateDoses}
              alert={pendingTasks.lateDoses > 0}
            />
            <TaskRow
              icon={ClipboardList}
              color="accent"
              label="Open IPD orders"
              sub="Lab, imaging, diet, etc."
              count={pendingTasks.pendingIpdOrders}
            />
          </div>
        </Card>

        {/* Admissions by doctor */}
        <Card>
          <p className="text-sm font-bold text-slate-700 mb-3">Admissions by Doctor</p>
          {admissionsByDoctor.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No admitted patients</p>
          ) : (
            <div className="space-y-2">
              {admissionsByDoctor.map(d => (
                <div key={d.doctorId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Stethoscope className="w-3.5 h-3.5 text-primary flex-shrink-0"/>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{d.doctorName}</p>
                      {d.specialization && (
                        <p className="text-[11px] text-slate-400 truncate">{d.specialization}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-black text-primary flex-shrink-0">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Trend chart */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-700">Admissions and Discharges - Last 7 Days</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }}/>
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false}/>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="admitted"   fill="#1565C0" name="Admitted"   radius={[4, 4, 0, 0]}/>
              <Bar dataKey="discharged" fill="#43A047" name="Discharged" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent admissions */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-700">Recent Admissions</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/ipd/admissions')}>
            View All
          </Button>
        </div>
        {recentAdmissions.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4 text-center">No admissions yet</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Adm No.</th>
                  <th>Patient</th>
                  <th>Admitted</th>
                  <th>Bed</th>
                  <th>Doctor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAdmissions.map(a => (
                  <tr key={a.id} className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/ipd/admissions/${a.id}`)}>
                    <td className="font-mono text-xs">{a.admissionNumber}</td>
                    <td>
                      <div>
                        <p className="font-medium text-slate-700">{a.patient?.name}</p>
                        {a.patient?.patientCode && (
                          <p className="text-[11px] font-mono text-slate-400">{a.patient.patientCode}</p>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">{format(new Date(a.admittedAt), 'd MMM, hh:mm a')}</td>
                    <td className="text-xs">{a.bed?.bedNumber || '--'}</td>
                    <td className="text-xs">{a.primaryDoctor?.name}</td>
                    <td>
                      <Badge variant={a.status === 'ADMITTED' ? 'success' : 'gray'}>
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function KPICard({ icon: Icon, color, label, value, sub, onClick, rotate }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-green-50',
    accent:  'text-accent bg-cyan-50',
    warning: 'text-warning bg-orange-50',
    danger:  'text-danger bg-red-50',
  }
  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-5 h-5" style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
          <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

function BedStatusRow({ label, count, color, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const colorMap = {
    success: 'bg-success',
    danger:  'bg-danger',
    warning: 'bg-warning',
    accent:  'bg-accent',
    gray:    'bg-slate-400',
  }
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-700">{count} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${colorMap[color] || colorMap.gray} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function TaskRow({ icon: Icon, color, label, sub, count, alert }) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    accent:  'text-accent bg-cyan-50',
    warning: 'text-warning bg-orange-50',
  }
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg ${alert ? 'bg-orange-50 border border-orange-200' : ''}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color] || colorMap.primary}`}>
        <Icon className="w-4 h-4"/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
      <span className={`text-2xl font-black flex-shrink-0 ${alert ? 'text-warning' : 'text-slate-700'}`}>
        {count}
      </span>
    </div>
  )
}
