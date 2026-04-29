import { useEffect, useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Receipt, Activity, Plus, Pill, AlertTriangle, FlaskConical, TrendingUp, Filter, X } from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'

export default function PatientDetailPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const [patient,   setPatient]   = useState(null)
  const [rxHistory, setRxHistory] = useState([])
  const [bills,     setBills]     = useState([])
  const [vitals,    setVitals]    = useState([])
  const [tab,       setTab]       = useState('timeline')
  const [loading,   setLoading]   = useState(true)
  const [vitalForm, setVitalForm] = useState({ bp:'', sugar:'', weight:'', temp:'', spo2:'', pulse:'', notes:'' })
  const [showVital, setShowVital] = useState(false)
  const [savingV,   setSavingV]   = useState(false)

  const fetchAll = async () => {
    try {
      const [p, rx, b] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/prescriptions/patient/${id}`),
        api.get(`/billing/patient/${id}`),
      ])
      setPatient(p.data.data)
      setVitals(p.data.data?.vitalRecords || [])
      setRxHistory(rx.data.data || [])
      setBills(b.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [id])

  const saveVital = async () => {
    if (!Object.values(vitalForm).some(v => v)) { toast.error('Enter at least one vital'); return }
    setSavingV(true)
    try {
      await api.post(`/patients/${id}/vitals`, vitalForm)
      await fetchAll()
      setVitalForm({ bp:'', sugar:'', weight:'', temp:'', spo2:'', pulse:'', notes:'' })
      setShowVital(false)
      toast.success('Vitals recorded!')
    } catch {} finally { setSavingV(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  if (!patient) return null

  // Unified timeline
  const timeline = [
    ...rxHistory.map(rx => ({ type:'rx',    date: new Date(rx.date), data: rx })),
    ...bills.map(b =>       ({ type:'bill',  date: new Date(b.date),  data: b })),
    ...vitals.map(v =>      ({ type:'vital', date: new Date(v.date),  data: v })),
  ].sort((a, b) => b.date - a.date)

  const totalSpent = bills.reduce((s, b) => s + b.amountPaid, 0)

  return (
    <div className="fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={() => navigate('/patients')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
        <div className="flex-1">
          <h1 className="page-title">{patient.name}</h1>
          <p className="page-subtitle">{patient.patientCode} • {patient.age}y {patient.gender}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" icon={<FileText className="w-4 h-4"/>}
            onClick={() => navigate(`/prescriptions/new?patientId=${id}`)}>Rx</Button>
          <Button variant="outline" size="sm" icon={<Receipt className="w-4 h-4"/>}
            onClick={() => navigate(`/billing/new?patientId=${id}`)}>Bill</Button>
        </div>
      </div>

      {/* Patient info card */}
      <Card className="mb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary text-white font-black text-2xl flex items-center justify-center flex-shrink-0">
            {patient.name[0]}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><p className="text-xs text-slate-400">Phone</p><p className="text-sm font-medium">{patient.phone}</p></div>
            <div><p className="text-xs text-slate-400">Blood Group</p><p className="text-sm font-medium">{patient.bloodGroup || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Email</p><p className="text-sm font-medium truncate">{patient.email || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Address</p><p className="text-sm font-medium truncate">{patient.address || '—'}</p></div>
          </div>
        </div>
        {(patient.allergies?.length > 0 || patient.chronicConditions?.length > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-50 flex gap-6 flex-wrap">
            {patient.allergies?.length > 0 && (
              <div>
                <p className="text-xs text-danger font-semibold flex items-center gap-1 mb-1.5"><AlertTriangle className="w-3 h-3"/>Allergies</p>
                <div className="flex gap-1.5 flex-wrap">{patient.allergies.map(a => <Badge key={a} variant="danger">{a}</Badge>)}</div>
              </div>
            )}
            {patient.chronicConditions?.length > 0 && (
              <div>
                <p className="text-xs text-warning font-semibold mb-1.5">Chronic Conditions</p>
                <div className="flex gap-1.5 flex-wrap">{patient.chronicConditions.map(c => <Badge key={c} variant="warning">{c}</Badge>)}</div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-primary">{rxHistory.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Prescriptions</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-black text-success">₹{(totalSpent/1000).toFixed(1)}K</p>
          <p className="text-xs text-slate-400 mt-0.5">Total Paid</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-accent">{vitals.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Vital Records</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'timeline',      label: 'Timeline' },
          { key: 'prescriptions', label: 'Prescriptions' },
          { key: 'labResults',    label: 'Lab Results' },
          { key: 'documents',     label: 'Certificates' },
          { key: 'vitals',        label: 'Vitals' },
          { key: 'bills',         label: 'Bills' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Timeline ── */}
      {tab === 'timeline' && (
        <div className="relative pl-10">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-100"/>
          {timeline.length === 0 ? (
            <Card><p className="text-sm text-slate-400 text-center py-6">No history yet.</p></Card>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-10 top-3 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow
                    ${item.type === 'rx' ? 'bg-primary' : item.type === 'bill' ? 'bg-success' : 'bg-accent'}`}>
                    {item.type === 'rx'    && <Pill     className="w-3.5 h-3.5 text-white"/>}
                    {item.type === 'bill'  && <Receipt  className="w-3.5 h-3.5 text-white"/>}
                    {item.type === 'vital' && <Activity className="w-3.5 h-3.5 text-white"/>}
                  </div>
                  <Card className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={item.type === 'rx' ? 'primary' : item.type === 'bill' ? 'success' : 'accent'} className="capitalize">
                            {item.type === 'rx' ? 'Prescription' : item.type === 'bill' ? 'Bill' : 'Vitals'}
                          </Badge>
                          <span className="text-xs text-slate-400">{format(item.date, 'dd MMM yyyy, hh:mm a')}</span>
                        </div>
                        {item.type === 'rx' && (
                          <>
                            <p className="font-semibold text-sm text-slate-700">{item.data.rxNo}</p>
                            {item.data.diagnosis && <p className="text-xs text-slate-500 mt-0.5">Dx: {item.data.diagnosis}</p>}
                            {item.data.medicines?.length > 0 && (
                              <p className="text-xs text-slate-400 mt-0.5">{item.data.medicines.slice(0,3).map(m => m.medicineName).join(', ')}{item.data.medicines.length > 3 ? ` +${item.data.medicines.length-3}` : ''}</p>
                            )}
                          </>
                        )}
                        {item.type === 'bill' && (
                          <>
                            <p className="font-semibold text-sm text-slate-700">{item.data.billNo} — ₹{item.data.total.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-slate-500">Paid: ₹{item.data.amountPaid.toLocaleString('en-IN')} • {item.data.paymentStatus}</p>
                          </>
                        )}
                        {item.type === 'vital' && (
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            {item.data.bp    && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-medium">BP: {item.data.bp}</span>}
                            {item.data.sugar && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg font-medium">Sugar: {item.data.sugar}</span>}
                            {item.data.weight&& <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-medium">{item.data.weight}kg</span>}
                            {item.data.temp  && <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-lg font-medium">{item.data.temp}°F</span>}
                            {item.data.spo2  && <span className="text-xs bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-lg font-medium">SpO2:{item.data.spo2}%</span>}
                            {item.data.pulse && <span className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-lg font-medium">{item.data.pulse}/min</span>}
                          </div>
                        )}
                      </div>
                      {(item.type === 'rx' || item.type === 'bill') && (
                        <button onClick={() => navigate(item.type === 'rx' ? `/prescriptions/${item.data.id}` : `/billing/${item.data.id}`)}
                          className="text-xs text-primary hover:underline ml-3 flex-shrink-0 font-medium">View →</button>
                      )}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Prescriptions ── */}
      {tab === 'prescriptions' && (
        <div className="space-y-3">
          {rxHistory.length === 0
            ? <Card><p className="text-center text-slate-400 text-sm py-6">No prescriptions yet.</p></Card>
            : rxHistory.map(rx => (
              <div key={rx.id} onClick={() => navigate(`/prescriptions/${rx.id}`)}
                className="card cursor-pointer hover:shadow-modal transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="primary">{rx.rxNo}</Badge>
                      <span className="text-xs text-slate-400">{format(new Date(rx.date), 'dd MMM yyyy')}</span>
                    </div>
                    {rx.complaint && <p className="text-xs text-slate-500">CC: {rx.complaint}</p>}
                    {rx.diagnosis && <p className="text-xs text-slate-500">Dx: {rx.diagnosis}</p>}
                    {rx.medicines?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{rx.medicines.slice(0,3).map(m => m.medicineName).join(', ')}</p>
                    )}
                  </div>
                  <span className="text-primary font-bold">→</span>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* ── Documents (fitness, medical leave, referrals) ── */}
      {tab === 'documents' && (
        <PatientDocumentsTab patientId={id}/>
      )}

      {/* ── Lab Results ── */}
      {tab === 'labResults' && (
        <PatientLabResultsTab patientId={id}/>
      )}

      {/* ── Vitals ── */}
      {tab === 'vitals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4"/>} onClick={() => setShowVital(v => !v)}>
              Record Vitals
            </Button>
          </div>
          {showVital && (
            <Card>
              <h3 className="font-bold text-slate-700 mb-3">Record Today's Vitals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {[
                  { key:'bp',     label:'Blood Pressure', placeholder:'120/80' },
                  { key:'sugar',  label:'Blood Sugar',    placeholder:'110 mg/dL' },
                  { key:'weight', label:'Weight (kg)',     placeholder:'70' },
                  { key:'temp',   label:'Temperature °F', placeholder:'98.6' },
                  { key:'spo2',   label:'SpO2 %',         placeholder:'98' },
                  { key:'pulse',  label:'Pulse/min',      placeholder:'72' },
                ].map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" placeholder={f.placeholder}
                      value={vitalForm[f.key]} onChange={e => setVitalForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="form-group mb-3">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Any notes..." value={vitalForm.notes}
                  onChange={e => setVitalForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" loading={savingV} onClick={saveVital}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowVital(false)}>Cancel</Button>
              </div>
            </Card>
          )}
          {vitals.length === 0
            ? <Card><p className="text-center text-slate-400 text-sm py-6">No vital records yet.</p></Card>
            : vitals.map((v, i) => (
              <Card key={i} className="p-4">
                <p className="text-xs text-slate-400 mb-2">{format(new Date(v.date), 'dd MMM yyyy, hh:mm a')}</p>
                <div className="flex flex-wrap gap-2">
                  {v.bp    && <span className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-xl font-medium">BP: {v.bp}</span>}
                  {v.sugar && <span className="text-sm bg-orange-50 text-orange-600 px-3 py-1 rounded-xl font-medium">Sugar: {v.sugar}</span>}
                  {v.weight&& <span className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-xl font-medium">Wt: {v.weight}kg</span>}
                  {v.temp  && <span className="text-sm bg-yellow-50 text-yellow-600 px-3 py-1 rounded-xl font-medium">Temp: {v.temp}°F</span>}
                  {v.spo2  && <span className="text-sm bg-cyan-50 text-cyan-600 px-3 py-1 rounded-xl font-medium">SpO2: {v.spo2}%</span>}
                  {v.pulse && <span className="text-sm bg-pink-50 text-pink-600 px-3 py-1 rounded-xl font-medium">Pulse: {v.pulse}/min</span>}
                  {v.notes && <span className="text-sm text-slate-500 italic">— {v.notes}</span>}
                </div>
              </Card>
          ))}
        </div>
      )}

      {/* ── Bills ── */}
      {tab === 'bills' && (
        <div className="space-y-3">
          {bills.length === 0
            ? <Card><p className="text-center text-slate-400 text-sm py-6">No bills yet.</p></Card>
            : bills.map(b => (
              <div key={b.id} onClick={() => navigate(`/billing/${b.id}`)}
                className="card cursor-pointer hover:shadow-modal transition-shadow flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="gray">{b.billNo}</Badge>
                    <Badge variant={b.paymentStatus === 'Paid' ? 'success' : b.paymentStatus === 'Partial' ? 'warning' : 'danger'}>
                      {b.paymentStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">{format(new Date(b.date), 'dd MMM yyyy')} • {b.paymentMode}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">₹{b.total.toLocaleString('en-IN')}</p>
                  {b.balance > 0 && <p className="text-xs text-danger">Due: ₹{b.balance.toLocaleString('en-IN')}</p>}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Documents tab content ─────────────────────────────────
const DOC_TYPE_BADGE = {
  FITNESS_CERT: { label: 'Fitness',  variant: 'success' },
  MEDICAL_CERT: { label: 'Medical',  variant: 'warning' },
  REFERRAL:     { label: 'Referral', variant: 'primary' },
}

function PatientDocumentsTab({ patientId }) {
  const navigate = useNavigate()
  const [docs, setDocs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/documents/patient/${patientId}`, { silent: true })
      .then(r => setDocs(Array.isArray(r?.data?.data) ? r.data.data : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <Card><p className="text-center text-slate-400 text-sm py-6">Loading…</p></Card>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="primary" size="sm" icon={<Plus className="w-4 h-4"/>}
          onClick={() => navigate(`/documents/new?patient=${patientId}`)}
        >
          New Certificate
        </Button>
      </div>

      {docs.length === 0 ? (
        <Card><p className="text-center text-slate-400 text-sm py-6">No certificates issued yet.</p></Card>
      ) : (
        docs.map(d => {
          const badge = DOC_TYPE_BADGE[d.type] || { label: d.type, variant: 'primary' }
          return (
            <div key={d.id} onClick={() => navigate(`/documents/${d.id}/view`)}
              className="card cursor-pointer hover:shadow-modal transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <span className="font-mono text-xs font-bold text-slate-700">{d.docNo}</span>
                    <span className="text-xs text-slate-400">{format(new Date(d.createdAt), 'dd MMM yyyy')}</span>
                  </div>
                  {d.diagnosis && <p className="text-xs text-slate-500">{d.diagnosis}</p>}
                  {d.doctor?.name && <p className="text-xs text-slate-400 mt-0.5">Issued by {d.doctor.name}</p>}
                </div>
                <span className="text-primary font-bold">→</span>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
// ── Lab Results tab content ───────────────────────────────────────────────
// Shows a patient's lab values over time across ALL their prescriptions, with
// trend charts for tests that have 2+ data points and a master table at the
// bottom. Filters: which test(s) to focus on, and a time range.
//
// Data source: /lab-results/patient/:id (existing endpoint, returns up to 500
// most-recent results with values + prescription metadata). Grouping/charting
// is done client-side so the doctor can re-filter without extra API calls.
function PatientLabResultsTab({ patientId }) {
  const [results,    setResults]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')   // 'all' or a category name
  const [rangeFilter, setRangeFilter] = useState('all') // 'all' | '3m' | '6m' | '1y'

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    api.get(`/lab-results/patient/${patientId}`).then(({ data }) => {
      setResults(data.data || [])
    }).catch(() => {
      toast.error('Could not load lab results')
      setResults([])
    }).finally(() => setLoading(false))
  }, [patientId])

  // Apply time-range filter (does NOT mutate `results` so resetting is instant).
  const filteredByRange = (() => {
    if (rangeFilter === 'all') return results
    const cutoff = new Date()
    if (rangeFilter === '3m') cutoff.setMonth(cutoff.getMonth() - 3)
    if (rangeFilter === '6m') cutoff.setMonth(cutoff.getMonth() - 6)
    if (rangeFilter === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)
    return results.filter(r => new Date(r.resultDate) >= cutoff)
  })()

  // Group: Map<testKey, { testName, category, rows: LabResult[] }>. testKey uses
  // labTestId when present so two records of the same test (across different Rx)
  // group together; falls back to testName for free-text catalog gaps.
  const testGroups = (() => {
    const groups = new Map()
    for (const r of filteredByRange) {
      const key = r.labTestId || `name:${r.testName}`
      if (!groups.has(key)) {
        groups.set(key, { testName: r.testName, category: r.testCategory || 'Other', rows: [] })
      }
      groups.get(key).rows.push(r)
    }
    return groups
  })()

  // Tests visible after applying the category filter — used by both charts and the table.
  // 'all' = all categories, otherwise only tests whose category matches.
  const visibleTestKeys = (() => {
    const all = Array.from(testGroups.entries())
    if (categoryFilter === 'all') return all.map(([k]) => k)
    return all.filter(([, g]) => g.category === categoryFilter).map(([k]) => k)
  })()

  // Helper: numeric out-of-range check (skips non-numeric strings like "Negative").
  const isOutOfRange = (value, low, high) => {
    if (value == null || value === '') return false
    const n = parseFloat(value)
    if (Number.isNaN(n)) return false
    if (typeof low  === 'number' && n < low)  return true
    if (typeof high === 'number' && n > high) return true
    return false
  }

  // For ONE test, build per-field chart series. Each field becomes its own chart
  // because units (g/dL vs cells/µL vs %) make a single multi-line chart unreadable.
  // We chart structured `values` AND numeric `freeTextResult` — many simple tests
  // (KFT, single-marker biochem) save the value as freeTextResult, and skipping
  // those would silently hide trends the doctor expects to see.
  const buildChartsForTest = (group) => {
    const fieldMap = new Map()  // fieldKey → { label, unit, normalLow, normalHigh, points: [{ date, value }] }
    for (const r of group.rows) {
      // Structured field values — preferred path for multi-field tests like CBC.
      for (const v of (r.values || [])) {
        if (!fieldMap.has(v.fieldKey)) {
          fieldMap.set(v.fieldKey, {
            fieldKey:   v.fieldKey,
            label:      v.fieldLabel,
            unit:       v.fieldUnit,
            normalLow:  v.normalLow,
            normalHigh: v.normalHigh,
            points:     [],
          })
        }
        const numeric = parseFloat(v.value)
        if (!Number.isNaN(numeric)) {
          fieldMap.get(v.fieldKey).points.push({
            date:    r.resultDate,
            dateMs:  new Date(r.resultDate).getTime(),
            display: format(new Date(r.resultDate), 'd MMM'),
            value:   numeric,
          })
        }
      }
      // Free-text fallback — if the doctor entered a numeric reading directly
      // (no fieldKey), graph it under a synthetic "__freetext__" field so it
      // still appears as a trend. Skips truly textual results like "Negative".
      if (r.freeTextResult && String(r.freeTextResult).trim()) {
        const numeric = parseFloat(r.freeTextResult)
        if (!Number.isNaN(numeric)) {
          if (!fieldMap.has('__freetext__')) {
            fieldMap.set('__freetext__', {
              fieldKey:   '__freetext__',
              label:      group.testName,   // chart label = test name (no separate field)
              unit:       null,
              normalLow:  null,
              normalHigh: null,
              points:     [],
            })
          }
          fieldMap.get('__freetext__').points.push({
            date:    r.resultDate,
            dateMs:  new Date(r.resultDate).getTime(),
            display: format(new Date(r.resultDate), 'd MMM'),
            value:   numeric,
          })
        }
      }
    }
    // Sort each field's points oldest-first so the line draws left-to-right by time
    for (const f of fieldMap.values()) f.points.sort((a, b) => a.dateMs - b.dateMs)
    // Only fields with 2+ points qualify as a trend
    return Array.from(fieldMap.values()).filter(f => f.points.length >= 2)
  }

  // Master table data: unique resultDates DESC across all visible tests, then for
  // each (test × field × date) the value. Rendered as an HTML table below charts.
  const buildTableData = () => {
    const rowsForTable = []   // [{ category, testName, fieldLabel, fieldUnit, normalLow, normalHigh, valuesByDate: {date: string} }]
    const allDates = new Set()
    for (const key of visibleTestKeys) {
      const g = testGroups.get(key); if (!g) continue
      // Collect all field metas for this test
      const fieldMap = new Map()
      let anyFreeText = false
      for (const r of g.rows) {
        allDates.add(r.resultDate)
        if (r.freeTextResult && String(r.freeTextResult).trim()) anyFreeText = true
        for (const v of (r.values || [])) {
          if (!fieldMap.has(v.fieldKey)) {
            fieldMap.set(v.fieldKey, { label: v.fieldLabel, unit: v.fieldUnit, normalLow: v.normalLow, normalHigh: v.normalHigh })
          }
        }
      }
      const testHasMultipleFields = fieldMap.size > 1
      for (const [fieldKey, meta] of fieldMap.entries()) {
        const valuesByDate = {}
        for (const r of g.rows) {
          const v = (r.values || []).find(x => x.fieldKey === fieldKey)
          if (v) valuesByDate[r.resultDate] = v.value
        }
        rowsForTable.push({
          category:   g.category,
          testName:   g.testName,
          showTestSubHeader: testHasMultipleFields,
          fieldLabel: meta.label,
          fieldUnit:  meta.unit,
          normalLow:  meta.normalLow,
          normalHigh: meta.normalHigh,
          valuesByDate,
        })
      }
      if (anyFreeText) {
        const valuesByDate = {}
        for (const r of g.rows) {
          if (r.freeTextResult) valuesByDate[r.resultDate] = r.freeTextResult
        }
        rowsForTable.push({
          category:   g.category,
          testName:   g.testName,
          showTestSubHeader: false,
          fieldLabel: g.testName,
          fieldUnit:  null,
          normalLow:  null,
          normalHigh: null,
          valuesByDate,
        })
      }
    }
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())  // newest first
    // Group by category for rendering
    const byCategory = new Map()
    for (const row of rowsForTable) {
      if (!byCategory.has(row.category)) byCategory.set(row.category, [])
      byCategory.get(row.category).push(row)
    }
    return { dates: sortedDates, byCategory }
  }

  const tableData = buildTableData()

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
  }

  if (results.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FlaskConical className="w-14 h-14 text-slate-300 mx-auto mb-4"/>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No lab results yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Test outcomes recorded on this patient's prescriptions will appear here as charts and a values table over time.
        </p>
      </Card>
    )
  }

  // For the category filter dropdown — sorted by category name with test counts
  const categoryCounts = (() => {
    const counts = new Map()
    for (const g of testGroups.values()) {
      counts.set(g.category, (counts.get(g.category) || 0) + 1)
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))
  })()

  // Quick stats for the header strip
  const totalDates = new Set(filteredByRange.map(r => r.resultDate)).size
  const flagCount = (() => {
    let n = 0
    for (const r of filteredByRange) {
      for (const v of (r.values || [])) {
        if (isOutOfRange(v.value, v.normalLow, v.normalHigh)) n++
      }
    }
    return n
  })()

  return (
    <div className="space-y-5">
      {/* Filter strip */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400"/>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category:</label>
            <select className="form-select text-sm py-1.5 px-2 min-w-[180px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories ({categoryCounts.length})</option>
              {categoryCounts.map(([cat, count]) => (
                <option key={cat} value={cat}>{cat} ({count} test{count !== 1 ? 's' : ''})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Period:</label>
            <select className="form-select text-sm py-1.5 px-2"
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value)}>
              <option value="all">All time</option>
              <option value="1y">Last 1 year</option>
              <option value="6m">Last 6 months</option>
              <option value="3m">Last 3 months</option>
            </select>
          </div>
          {(categoryFilter !== 'all' || rangeFilter !== 'all') && (
            <button type="button"
              onClick={() => { setCategoryFilter('all'); setRangeFilter('all') }}
              className="text-xs text-slate-500 hover:text-danger inline-flex items-center gap-1">
              <X className="w-3 h-3"/> Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span><strong className="text-slate-700">{totalDates}</strong> recording{totalDates !== 1 ? 's' : ''}</span>
            {flagCount > 0 && (
              <span className="inline-flex items-center gap-1 text-danger">
                <AlertTriangle className="w-3.5 h-3.5"/> <strong>{flagCount}</strong> out of range
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Charts — one per (test × field) with 2+ data points */}
      {visibleTestKeys.length > 0 && (() => {
        const chartCards = []
        for (const key of visibleTestKeys) {
          const g = testGroups.get(key); if (!g) continue
          const charts = buildChartsForTest(g)
          for (const f of charts) {
            chartCards.push({ testKey: key, group: g, field: f })
          }
        }
        if (chartCards.length === 0) {
          return (
            <Card className="p-8 text-center">
              <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
              <p className="text-sm text-slate-500">
                No trend charts to show — at least 2 numeric values per test are needed.
                <br/>The full values table is below.
              </p>
            </Card>
          )
        }
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartCards.map(({ testKey, group, field }) => {
              const hasRange = typeof field.normalLow === 'number' || typeof field.normalHigh === 'number'
              const yMin = (() => {
                const vals = field.points.map(p => p.value)
                const dataMin = Math.min(...vals)
                const refMin  = typeof field.normalLow === 'number' ? field.normalLow : dataMin
                return Math.floor(Math.min(dataMin, refMin) * 0.9)
              })()
              const yMax = (() => {
                const vals = field.points.map(p => p.value)
                const dataMax = Math.max(...vals)
                const refMax  = typeof field.normalHigh === 'number' ? field.normalHigh : dataMax
                return Math.ceil(Math.max(dataMax, refMax) * 1.1)
              })()
              return (
                <Card key={`${testKey}-${field.fieldKey}`} className="p-4">
                  <div className="flex items-baseline justify-between mb-3 gap-2">
                    <div className="min-w-0">
                      {/* Test name takes primary visual weight — that's what the
                          doctor scans for. Field name (e.g. "Hemoglobin" inside CBC)
                          drops to a secondary label below. For free-text-charted
                          tests we hide the duplicate field label since it equals
                          the test name. */}
                      <h4 className="font-semibold text-slate-800 text-sm truncate">{group.testName}</h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        <span className="text-primary font-medium">{group.category}</span>
                        {field.fieldKey !== '__freetext__' && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>{field.label}</span>
                          </>
                        )}
                        {field.unit && <span className="ml-1">({field.unit})</span>}
                      </p>
                    </div>
                    {hasRange && (
                      <span className="text-[10px] bg-success/10 text-success font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        Normal: {field.normalLow ?? '—'}{typeof field.normalHigh === 'number' ? `–${field.normalHigh}` : '+'}
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={field.points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                      <XAxis dataKey="display" tick={{ fontSize: 11 }} stroke="#94a3b8"/>
                      <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} stroke="#94a3b8"/>
                      {hasRange && (
                        <ReferenceArea
                          y1={typeof field.normalLow === 'number' ? field.normalLow : yMin}
                          y2={typeof field.normalHigh === 'number' ? field.normalHigh : yMax}
                          fill="#43A047" fillOpacity={0.08} stroke="none"/>
                      )}
                      <Tooltip
                        formatter={(value) => [`${value}${field.unit ? ' ' + field.unit : ''}`, field.label]}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload
                          return p ? format(new Date(p.date), 'd MMM yyyy') : label
                        }}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                      <Line type="monotone" dataKey="value" stroke="#1565C0" strokeWidth={2}
                        dot={(props) => {
                          const flag = isOutOfRange(props.payload.value, field.normalLow, field.normalHigh)
                          return <circle key={props.index} cx={props.cx} cy={props.cy} r={4}
                            fill={flag ? '#E53935' : '#1565C0'}
                            stroke="#fff" strokeWidth={2}/>
                        }}
                        activeDot={{ r: 6 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )
            })}
          </div>
        )
      })()}

      {/* Master table — every test × every date with values */}
      {tableData.dates.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 text-sm">All Recorded Values</h4>
            <span className="text-xs text-slate-500">
              {tableData.dates.length} date{tableData.dates.length !== 1 ? 's' : ''} · newest first
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[200px]">Test</th>
                  {tableData.dates.map(d => (
                    <th key={d} className="text-center py-2 px-3 font-semibold text-slate-700 whitespace-nowrap min-w-[80px]">
                      {format(new Date(d), 'd MMM yyyy')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(tableData.byCategory.entries()).map(([cat, rows]) => (
                  <Fragment key={cat}>
                    <tr className="bg-blue-50/40">
                      <td colSpan={tableData.dates.length + 1} className="py-1.5 px-3 font-bold text-slate-700 uppercase text-[10px] tracking-wide sticky left-0 bg-blue-50/40">
                        {cat}
                      </td>
                    </tr>
                    {rows.map((row, idx) => (
                      <tr key={`${row.testName}-${row.fieldLabel}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className={`py-1.5 px-3 sticky left-0 bg-white ${row.showTestSubHeader ? 'pl-6' : 'pl-3'}`}>
                          {row.showTestSubHeader && (
                            <span className="text-[10px] text-slate-400 block leading-tight">{row.testName}</span>
                          )}
                          <span className="text-slate-800">{row.fieldLabel}</span>
                          {row.fieldUnit && <span className="text-slate-400 ml-1">({row.fieldUnit})</span>}
                        </td>
                        {tableData.dates.map(d => {
                          const v = row.valuesByDate[d]
                          const flag = isOutOfRange(v, row.normalLow, row.normalHigh)
                          return (
                            <td key={d} className={`py-1.5 px-3 text-center whitespace-nowrap ${flag ? 'font-bold text-danger bg-red-50/50' : 'text-slate-800'}`}>
                              {v != null && v !== '' ? v : <span className="text-slate-300">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
