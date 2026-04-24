import { useEffect, useState } from 'react'
import { Users, FileText, Receipt, IndianRupee, TrendingUp, Calendar, Activity, Clock } from 'lucide-react'
import api from '../../lib/api'
import { Spinner } from '../../components/ui'
import {
  ChartCard, TrendAreaChart, SimpleBarChart, HBarChart, DonutChart,
  RadialChart, HeatmapHours, COLORS,
} from './components/ChartWidgets'

const PRESETS = [
  { key: 'today',     label: 'Today' },
  { key: '7d',        label: '7 days' },
  { key: '30d',       label: '30 days' },
  { key: '90d',       label: '90 days' },
  { key: 'month',     label: 'This month' },
  { key: 'quarter',   label: 'Quarter' },
  { key: 'year',      label: 'Year' },
]

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const num = (n) => Number(n || 0).toLocaleString('en-IN')

function Kpi({ label, value, sub, icon: Icon, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`}/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardTab() {
  const [preset, setPreset]   = useState('30d')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/reports/dashboard?preset=${preset}`)
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false))
  }, [preset])

  if (loading || !data) {
    return <div className="flex justify-center py-20"><Spinner/></div>
  }

  const { today, range, trend, payments, ageGroups, genderSplit, peakHours, topMedicines, topDiagnoses, doctorStats } = data

  // Normalize for charts
  const genderData = Object.entries(genderSplit || {}).map(([k, v]) => ({ name: k, value: v }))
  const paymentStatusData = Object.entries(payments.byStatus || {}).map(([k, v]) => ({ name: k, value: v }))
  const paymentModeData   = Object.entries(payments.byMode || {}).map(([k, v]) => ({ name: k, value: v }))
  const ageData = Object.entries(ageGroups || {}).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))
  const medsData = (topMedicines || []).map(m => ({ name: m.name, count: m.usageCount }))
  const diagData = (topDiagnoses || []).map(d => ({ name: d.name, count: d.count || d.usageCount }))
  const docData  = (doctorStats  || []).slice(0, 8)

  return (
    <div className="space-y-5">
      {/* ── Date range pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-600 mr-2">Period:</span>
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              preset === p.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Today KPIs ── */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Today</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="New Patients"  value={num(today.newPatients)}    icon={Users}       color="text-primary" bg="bg-blue-50"/>
          <Kpi label="Prescriptions" value={num(today.prescriptions)}  icon={FileText}    color="text-accent"  bg="bg-cyan-50"/>
          <Kpi label="Bills"         value={num(today.billCount)}      sub={inr(today.totalBilled)} icon={Receipt} color="text-success" bg="bg-green-50"/>
          <Kpi label="Collected"     value={inr(today.totalCollected)} sub={`Pending ${inr(today.totalPending)}`} icon={IndianRupee} color="text-warning" bg="bg-orange-50"/>
        </div>
      </div>

      {/* ── Range totals ── */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">This Period</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Revenue"       value={inr(range.totalBilled)}    sub={`${num(range.billCount)} bills`} icon={TrendingUp} color="text-primary" bg="bg-blue-50"/>
          <Kpi label="Footfall"      value={num(range.prescriptionCount)} sub={`${num(range.newPatientsCount)} new`} icon={Activity}   color="text-accent"  bg="bg-cyan-50"/>
          <Kpi label="Appointments"  value={num(range.appointmentCount)} icon={Calendar}   color="text-success" bg="bg-green-50"/>
          <Kpi label="Collected"     value={inr(range.totalCollected)} sub={`Pending ${inr(range.totalPending)}`} icon={IndianRupee} color="text-warning" bg="bg-orange-50"/>
        </div>
      </div>

      {/* ── Revenue trend (hero) ── */}
      <ChartCard title="Revenue & Collection trend" subtitle="Daily billed vs collected" height={280}>
        <TrendAreaChart
          data={trend}
          lines={[
            { key: 'revenue',   label: 'Billed',    color: '#1565C0', currency: true },
            { key: 'collected', label: 'Collected', color: '#00BCD4', currency: true },
          ]}
        />
      </ChartCard>

      {/* ── Two column: footfall + payment status ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Daily footfall" subtitle="Prescriptions per day">
          <SimpleBarChart data={trend} yKey="patients" label="Patients" color="#00BCD4"/>
        </ChartCard>
        <ChartCard title="Payment status" subtitle="Distribution of bills">
          <DonutChart data={paymentStatusData}/>
        </ChartCard>
      </div>

      {/* ── Two column: top meds + top diagnoses ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Top medicines" subtitle="Most prescribed (all time)">
          {medsData.length > 0
            ? <HBarChart data={medsData} xKey="count" yKey="name" formatter={(v) => `${v} prescriptions`}/>
            : <EmptyChart label="No data yet"/>}
        </ChartCard>
        <ChartCard title="Top diagnoses" subtitle="Most common (this period)">
          {diagData.length > 0
            ? <HBarChart data={diagData} xKey="count" yKey="name"/>
            : <EmptyChart label="No diagnoses recorded"/>}
        </ChartCard>
      </div>

      {/* ── Three column: age + gender + mode ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Age distribution" subtitle="New patients">
          {ageData.length > 0
            ? <RadialChart data={ageData}/>
            : <EmptyChart label="No data"/>}
        </ChartCard>
        <ChartCard title="Gender split" subtitle="All patients">
          {genderData.length > 0
            ? <DonutChart data={genderData}/>
            : <EmptyChart label="No data"/>}
        </ChartCard>
        <ChartCard title="Payment mode" subtitle="₹ collected by mode">
          {paymentModeData.length > 0
            ? <DonutChart data={paymentModeData} currency/>
            : <EmptyChart label="No payments yet"/>}
        </ChartCard>
      </div>

      {/* ── Doctor performance ── */}
      {docData.length > 0 && (
        <ChartCard title="Doctor performance" subtitle="Prescriptions this period">
          <HBarChart data={docData} xKey="count" yKey="name"/>
        </ChartCard>
      )}

      {/* ── Peak hours heatmap ── */}
      <ChartCard title="Peak hours" subtitle="Appointments by hour of day (click/hover for details)" height="auto" className="pb-6">
        <div className="py-2">
          <HeatmapHours data={peakHours}/>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
            <span>Low</span>
            <div className="flex gap-0.5">
              {[0.15, 0.3, 0.5, 0.7, 0.9].map((i) => (
                <div key={i} className="w-6 h-3 rounded" style={{ background: `rgba(21, 101, 192, ${i})` }}/>
              ))}
            </div>
            <span>High</span>
          </div>
        </div>
      </ChartCard>
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
      {label}
    </div>
  )
}
