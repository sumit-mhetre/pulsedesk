import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, UserPlus, ChevronRight, Clock, CheckCircle, XCircle,
  Stethoscope, RefreshCw, FileText, X, Edit2,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useCan } from '../../hooks/usePermission'
import { PatientModal } from '../patients/PatientsPage'

const STATUS_CONFIG = {
  Waiting:        { label: 'Waiting',          color: 'warning', icon: Clock },
  InConsultation: { label: 'In Consultation',  color: 'primary', icon: Stethoscope },
  Done:           { label: 'Done',             color: 'success', icon: CheckCircle },
  Skipped:        { label: 'Skipped',          color: 'gray',    icon: XCircle },
}

export default function QueuePage() {
  const navigate = useNavigate()
  const can      = useCan()

  const [queue, setQueue]       = useState([])
  const [stats, setStats]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [activeFilter, setActiveFilter]     = useState('all')
  const [doctors, setDoctors]               = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState('')

  // Patient search (replaces Get Appointment button)
  const [searchQ, setSearchQ]               = useState('')
  const [searchResults, setSearchResults]   = useState([])
  const [showResults, setShowResults]       = useState(false)
  const [searching, setSearching]           = useState(false)
  const searchWrapRef = useRef(null)

  // Add Patient modal
  const [showAddModal, setShowAddModal] = useState(false)
  // Edit patient modal - opened from a pencil icon on each search result row.
  // editPt holds the patient form pre-filled from /patients/:id.
  const [editPt,        setEditPt]        = useState(null)
  const [loadingEdit,   setLoadingEdit]   = useState(false)

  // ── Fetch queue ─────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDoctor) params.set('doctorId', selectedDoctor)
      const { data } = await api.get(`/appointments/queue/today?${params}`, { silent: true })
      setQueue(data.data.appointments)
      setStats(data.data.stats)
    } catch {
    } finally { setLoading(false) }
  }, [selectedDoctor])

  useEffect(() => {
    fetchQueue()
    api.get('/users/doctors', { silent: true }).then(({ data }) => setDoctors(data.data)).catch(() => {})
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // ── Patient search (debounced) ──────────────────────────
  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/patients/search?q=${encodeURIComponent(searchQ.trim())}`,
          { silent: true }
        )
        setSearchResults(Array.isArray(data?.data) ? data.data : [])
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ])

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // ── Status updates ──────────────────────────────────────
  const updateStatus = async (appointmentId, status) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status })
      fetchQueue()
      if (status === 'Done')           toast.success('Patient marked as done')
      if (status === 'InConsultation') toast.success('Patient called in')
      if (status === 'Skipped')        toast('Patient skipped', { icon: '⏭️' })
    } catch {}
  }

  const callNext = async () => {
    try {
      const params = selectedDoctor ? `?doctorId=${selectedDoctor}` : ''
      const { data } = await api.get(`/appointments/queue/next${params}`)
      if (!data.data) { toast('No more patients waiting', { icon: '✅' }); return }
      toast.success(`Calling Token #${data.data.tokenNo} — ${data.data.patient.name}`)
      fetchQueue()
    } catch {}
  }

  const filteredQueue = queue.filter(a =>
    activeFilter === 'all' ? true : a.status === activeFilter
  )

  const statusFilters = [
    { key: 'all',           label: 'All',             count: stats.total },
    { key: 'Waiting',       label: 'Waiting',         count: stats.waiting },
    { key: 'InConsultation',label: 'In Consultation', count: stats.inConsultation },
    { key: 'Done',          label: 'Done',            count: stats.done },
  ]

  // Load patient details and open edit modal. Mirrors the openEdit() in
  // PatientsPage so the form shape is identical.
  const openEdit = async (id) => {
    if (loadingEdit) return
    setLoadingEdit(true)
    try {
      const { data } = await api.get(`/patients/${id}`)
      const p = data.data
      const prefixMatch = p.name?.match(/^(Mr|Mrs|Ms|Dr|Baby|Master|Er)\s+/i)
      setEditPt({
        id: p.id,
        patientCode: p.patientCode || '',
        prefix: prefixMatch ? prefixMatch[1] : 'Mr',
        name: prefixMatch ? p.name.replace(prefixMatch[0], '').trim() : (p.name || ''),
        age: p.age || '',
        dob: p.dob ? format(new Date(p.dob), 'yyyy-MM-dd') : '',
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
      setShowResults(false); setSearchQ('')
    } catch {
      toast.error('Failed to load patient details. Please try again.')
    } finally {
      setLoadingEdit(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Today's Appointments</h1>
          <p className="text-sm text-slate-500 mt-1">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchQueue}>Refresh</Button>
          <Button variant="success" onClick={callNext} icon={<ChevronRight className="w-4 h-4" />}>Call Next</Button>
          <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
            Add New Patient
          </Button>
        </div>
      </div>

      {/* Compact toolbar: search + filters all on one row (wraps on narrow screens) */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search — flex-grow so it takes up available space */}
        <div ref={searchWrapRef} className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="form-input pl-9 pr-9 w-full"
            placeholder="Search patient by OPD code, name, or phone..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onFocus={() => searchQ.trim().length >= 2 && setShowResults(true)}
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => { setSearchQ(''); setSearchResults([]); setShowResults(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4"/>
            </button>
          )}

          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto z-30">
              {searching ? (
                <p className="px-3 py-2 text-sm text-slate-400 italic">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-400 italic text-center">
                  No patients found.
                  <button onClick={() => { setShowResults(false); setShowAddModal(true) }}
                    className="text-primary font-semibold hover:underline ml-1">
                    Add new patient?
                  </button>
                </p>
              ) : (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    className="w-full px-3 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onMouseDown={() => {
                        navigate(`/patients/${p.id}`)
                        setShowResults(false); setSearchQ('')
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">
                        {(p.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          <span className="font-mono text-primary mr-2">{p.patientCode}</span>
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[p.age != null ? `${p.age}y` : null, p.gender, p.phone].filter(Boolean).join(' • ')}
                          {p.allergies?.length > 0 && <span className="text-danger ml-2">⚠ Allergic</span>}
                        </p>
                      </div>
                    </button>
                    {can('managePatients') && (
                      <button
                        type="button"
                        title="Edit Patient"
                        disabled={loadingEdit}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(p.id) }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40"
                      >
                        <Edit2 className="w-4 h-4"/>
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0"/>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Doctor filter — only shown for multi-doctor clinics (2+) */}
        {doctors.length > 1 && (
          <select className="form-select w-48 flex-shrink-0" value={selectedDoctor}
            onChange={e => setSelectedDoctor(e.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        {/* Status filter pills */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {statusFilters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all
                ${activeFilter === f.key ? 'bg-primary text-white shadow-btn' : 'bg-white text-slate-500 border border-slate-200 hover:border-primary hover:text-primary'}`}>
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {f.count ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Queue List */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner text-primary w-8 h-8" /></div>
        ) : filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-primary">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No appointments yet</h3>
            <p className="text-sm text-slate-400">Search for a patient above or add a new patient to begin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQueue.map((a) => {
              const isActive = a.status === 'InConsultation'
              return (
                <div key={a.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                    ${isActive ? 'border-primary/30 bg-blue-50 shadow-card' : 'border-slate-100 bg-white hover:border-slate-200'}`}>

                  {/* Token */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0
                    ${isActive ? 'bg-primary text-white' : 'bg-background text-slate-600'}`}>
                    #{a.tokenNo}
                  </div>

                  {/* Patient Info — clickable, goes to profile */}
                  <button type="button"
                    onClick={() => navigate(`/patients/${a.patient.id}`)}
                    className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{a.patient.name}</p>
                      {isActive && <Badge variant="primary">● In Consultation</Badge>}
                      {a.patient.allergies?.length > 0 && (
                        <Badge variant="danger">⚠ Allergic</Badge>
                      )}
                      {a.patient.chronicConditions?.length > 0 && (
                        <Badge variant="warning">{a.patient.chronicConditions[0]}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-tight">
                      {a.patient.patientCode} • {a.patient.age}y {a.patient.gender} • {a.patient.phone}
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(a.status === 'Waiting' || a.status === 'InConsultation') && can('createPrescriptions') && (
                      <Button variant="primary" size="sm"
                        icon={<FileText className="w-3.5 h-3.5"/>}
                        onClick={() => navigate(`/prescriptions/new?patientId=${a.patient.id}`)}>
                        {a.status === 'InConsultation' ? 'Continue Rx' : '+ New Prescription'}
                      </Button>
                    )}
                    {(a.status === 'Waiting' || a.status === 'InConsultation') && (
                      <button type="button"
                        className="text-xs text-slate-400 hover:text-danger underline-offset-2 hover:underline px-1"
                        onClick={() => updateStatus(a.id, 'Skipped')}>
                        Skip
                      </button>
                    )}
                    <Badge variant={STATUS_CONFIG[a.status]?.color || 'gray'}>
                      {STATUS_CONFIG[a.status]?.label || a.status}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Add Patient modal — reuses the same modal from PatientsPage */}
      {showAddModal && (
        <PatientModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchQueue() }}
          navigate={navigate}
          can={can}
        />
      )}

      {/* Edit Patient modal — opened from the pencil icon on each search result */}
      {editPt && (
        <PatientModal
          mode="edit"
          initialForm={editPt}
          onClose={() => setEditPt(null)}
          onSaved={() => { setEditPt(null); fetchQueue() }}
          navigate={navigate}
          can={can}
        />
      )}
    </div>
  )
}
