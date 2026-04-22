import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ui'
import { Plus, Search, Eye, Edit2, User, X, FileText, Receipt, AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Card, Button, Badge, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const PREFIXES      = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Master', 'Er']
const BLOOD_GROUPS  = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const LANGUAGES     = ['English','Hindi','Marathi']
const COMMON_ALLERGIES  = ['Penicillin','Sulfa drugs','Aspirin','Ibuprofen','Latex','Pollen','Dust','Nuts','Eggs','Milk']
const COMMON_CONDITIONS = ['Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','Hyperlipidemia','Heart Disease','Arthritis','COPD','CKD','Epilepsy']

// Auto-set gender from prefix
const PREFIX_GENDER = {
  'Mr':'Male', 'Master':'Male', 'Er':'Male',
  'Mrs':'Female', 'Ms':'Female',
}

const emptyForm = {
  prefix:'Mr', name:'', age:'', dob:'', gender:'Male', phone:'',
  email:'', address:'', bloodGroup:'', existingId:'',
  preferredLanguage:'English', allergies:[], chronicConditions:[],
}

// ── Error / Warning Banner inside modal ───────────────────
function AlertBanner({ type='error', message, onDismiss }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-danger',
    warning: 'bg-orange-50 border-orange-200 text-warning',
    info:    'bg-blue-50 border-blue-200 text-primary',
    success: 'bg-green-50 border-green-200 text-success',
  }
  const icons = {
    error:   <AlertCircle   className="w-4 h-4 flex-shrink-0"/>,
    warning: <AlertTriangle className="w-4 h-4 flex-shrink-0"/>,
    info:    <Info          className="w-4 h-4 flex-shrink-0"/>,
    success: <CheckCircle   className="w-4 h-4 flex-shrink-0"/>,
  }
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      {onDismiss && <button onClick={onDismiss} className="opacity-60 hover:opacity-100 ml-1 flex-shrink-0"><X className="w-3.5 h-3.5"/></button>}
    </div>
  )
}

// ── Chip input for allergies/conditions ───────────────────
function ChipInput({ label, value, onChange, suggestions }) {
  const [q, setQ] = useState('')
  const add = (v) => { const t=v.trim(); if(t&&!value.includes(t)) onChange([...value,t]); setQ('') }
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
        <input className="form-input flex-1 text-sm" placeholder="Type and press Enter..."
          value={q} onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'){add(q);e.preventDefault()} }}/>
        <Button type="button" variant="outline" size="sm" onClick={()=>add(q)}>Add</Button>
      </div>
    </div>
  )
}

