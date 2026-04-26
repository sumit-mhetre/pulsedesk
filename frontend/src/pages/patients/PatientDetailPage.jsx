import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Receipt, Activity, Plus, Pill, AlertTriangle } from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

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
