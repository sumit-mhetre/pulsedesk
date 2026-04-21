import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit2, Phone, User, X, AlertTriangle, FileText, Receipt } from 'lucide-react'
import { Card, Button, Badge, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const PREFIXES     = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Master', 'Miss', 'Er']
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const GENDERS      = ['Male','Female','Other']
const COMMON_ALLERGIES  = ['Penicillin','Sulfa drugs','Aspirin','Ibuprofen','Latex','Pollen','Dust','Nuts','Eggs','Milk']
const COMMON_CONDITIONS = ['Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','Hyperlipidemia','Heart Disease','Arthritis','COPD','CKD','Epilepsy']

const emptyForm = {
  prefix:'Mr', name:'', age:'', dob:'', gender:'Male', phone:'',
  email:'', address:'', bloodGroup:'', existingId:'',
  allergies:[], chronicConditions:[],
}

// ── Tag chip input ────────────────────────────────────────
function ChipInput({ label, value, onChange, suggestions }) {
  const [q, setQ] = useState('')
  const add = (v) => {
    const t = v.trim(); if (t && !value.includes(t)) onChange([...value, t]); setQ('')
  }
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {suggestions.filter(s=>!value.includes(s)).map(s=>(
          <button key={s} type="button" onClick={()=>add(s)}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-primary hover:text-primary hover:bg-blue-50 transition-colors">
            {s}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(v=>(
            <span key={v} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-medium">
              {v}
              <button type="button" onClick={()=>onChange(value.filter(x=>x!==v))} className="hover:text-danger"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className="form-input flex-1 text-sm" placeholder={`Type and press Enter...`}
          value={q} onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'){add(q);e.preventDefault()} }}
        />
        <Button type="button" variant="outline" size="sm" onClick={()=>add(q)}>Add</Button>
      </div>
    </div>
  )
}

// ── Add / Edit Patient Modal ──────────────────────────────
function PatientModal({ mode, initialForm, onClose, onSaved, navigate }) {
  const [form, setForm]       = useState(initialForm || { ...emptyForm })
  const [saving, setSaving]   = useState(false)
  const [warning, setWarning] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [showNameDrop, setShowNameDrop] = useState(false)
  const nameRef = useRef(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Search existing patients while typing name
  useEffect(() => {
    if (!form.name || form.name.length < 2 || mode === 'edit') { setNameResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${form.name}`)
        setNameResults(data.data?.slice(0,5) || [])
        setShowNameDrop(true)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [form.name])

  // Phone duplicate warning (non-blocking)
  useEffect(() => {
    if (form.phone?.length !== 10 || mode === 'edit') { setWarning(''); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${form.phone}`)
        const dup = data.data?.find(p => p.phone === form.phone)
        if (dup) setWarning(`⚠ Phone already used by ${dup.patientCode} — ${dup.name}`)
        else setWarning('')
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [form.phone])

  const handleSubmit = async (e, redirect) => {
    e?.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.phone) { toast.error('Phone is required'); return }
    if (form.phone.length !== 10) { toast.error('Phone must be 10 digits'); return }
    setSaving(true)
    try {
      let res
      if (mode === 'edit') {
        res = await api.put(`/patients/${initialForm.id}`, form)
        toast.success('Patient updated!')
        onSaved(res.data.data)
        onClose()
      } else {
        res = await api.post('/patients', form)
        const patient = res.data.data
        if (patient.warning) toast(`ℹ ${patient.warning}`, { icon: '⚠️' })
        toast.success(`Patient ${patient.patientCode} registered!`)
        onSaved(patient)
        if (redirect === 'rx')   navigate(`/prescriptions/new?patientId=${patient.id}`)
        else if (redirect === 'bill') navigate(`/billing/new?patientId=${patient.id}`)
        else onClose()
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save patient')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="font-bold text-slate-800 text-lg">{mode === 'edit' ? 'Edit Patient' : 'Add New Patient'}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={(e)=>handleSubmit(e, null)} className="p-6 space-y-5">
          {/* Name with prefix */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 form-group">
              <label className="form-label">Prefix</label>
              <select className="form-select" value={form.prefix} onChange={set('prefix')}>
                {PREFIXES.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-9 form-group relative">
              <label className="form-label">Full Name *</label>
              <input ref={nameRef} className="form-input" placeholder="Patient name" required
                value={form.name} onChange={set('name')} autoFocus
                onBlur={()=>setTimeout(()=>setShowNameDrop(false),200)}
                onFocus={()=>form.name.length>=2&&setShowNameDrop(true)}
              />
              {/* Existing patients dropdown */}
              {showNameDrop && nameResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto">
                  <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase bg-blue-50/50">Existing Patients</p>
                  {nameResults.map(p=>(
                    <button key={p.id} type="button" onMouseDown={()=>{ navigate(`/patients/${p.id}`); onClose() }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.patientCode} • {p.age}y {p.gender}</p>
                      </div>
                      <span className="text-xs text-slate-400">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Phone + Blood Group */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Phone * (10 digits)</label>
              <input className="form-input" placeholder="10-digit mobile" required
                value={form.phone}
                onChange={e=>{ const v=e.target.value.replace(/\D/g,'').slice(0,10); setForm(f=>({...f,phone:v})) }}
                maxLength={10} inputMode="numeric"
              />
              {warning && <p className="text-xs text-warning mt-1">{warning}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select className="form-select" value={form.bloodGroup} onChange={set('bloodGroup')}>
                <option value="">Select</option>
                {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Gender + Age + DOB */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="form-label">Gender *</label>
              <select className="form-select" value={form.gender} onChange={set('gender')}>
                {GENDERS.map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Age (years)</label>
              <input type="number" min="0" max="150" className="form-input" placeholder="Age"
                value={form.age} onChange={set('age')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input"
                value={form.dob} onChange={set('dob')}
                max={format(new Date(),'yyyy-MM-dd')}
              />
            </div>
          </div>

          {/* Email + Existing ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="patient@email.com"
                value={form.email} onChange={set('email')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Existing ID <span className="text-slate-400 font-normal">(old system ID)</span></label>
              <input className="form-input font-mono" placeholder="e.g. D11, OPD/1234"
                value={form.existingId} onChange={set('existingId')}/>
            </div>
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea className="form-input" rows={2} placeholder="Full address"
              value={form.address} onChange={set('address')}/>
          </div>

          {/* Allergies + Chronic (only in edit mode or if explicitly shown) */}
          {mode === 'edit' && (
            <>
              <ChipInput label="Known Allergies" value={form.allergies}
                onChange={v=>setForm(f=>({...f,allergies:v}))} suggestions={COMMON_ALLERGIES}/>
              <ChipInput label="Chronic Conditions" value={form.chronicConditions}
                onChange={v=>setForm(f=>({...f,chronicConditions:v}))} suggestions={COMMON_CONDITIONS}/>
            </>
          )}

          {/* Action buttons */}
          <div className="border-t border-slate-100 pt-4">
            {mode === 'edit' ? (
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="primary" loading={saving}>Save Changes</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm"
                    icon={<Receipt className="w-4 h-4"/>}
                    loading={saving}
                    onClick={(e)=>handleSubmit(e,'bill')}>
                    + Create Bill
                  </Button>
                  <Button type="button" variant="outline" size="sm"
                    icon={<FileText className="w-4 h-4"/>}
                    loading={saving}
                    onClick={(e)=>handleSubmit(e,'rx')}>
                    + Prescribe
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button type="submit" variant="primary" loading={saving}>Register Patient</Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function PatientsPage() {
  const navigate  = useNavigate()
  const [patients,  setPatients]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)  // null | 'add' | 'edit'
  const [editPt,    setEditPt]    = useState(null)

  const fetchPatients = useCallback(async (p = 1, q = search) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/patients?page=${p}&limit=20&search=${q}`)
      setPatients(data.data)
      setTotal(data.meta?.total || 0)
    } catch {} finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(1, search), 300)
    return () => clearTimeout(t)
  }, [search])

  const openEdit = async (id) => {
    const { data } = await api.get(`/patients/${id}`)
    const p = data.data
    setEditPt({
      id: p.id,
      prefix: p.prefix || 'Mr',
      name: p.name?.replace(/^(Mr|Mrs|Ms|Dr|Baby|Master|Miss|Er)\s+/i,'') || p.name,
      age: p.age || '',
      dob: p.dob ? format(new Date(p.dob),'yyyy-MM-dd') : '',
      gender: p.gender,
      phone: p.phone,
      email: p.email || '',
      address: p.address || '',
      bloodGroup: p.bloodGroup || '',
      existingId: p.existingId || '',
      allergies: p.allergies || [],
      chronicConditions: p.chronicConditions || [],
    })
    setModal('edit')
  }

  return (
    <div className="fade-in">
      <PageHeader title="Patients" subtitle={`${total} registered patients`}
        action={<Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>setModal('add')}>New Patient</Button>}
      />

      {/* Search */}
      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input className="form-input pl-9" placeholder="Search by name, phone, patient code, old ID..."
            value={search} onChange={e=>{ setSearch(e.target.value); setPage(1) }}/>
        </div>
      </Card>

      {/* Patient list */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
      ) : patients.length === 0 ? (
        <Card className="text-center py-16">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
          <p className="font-semibold text-slate-600 mb-1">{search ? 'No patients found' : 'No patients yet'}</p>
          {!search && <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>setModal('add')} className="mt-3">Register First Patient</Button>}
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id} className="card hover:shadow-modal transition-shadow cursor-pointer"
              onClick={() => navigate(`/patients/${p.id}`)}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center flex-shrink-0">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <Badge variant="gray">{p.patientCode}</Badge>
                    {p.existingId && <Badge variant="accent">ID: {p.existingId}</Badge>}
                    {p.allergies?.length > 0 && <Badge variant="danger">⚠ Allergy</Badge>}
                    {p.chronicConditions?.length > 0 && <Badge variant="warning">{p.chronicConditions[0]}</Badge>}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {p.age ? `${p.age}y` : '—'} {p.gender} • {p.phone}
                    {p._count?.prescriptions > 0 && ` • ${p._count.prescriptions} Rx`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openEdit(p.id)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/prescriptions/new?patientId=${p.id}`)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-accent hover:bg-cyan-50 rounded-lg transition-colors" title="New Prescription">
                    <FileText className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/billing/new?patientId=${p.id}`)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-success hover:bg-green-50 rounded-lg transition-colors" title="New Bill">
                    <Receipt className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/patients/${p.id}`)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                    <Eye className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="ghost" size="sm" disabled={page===1} onClick={()=>{ setPage(p=>p-1); fetchPatients(page-1) }}>← Prev</Button>
          <span className="flex items-center text-sm text-slate-500">Page {page} of {Math.ceil(total/20)}</span>
          <Button variant="ghost" size="sm" disabled={page>=Math.ceil(total/20)} onClick={()=>{ setPage(p=>p+1); fetchPatients(page+1) }}>Next →</Button>
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && (
        <PatientModal mode="add" onClose={()=>setModal(null)}
          onSaved={()=>fetchPatients(1)} navigate={navigate}/>
      )}
      {modal === 'edit' && editPt && (
        <PatientModal mode="edit" initialForm={editPt} onClose={()=>{ setModal(null); setEditPt(null) }}
          onSaved={()=>fetchPatients(page)} navigate={navigate}/>
      )}
    </div>
  )
}
