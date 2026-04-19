import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { TrendingUp, Users, FileText, Receipt, IndianRupee, Calendar, Download, BarChart3 } from 'lucide-react'
import { Card, PageHeader, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format, subMonths } from 'date-fns'

const COLORS = ['#1565C0', '#42A5F5', '#00BCD4', '#43A047', '#FB8C00', '#E53935']

function StatCard({ label, value, sub, icon: Icon, color = 'text-primary', bg = 'bg-blue-50' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 truncate">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const [tab,       setTab]       = useState('daily')
  const [daily,     setDaily]     = useState(null)
  const [monthly,   setMonthly]   = useState(null)
  const [patStats,  setPatStats]  = useState(null)
  const [topMeds,   setTopMeds]   = useState([])
  const [collection,setCollection]= useState(null)
  const [loading,   setLoading]   = useState(true)

  const now   = new Date()
  const [selDate,  setSelDate]  = useState(format(now, 'yyyy-MM-dd'))
  const [selYear,  setSelYear]  = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    Promise.all([
      api.get(`/reports/daily?date=${selDate}`).then(r => setDaily(r.data.data)),
      api.get(`/reports/monthly?year=${selYear}&month=${selMonth}`).then(r => setMonthly(r.data.data)),
      api.get('/reports/patients').then(r => setPatStats(r.data.data)),
      api.get('/reports/medicines?limit=10').then(r => setTopMeds(r.data.data)),
      api.get('/reports/collection').then(r => setCollection(r.data.data)),
    ]).finally(() => setLoading(false))
  }, [selDate, selYear, selMonth])

  const tabs = [
    { key: 'daily',    label: 'Daily',    icon: Calendar },
    { key: 'monthly',  label: 'Monthly',  icon: BarChart3 },
    { key: 'patients', label: 'Patients', icon: Users },
    { key: 'medicines',label: 'Medicines',icon: FileText },
  ]

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>

  return (
    <div className="fade-in">
      <PageHeader title="Reports & Analytics" subtitle="Clinic performance at a glance" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary hover:text-primary'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── DAILY TAB ── */}
      {tab === 'daily' && daily && (
        <div className="space-y-5">
          {/* Date picker */}
          <div className="flex items-center gap-3">
            <label className="form-label mb-0">Select Date:</label>
            <input type="date" className="form-input w-44"
              value={selDate} max={format(now, 'yyyy-MM-dd')}
              onChange={e => setSelDate(e.target.value)} />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Patients in Queue"   value={daily.queueCount}     icon={Users}       color="text-primary"  bg="bg-blue-50" />
            <StatCard label="New Patients"        value={daily.newPatients}    icon={Users}       color="text-success"  bg="bg-green-50" />
            <StatCard label="Prescriptions"       value={daily.prescriptions}  icon={FileText}    color="text-accent"   bg="bg-cyan-50" />
            <StatCard label="Bills Created"       value={daily.billCount}      icon={Receipt}     color="text-warning"  bg="bg-orange-50" />
          </div>

          {/* Collection cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Billed"    value={`₹${daily.totalBilled.toLocaleString('en-IN')}`}     icon={IndianRupee} color="text-primary" bg="bg-blue-50" />
            <StatCard label="Collected"       value={`₹${daily.totalCollected.toLocaleString('en-IN')}`}  icon={IndianRupee} color="text-success" bg="bg-green-50" />
            <StatCard label="Pending"         value={`₹${daily.totalPending.toLocaleString('en-IN')}`}    icon={IndianRupee} color="text-danger"  bg="bg-red-50" />
          </div>

          {/* Payment mode breakdown */}
          {Object.keys(daily.byMode).length > 0 && (
            <Card>
              <h3 className="font-bold text-slate-700 mb-4">Collection by Payment Mode</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(daily.byMode).map(([mode, amt]) => (
                  <div key={mode} className="flex items-center gap-2 bg-background px-4 py-2 rounded-xl">
                    <span className="text-sm font-medium text-slate-600">{mode}</span>
                    <span className="font-bold text-primary">₹{amt.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── MONTHLY TAB ── */}
      {tab === 'monthly' && monthly && (
        <div className="space-y-5">
          {/* Month/Year picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <select className="form-select w-36" value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="form-select w-28" value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}>
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Billed"    value={`₹${(monthly.totalBilled/1000).toFixed(1)}K`}     icon={IndianRupee} color="text-primary" bg="bg-blue-50" />
            <StatCard label="Collected"       value={`₹${(monthly.totalCollected/1000).toFixed(1)}K`}  icon={IndianRupee} color="text-success" bg="bg-green-50" />
            <StatCard label="Prescriptions"   value={monthly.prescriptions}   icon={FileText}    color="text-accent"  bg="bg-cyan-50" />
            <StatCard label="New Patients"    value={monthly.newPatients}     icon={Users}       color="text-warning" bg="bg-orange-50" />
          </div>

          {/* Daily bar chart */}
          <Card>
            <h3 className="font-bold text-slate-700 mb-4">Daily Collection — {MONTHS[selMonth-1]} {selYear}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly.daily} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}K`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, '']} />
                <Bar dataKey="collected" name="Collected" fill="#1565C0" radius={[4,4,0,0]} />
                <Bar dataKey="billed"    name="Billed"    fill="#42A5F5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Payment mode pie */}
          {Object.keys(monthly.byMode).length > 0 && (
            <Card>
              <h3 className="font-bold text-slate-700 mb-4">Collection by Payment Mode</h3>
              <div className="flex items-center gap-8">
                <PieChart width={180} height={180}>
                  <Pie data={Object.entries(monthly.byMode).map(([name, value]) => ({ name, value }))}
                    cx={90} cy={90} innerRadius={50} outerRadius={80}
                    dataKey="value" paddingAngle={3}>
                    {Object.keys(monthly.byMode).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                </PieChart>
                <div className="space-y-2">
                  {Object.entries(monthly.byMode).map(([mode, amt], i) => (
                    <div key={mode} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }}/>
                      <span className="text-sm text-slate-600">{mode}</span>
                      <span className="font-bold text-slate-800">₹{amt.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── PATIENTS TAB ── */}
      {tab === 'patients' && patStats && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total Patients"     value={patStats.total}       icon={Users} color="text-primary" bg="bg-blue-50" />
            <StatCard label="New This Month"     value={patStats.thisMonth}   icon={Users} color="text-success" bg="bg-green-50" />
            <StatCard label="With Chronic Cond." value={patStats.withChronic} icon={Users} color="text-warning" bg="bg-orange-50" />
          </div>

          {patStats.byGender && (
            <Card>
              <h3 className="font-bold text-slate-700 mb-4">Patients by Gender</h3>
              <div className="flex gap-6">
                {Object.entries(patStats.byGender).map(([gender, count], i) => (
                  <div key={gender} className="text-center">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-2"
                      style={{ background: COLORS[i] + '20' }}>
                      <span className="text-2xl font-black" style={{ color: COLORS[i] }}>{count}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-600">{gender}</p>
                    <p className="text-xs text-slate-400">{patStats.total > 0 ? Math.round(count/patStats.total*100) : 0}%</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── MEDICINES TAB ── */}
      {tab === 'medicines' && topMeds.length > 0 && (
        <div className="space-y-5">
          <Card>
            <h3 className="font-bold text-slate-700 mb-4">Most Prescribed Medicines</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topMeds} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                <Tooltip />
                <Bar dataKey="usageCount" name="Times Prescribed" fill="#1565C0" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-700 mb-3">Top Medicines Detail</h3>
            <div className="space-y-2">
              {topMeds.map((med, i) => (
                <div key={med.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-700 truncate">{med.name}</p>
                    <p className="text-xs text-slate-400">{med.category} • {med.type}</p>
                  </div>
                  <Badge variant="primary">{med.usageCount} times</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
