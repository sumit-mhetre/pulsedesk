import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, User, Phone, Calendar, Edit, Eye } from 'lucide-react'
import { Card, Button, Badge, PageHeader, EmptyState, Modal } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS      = ['Male', 'Female', 'Other']
const COMMON_ALLERGIES   = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Ibuprofen', 'Latex', 'Pollen', 'Dust']
const COMMON_CONDITIONS  = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Hypothyroidism', 'Hyperlipidemia', 'Heart Disease', 'Arthritis']

const emptyForm = {
  name: '', age: '', gender: 'Male', phone: '', email: '',
  address: '', bloodGroup: '', allergies: [], chronicConditions: [],
}

// ── Patient Form — defined OUTSIDE parent to prevent remount ──
function PatientForm({ form, setForm, saving, onSubmit, onCancel, mode }) {
  const [allergyInput,   setAllergyInput]   = useState('')
  const [conditionInput, setConditionInput] = useState('')

  const addTag = (field, value, setInput) => {
    const val = value.trim()
    if (!val) return
    if (!form[field].includes(val)) setForm(f => ({ ...f, [field]: [...f[field], val] }))
    setInput('')
  }

  const removeTag = (field, val) =>
    setForm(f => ({ ...f, [field]: f[field].filter(x => x !== val) }))

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <form onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-x-4">

        <div className="col-span-2 form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" placeholder="Patient full name" required
            value={form.name} onChange={set('name')} autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Age *</label>
          <input type="number" className="form-input" placeholder="Age"
            required min="0" max="150"
            value={form.age} onChange={set('age')} />
        </div>

        <div className="form-group">
          <label className="form-label">Gender *</label>
          <select className="form-select" value={form.gender} onChange={set('gender')}>
            {GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Phone *</label>
          <input className="form-input" placeholder="10-digit mobile"
            required value={form.phone} onChange={set('phone')} />
        </div>

        <div className="form-group">
          <label className="form-label">Blood Group</label>
          <select className="form-select" value={form.bloodGroup} onChange={set('bloodGroup')}>
            <option value="">Select</option>
            {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>

        <div className="col-span-2 form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="patient@email.com"
            value={form.email} onChange={set('email')} />
        </div>

        <div className="col-span-2 form-group">
          <label className="form-label">Address</label>
          <textarea className="form-input" rows={2} placeholder="Full address"
            value={form.address} onChange={set('address')} />
        </div>

        {/* Allergies */}
        <div className="col-span-2 form-group">
          <label className="form-label">Known Allergies</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {COMMON_ALLERGIES.map(a => (
              <button key={a} type="button"
                onClick={() => !form.allergies.includes(a) && setForm(f => ({ ...f, allergies: [...f.allergies, a] }))}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all
                  ${form.allergies.includes(a)
                    ? 'bg-danger text-white border-danger'
                    : 'border-slate-200 text-slate-500 hover:border-danger hover:text-danger'}`}>
                {a}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="form-input" placeholder="Type allergy and press Enter"
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag('allergies', allergyInput, setAllergyInput)
                }
              }} />
            <button type="button" className="btn btn-outline btn-sm px-3"
              onClick={() => addTag('allergies', allergyInput, setAllergyInput)}>Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.allergies.map(a => (
              <span key={a} className="badge-danger badge cursor-pointer"
                onClick={() => removeTag('allergies', a)}>{a} ×</span>
            ))}
          </div>
        </div>

        {/* Chronic Conditions */}
        <div className="col-span-2 form-group">
          <label className="form-label">Chronic Conditions</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {COMMON_CONDITIONS.map(c => (
              <button key={c} type="button"
                onClick={() => !form.chronicConditions.includes(c) && setForm(f => ({ ...f, chronicConditions: [...f.chronicConditions, c] }))}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all
                  ${form.chronicConditions.includes(c)
                    ? 'bg-warning text-white border-warning'
                    : 'border-slate-200 text-slate-500 hover:border-warning hover:text-warning'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="form-input" placeholder="Type condition and press Enter"
              value={conditionInput}
              onChange={e => setConditionInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag('chronicConditions', conditionInput, setConditionInput)
                }
              }} />
            <button type="button" className="btn btn-outline btn-sm px-3"
              onClick={() => addTag('chronicConditions', conditionInput, setConditionInput)}>Add</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.chronicConditions.map(c => (
              <span key={c} className="badge-warning badge cursor-pointer"
                onClick={() => removeTag('chronicConditions', c)}>{c} ×</span>
            ))}
          </div>
        </div>
      </div>

      <div className="modal-footer -mx-6 -mb-6 mt-4 rounded-b-2xl">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>
          {mode === 'create' ? 'Register Patient' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients,    setPatients]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [genderFilter,setGenderFilter]= useState('')
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, totalPages: 1 })
  const [modal,       setModal]       = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [form,        setForm]        = useState(emptyForm)
  const [saving,      setSaving]      = useState(false)

  const fetchPatients = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (search)       params.set('search', search)
      if (genderFilter) params.set('gender', genderFilter)
      const { data } = await api.get(`/patients?${params}`)
      setPatients(data.data)
      setPagination(data.pagination)
    } catch {
    } finally { setLoading(false) }
  }, [search, genderFilter])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => fetchPatients(1), 300)
    return () => clearTimeout(t)
  }, [fetchPatients])

  const openCreate = () => { setForm(emptyForm); setSelected(null); setModal('create') }
  const openEdit   = (p) => {
    setSelected(p)
    setForm({
      name: p.name, age: p.age, gender: p.gender,
      phone: p.phone, email: p.email || '',
      address: p.address || '', bloodGroup: p.bloodGroup || '',
      allergies: p.allergies || [],
      chronicConditions: p.chronicConditions || [],
    })
    setModal('edit')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal === 'create') {
        await api.post('/patients', form)
        toast.success('Patient registered!')
      } else {
        await api.put(`/patients/${selected.id}`, form)
        toast.success('Patient updated!')
      }
      setModal(null)
      fetchPatients(1)
    } catch {
    } finally { setSaving(false) }
  }

  const genderColor = { Male: 'primary', Female: 'accent', Other: 'gray' }

  return (
    <div className="fade-in">
      <PageHeader
        title="Patients"
        subtitle={`${pagination.total} registered patients`}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Add Patient
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="form-input pl-9"
              placeholder="Search by name, phone or patient ID..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select sm:w-40" value={genderFilter}
            onChange={e => setGenderFilter(e.target.value)}>
            <option value="">All Genders</option>
            {GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
      </Card>

      {/* Patient Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner text-primary w-8 h-8" />
        </div>
      ) : patients.length === 0 ? (
        <EmptyState icon={<User className="w-8 h-8" />} title="No patients found"
          description="Register your first patient to get started"
          action={
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Add Patient
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map(p => (
              <div key={p.id} className="card-hover group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0
                      ${p.gender === 'Male' ? 'bg-primary' : p.gender === 'Female' ? 'bg-accent' : 'bg-slate-400'}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.patientCode}</p>
                    </div>
                  </div>
                  <Badge variant={genderColor[p.gender] || 'gray'}>{p.gender}</Badge>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.age} yrs</span>
                    {p.bloodGroup && <>
                      <span className="text-slate-200">•</span>
                      <span className="font-semibold text-danger">{p.bloodGroup}</span>
                    </>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.phone}</span>
                  </div>
                </div>

                {(p.allergies?.length > 0 || p.chronicConditions?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.allergies?.slice(0,2).map(a => (
                      <span key={a} className="badge-danger badge text-xs">⚠ {a}</span>
                    ))}
                    {p.chronicConditions?.slice(0,2).map(c => (
                      <span key={c} className="badge-warning badge text-xs">{c}</span>
                    ))}
                    {(p.allergies?.length + p.chronicConditions?.length) > 4 && (
                      <span className="badge-gray badge text-xs">+more</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                  <span className="text-xs text-slate-400 flex-1">
                    {p._count?.prescriptions} Rx • {p._count?.appointments} visits
                  </span>
                  <button onClick={() => openEdit(p)}
                    className="btn-ghost btn-icon btn-sm" title="Edit">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => navigate(`/patients/${p.id}`)}
                    className="btn-ghost btn-icon btn-sm" title="View">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => fetchPatients(p)}
                  className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all
                    ${p === pagination.page
                      ? 'bg-primary text-white'
                      : 'bg-white text-slate-500 hover:bg-blue-50 border border-slate-200'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Register New Patient' : `Edit — ${selected?.name}`}
        size="lg"
      >
        <PatientForm
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={handleSave}
          onCancel={() => setModal(null)}
          mode={modal}
        />
      </Modal>
    </div>
  )
}