// ── Patient Modal ─────────────────────────────────────────
function PatientModal({ mode, initialForm, onClose, onSaved, navigate }) {
  const [form, setForm]         = useState(initialForm || { ...emptyForm })
  const [saving, setSaving]     = useState(false)
  const [warning, setWarning]   = useState('')
  const [error, setError]       = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [nextCode, setNextCode] = useState('')
  const [nameResults, setNameResults]   = useState([])
  const [showNameDrop, setShowNameDrop] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [isDirty, setIsDirty]   = useState(false)

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setIsDirty(true)
    // Clear field error on change
    if (fieldErrors[k]) setFieldErrors(p => ({ ...p, [k]: '' }))
    setError('')
  }

  // Load next patient code
  useEffect(() => {
    if (mode !== 'add') return
    api.get('/patients/next-code')
      .then(r => setNextCode(r.data.data?.nextCode || ''))
      .catch(() => {})
  }, [mode])

  // Auto-gender from prefix
  useEffect(() => {
    if (mode === 'edit') return
    const g = PREFIX_GENDER[form.prefix]
    if (g) { setForm(f => ({ ...f, gender: g })); setIsDirty(false) }
  }, [form.prefix])

  // Auto-calc age from DOB
  useEffect(() => {
    if (!form.dob) return
    const today = new Date(); const birth = new Date(form.dob)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    if (age >= 0 && age <= 150) setForm(f => ({ ...f, age: String(age) }))
  }, [form.dob])

  // Existing patient search
  useEffect(() => {
    if (!form.name || form.name.length < 2 || mode === 'edit') { setNameResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${encodeURIComponent(form.name)}`)
        setNameResults(data.data?.slice(0, 5) || [])
        setShowNameDrop(true)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [form.name])

  // Duplicate phone warning (non-blocking)
  useEffect(() => {
    if (form.phone?.length !== 10 || mode === 'edit') { setWarning(''); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${form.phone}`)
        const dup = data.data?.find(p => p.phone === form.phone)
        setWarning(dup ? `Phone already used by ${dup.patientCode} — ${dup.name}` : '')
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [form.phone])

  // Validate form fields
  const validate = () => {
    const errs = {}
    if (!form.name.trim())        errs.name   = 'Patient name is required'
    if (!form.phone)               errs.phone  = 'Phone number is required'
    else if (form.phone.length !== 10) errs.phone = 'Phone must be exactly 10 digits'
    if (!form.age && !form.dob)    errs.age    = 'Enter Age or Date of Birth'
    if (!form.gender)              errs.gender = 'Gender is required'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      setError('Please fix the errors below before saving.')
      return false
    }
    return true
  }

  // Handle backdrop click — show confirm if form is dirty
  const handleBackdropClick = () => {
    if (isDirty) setConfirmClose(true)
    else onClose()
  }

  const handleSubmit = async (redirect = null) => {
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      let res
      if (mode === 'edit') {
        res = await api.put(`/patients/${initialForm.id}`, form)
        toast.success('Patient updated successfully!')
        onSaved(res.data.data)
        onClose()
      } else {
        res = await api.post('/patients', form)
        const patient = res.data.data
        if (patient.warning) toast(patient.warning, { icon: '⚠️', duration: 5000 })
        toast.success(`✅ Patient ${patient.patientCode} registered!`)
        setIsDirty(false)
        onSaved(patient)
        if (redirect === 'rx')   navigate(`/prescriptions/new?patientId=${patient.id}`)
        else if (redirect === 'bill') navigate(`/billing/new?patientId=${patient.id}`)
        else onClose()
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again.'
      const status = err?.response?.status

      // Map common errors to friendly messages
      if (status === 400) {
        setError(msg.includes('Name') ? 'Patient name is required.' :
                 msg.includes('Phone') ? 'Phone number is required.' :
                 msg.includes('age') ? 'Please enter age or date of birth.' :
                 msg.includes('Gender') ? 'Please select a gender.' :
                 msg || 'Validation failed. Please check all required fields.')
      } else if (status === 409) {
        setError(msg)
      } else if (status === 500) {
        setError('Server error. Please try again in a moment. If the problem persists, contact support.')
      } else if (!navigator.onLine) {
        setError('No internet connection. Please check your network and try again.')
      } else {
        setError(msg || 'Failed to save patient. Please try again.')
      }
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleBackdropClick}/>

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">
                {mode === 'edit' ? 'Edit Patient' : 'Add New Patient'}
              </h2>
              {mode === 'add' && nextCode && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Will be assigned: <span className="font-mono font-semibold text-primary">{nextCode}</span>
                </p>
              )}
            </div>
            <button onClick={handleBackdropClick} className="btn-ghost btn-icon">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* Error banner */}
            {error && (
              <AlertBanner type="error" message={error} onDismiss={()=>setError('')}/>
            )}

            {/* Phone duplicate warning */}
            {warning && !error && (
              <AlertBanner type="warning" message={warning}/>
            )}

            {/* Prefix + Name */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <label className="form-label">Prefix</label>
                <select className="form-select" value={form.prefix}
                  onChange={e=>{ setForm(f=>({...f,prefix:e.target.value})); setIsDirty(true) }}>
                  {PREFIXES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-9 relative">
                <label className="form-label">Full Name *</label>
                <input className={`form-input ${fieldErrors.name?'border-danger focus:border-danger':''}`}
                  placeholder="Patient name" value={form.name} onChange={set('name')} autoFocus
                  onBlur={()=>setTimeout(()=>setShowNameDrop(false), 200)}
                  onFocus={()=>form.name.length>=2&&setShowNameDrop(true)}
                />
                {fieldErrors.name && <p className="text-xs text-danger mt-1">{fieldErrors.name}</p>}

                {/* Existing patients dropdown */}
                {showNameDrop && nameResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-blue-100 max-h-44 overflow-y-auto">
                    <p className="px-3 py-1.5 text-xs font-semibold text-primary bg-blue-50 uppercase tracking-wide">
                      Existing Patients — click to view
                    </p>
                    {nameResults.map(p=>(
                      <button key={p.id} type="button"
                        onMouseDown={()=>{ navigate(`/patients/${p.id}`); onClose() }}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.patientCode} • {p.age}y {p.gender}</p>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Phone + Blood Group */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Phone * (10 digits)</label>
                <input className={`form-input ${fieldErrors.phone?'border-danger':''}`}
                  placeholder="10-digit mobile" value={form.phone} inputMode="numeric"
                  onChange={e=>{ const v=e.target.value.replace(/\D/g,'').slice(0,10); setForm(f=>({...f,phone:v})); setIsDirty(true); if(fieldErrors.phone)setFieldErrors(p=>({...p,phone:''})); setError('') }}
                  maxLength={10}/>
                {fieldErrors.phone && <p className="text-xs text-danger mt-1">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className="form-label">Blood Group</label>
                <select className="form-select" value={form.bloodGroup} onChange={set('bloodGroup')}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Gender toggle + Age + DOB */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">Gender *</label>
                <div className="flex gap-1.5 mt-1">
                  {['Male','Female','Other'].map(g=>(
                    <button key={g} type="button"
                      onClick={()=>{ setForm(f=>({...f,gender:g})); setIsDirty(true); if(fieldErrors.gender)setFieldErrors(p=>({...p,gender:''})) }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                        ${form.gender===g
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary bg-white'}`}>
                      {g==='Male'?'M':g==='Female'?'F':'Oth'}
                    </button>
                  ))}
                </div>
                {fieldErrors.gender && <p className="text-xs text-danger mt-1">{fieldErrors.gender}</p>}
              </div>
              <div>
                <label className="form-label">Age (years)</label>
                <input type="number" min="0" max="150" className={`form-input ${fieldErrors.age?'border-danger':''}`}
                  placeholder="e.g. 35"
                  value={form.age}
                  onChange={e=>{ setForm(f=>({...f,age:e.target.value,dob:''})); setIsDirty(true); if(fieldErrors.age)setFieldErrors(p=>({...p,age:''})) }}/>
                {fieldErrors.age && <p className="text-xs text-danger mt-1">{fieldErrors.age}</p>}
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-input"
                  value={form.dob} max={format(new Date(),'yyyy-MM-dd')}
                  onChange={e=>{ setForm(f=>({...f,dob:e.target.value})); setIsDirty(true); if(fieldErrors.age)setFieldErrors(p=>({...p,age:''})) }}/>
              </div>
            </div>
            <p className="text-xs text-slate-400 -mt-2">Enter age in years <strong>or</strong> pick date of birth — age auto-fills from DOB</p>

            {/* Preferred Language */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Preferred Language</label>
                <div className="flex gap-1.5 mt-1">
                  {LANGUAGES.map(l=>(
                    <button key={l} type="button"
                      onClick={()=>{ setForm(f=>({...f,preferredLanguage:l})); setIsDirty(true) }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                        ${form.preferredLanguage===l
                          ? 'bg-primary text-white border-primary'
                          : 'border-slate-200 text-slate-600 hover:border-primary bg-white'}`}>
                      {l==='English'?'EN':l==='Hindi'?'HI':'MR'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">
                  Existing ID <span className="text-slate-400 font-normal text-xs">(old system)</span>
                </label>
                <input className="form-input font-mono" placeholder="e.g. D11, OPD/1234"
                  value={form.existingId} onChange={set('existingId')}/>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="patient@email.com"
                value={form.email} onChange={set('email')}/>
            </div>

            {/* Address */}
            <div>
              <label className="form-label">Address</label>
              <textarea className="form-input" rows={2} placeholder="Full address"
                value={form.address} onChange={set('address')}/>
            </div>

            {/* Allergies + Chronic — only in edit mode */}
            {mode === 'edit' && (
              <>
                <div className="border-t border-slate-100 pt-4">
                  <ChipInput label="Known Allergies" value={form.allergies}
                    onChange={v=>{ setForm(f=>({...f,allergies:v})); setIsDirty(true) }}
                    suggestions={COMMON_ALLERGIES}/>
                </div>
                <ChipInput label="Chronic Conditions" value={form.chronicConditions}
                  onChange={v=>{ setForm(f=>({...f,chronicConditions:v})); setIsDirty(true) }}
                  suggestions={COMMON_CONDITIONS}/>
              </>
            )}

            {/* Action buttons */}
            <div className="border-t border-slate-100 pt-4">
              {mode === 'edit' ? (
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={handleBackdropClick}>Cancel</Button>
                  <Button type="button" variant="primary" loading={saving}
                    onClick={()=>handleSubmit()}>
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm"
                      icon={<Receipt className="w-3.5 h-3.5"/>}
                      loading={saving} onClick={()=>handleSubmit('bill')}>
                      + Create Bill
                    </Button>
                    <Button type="button" variant="outline" size="sm"
                      icon={<FileText className="w-3.5 h-3.5"/>}
                      loading={saving} onClick={()=>handleSubmit('rx')}>
                      + Prescribe
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={handleBackdropClick}>Cancel</Button>
                    <Button type="button" variant="primary" loading={saving}
                      onClick={()=>handleSubmit()}>
                      Register Patient
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Confirm close dialog */}
      {confirmClose && (
        <ConfirmDialog
          type="warning"
          title="Discard Changes?"
          message="You have unsaved information. If you close now, all entered data will be lost."
          confirmLabel="Yes, Discard"
          cancelLabel="Keep Editing"
          onConfirm={()=>{ setConfirmClose(false); onClose() }}
          onCancel={()=>setConfirmClose(false)}
        />
      )}
    </>
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
  const [modal,     setModal]     = useState(null)
  const [editPt,    setEditPt]    = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const fetchPatients = useCallback(async (p=1, q=search) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/patients?page=${p}&limit=20&search=${encodeURIComponent(q)}`)
      setPatients(data.data || [])
      setTotal(data.meta?.total || 0)
    } catch (err) {
      toast.error('Failed to load patients. Please refresh.')
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    const t = setTimeout(()=>fetchPatients(1, search), 300)
    return ()=>clearTimeout(t)
  }, [search])

  const openEdit = async (id) => {
    setLoadingEdit(true)
    try {
      const { data } = await api.get(`/patients/${id}`)
      const p = data.data
      const prefixMatch = p.name?.match(/^(Mr|Mrs|Ms|Dr|Baby|Master|Er)\s+/i)
      setEditPt({
        id: p.id,
        prefix: prefixMatch ? prefixMatch[1] : 'Mr',
        name: prefixMatch ? p.name.replace(prefixMatch[0],'').trim() : (p.name||''),
        age: p.age || '',
        dob: p.dob ? format(new Date(p.dob),'yyyy-MM-dd') : '',
        gender: p.gender || 'Male',
        phone: p.phone || '',
        email: p.email || '',
        address: p.address || '',
        bloodGroup: p.bloodGroup || '',
        existingId: p.existingId || '',
        preferredLanguage: p.preferredLanguage || 'English',
        allergies: p.allergies || [],
        chronicConditions: p.chronicConditions || [],
      })
      setModal('edit')
    } catch {
      toast.error('Failed to load patient details. Please try again.')
    } finally { setLoadingEdit(false) }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Patients" subtitle={`${total} registered patients`}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>setModal('add')}>
            New Patient
          </Button>
        }
      />

      {/* Search */}
      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input className="form-input pl-9"
            placeholder="Search by name, phone, patient code, old ID..."
            value={search} onChange={e=>{ setSearch(e.target.value); setPage(1) }}/>
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
      ) : patients.length === 0 ? (
        <Card className="text-center py-16">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
          <p className="font-semibold text-slate-600 mb-1">
            {search ? `No patients found for "${search}"` : 'No patients yet'}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {search ? 'Try a different name, phone, or patient code.' : 'Register your first patient to get started.'}
          </p>
          {!search && (
            <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>setModal('add')}>
              Register First Patient
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map(p=>(
            <div key={p.id} className="card hover:shadow-modal transition-shadow cursor-pointer"
              onClick={()=>navigate(`/patients/${p.id}`)}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center flex-shrink-0">
                  {p.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <Badge variant="gray">{p.patientCode}</Badge>
                    {p.existingId   && <Badge variant="accent">ID: {p.existingId}</Badge>}
                    {p.allergies?.length > 0       && <Badge variant="danger">⚠ Allergy</Badge>}
                    {p.chronicConditions?.length > 0 && <Badge variant="warning">{p.chronicConditions[0]}</Badge>}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {p.age ? `${p.age}y` : ''} {p.gender} • {p.phone}
                    {p._count?.prescriptions > 0 && ` • ${p._count.prescriptions} Rx`}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-auto" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openEdit(p.id)} title="Edit Patient"
                    disabled={loadingEdit}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/prescriptions/new?patientId=${p.id}`)} title="New Prescription"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-accent hover:bg-cyan-50 rounded-lg transition-colors">
                    <FileText className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/billing/new?patientId=${p.id}`)} title="New Bill"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-success hover:bg-green-50 rounded-lg transition-colors">
                    <Receipt className="w-4 h-4"/>
                  </button>
                  <button onClick={()=>navigate(`/patients/${p.id}`)} title="View Details"
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
          <Button variant="ghost" size="sm" disabled={page===1}
            onClick={()=>{ const p=page-1; setPage(p); fetchPatients(p) }}>← Prev</Button>
          <span className="flex items-center text-sm text-slate-500">
            Page {page} of {Math.ceil(total/20)} ({total} patients)
          </span>
          <Button variant="ghost" size="sm" disabled={page>=Math.ceil(total/20)}
            onClick={()=>{ const p=page+1; setPage(p); fetchPatients(p) }}>Next →</Button>
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && (
        <PatientModal mode="add"
          onClose={()=>setModal(null)}
          onSaved={()=>fetchPatients(1)}
          navigate={navigate}/>
      )}
      {modal === 'edit' && editPt && (
        <PatientModal mode="edit" initialForm={editPt}
          onClose={()=>{ setModal(null); setEditPt(null) }}
          onSaved={()=>fetchPatients(page)}
          navigate={navigate}/>
      )}
    </div>
  )
}
