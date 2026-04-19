import { useEffect, useState, useCallback } from 'react'
import { Search, UserPlus, ChevronRight, Clock, CheckCircle, XCircle, Stethoscope, RefreshCw } from 'lucide-react'
import { Card, Button, Badge, PageHeader, StatCard } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  Waiting:        { label: 'Waiting',         color: 'warning', icon: Clock },
  InConsultation: { label: 'In Consultation',  color: 'primary', icon: Stethoscope },
  Done:           { label: 'Done',             color: 'success', icon: CheckCircle },
  Skipped:        { label: 'Skipped',          color: 'gray',    icon: XCircle },
}

export default function QueuePage() {
  const [queue, setQueue]       = useState([])
  const [stats, setStats]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [adding, setAdding]     = useState(false)
  const [searchQ, setSearchQ]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch]       = useState(false)
  const [activeFilter, setActiveFilter]   = useState('all')
  const [doctors, setDoctors]             = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDoctor) params.set('doctorId', selectedDoctor)
      const { data } = await api.get(`/appointments/queue/today?${params}`)
      setQueue(data.data.appointments)
      setStats(data.data.stats)
    } catch {
    } finally { setLoading(false) }
  }, [selectedDoctor])

  useEffect(() => {
    fetchQueue()
    api.get('/users/doctors').then(({ data }) => setDoctors(data.data))
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  // Search patients
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/patients/search?q=${searchQ}`)
      setSearchResults(data.data)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ])

  const addToQueue = async (patient) => {
    setAdding(true)
    try {
      const { data } = await api.post('/appointments/queue', {
        patientId: patient.id,
        doctorId:  selectedDoctor || null,
      })
      toast.success(`Token #${data.data.tokenNo} assigned to ${patient.name}`)
      setShowSearch(false)
      setSearchQ('')
      setSearchResults([])
      fetchQueue()
    } catch {
    } finally { setAdding(false) }
  }

  const updateStatus = async (appointmentId, status) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status })
      fetchQueue()
      if (status === 'Done') toast.success('Patient marked as done')
      if (status === 'InConsultation') toast.success('Patient called in')
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
    { key: 'all',           label: 'All',            count: stats.total },
    { key: 'Waiting',       label: 'Waiting',        count: stats.waiting },
    { key: 'InConsultation',label: 'In Consultation', count: stats.inConsultation },
    { key: 'Done',          label: 'Done',            count: stats.done },
  ]

  return (
    <div className="fade-in">
      <PageHeader
        title="Today's Queue"
        subtitle={format(new Date(), 'EEEE, dd MMMM yyyy')}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchQueue}>Refresh</Button>
            <Button variant="success" onClick={callNext} icon={<ChevronRight className="w-4 h-4" />}>
              Call Next
            </Button>
            <Button variant="primary" icon={<UserPlus className="w-4 h-4" />} onClick={() => setShowSearch(true)}>
              Get Appointment
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Today"    value={stats.total ?? 0}          icon={<Clock className="w-5 h-5" />}        color="bg-primary" />
        <StatCard label="Waiting"        value={stats.waiting ?? 0}        icon={<Clock className="w-5 h-5" />}        color="bg-warning" />
        <StatCard label="In Consultation"value={stats.inConsultation ?? 0} icon={<Stethoscope className="w-5 h-5" />} color="bg-secondary" />
        <StatCard label="Done"           value={stats.done ?? 0}           icon={<CheckCircle className="w-5 h-5" />}  color="bg-success" />
      </div>

      {/* Add patient search modal */}
      {showSearch && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSearch(false)}>
          <div className="modal max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">Add Patient to Queue</h2>
              <button onClick={() => setShowSearch(false)} className="btn-ghost btn-icon text-slate-400">✕</button>
            </div>
            <div className="modal-body">
              {doctors.length > 0 && (
                <div className="form-group mb-4">
                  <label className="form-label">Assign to Doctor (optional)</label>
                  <select className="form-select" value={selectedDoctor}
                    onChange={e => setSelectedDoctor(e.target.value)}>
                    <option value="">Any Doctor</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input autoFocus className="form-input pl-9"
                  placeholder="Search patient by name or phone..."
                  value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>

              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {searchResults.length === 0 && searchQ.length >= 2 && (
                  <p className="text-sm text-slate-400 text-center py-4">No patients found</p>
                )}
                {searchResults.map(p => (
                  <div key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-blue-50 transition-all cursor-pointer"
                    onClick={() => addToQueue(p)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary text-white font-bold flex items-center justify-center flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.patientCode} • {p.age}y • {p.phone}</p>
                        {p.allergies?.length > 0 && (
                          <p className="text-xs text-danger">⚠ {p.allergies.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <Button variant="primary" size="sm" loading={adding}>Add</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doctor filter */}
      {doctors.length > 1 && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <label className="form-label mb-0">Filter by Doctor:</label>
            <select className="form-select w-56" value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}>
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </Card>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {statusFilters.map(f => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${activeFilter === f.key ? 'bg-primary text-white shadow-btn' : 'bg-white text-slate-500 border border-slate-200 hover:border-primary hover:text-primary'}`}>
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
              ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {f.count ?? 0}
            </span>
          </button>
        ))}
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
            <h3 className="font-semibold text-slate-700 mb-1">Queue is empty</h3>
            <p className="text-sm text-slate-400">Add patients to today's queue</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueue.map((a, idx) => {
              const StatusIcon = STATUS_CONFIG[a.status]?.icon || Clock
              const isActive = a.status === 'InConsultation'
              return (
                <div key={a.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
                    ${isActive ? 'border-primary/30 bg-blue-50 shadow-card' : 'border-slate-100 bg-white hover:border-slate-200'}`}>

                  {/* Token */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0
                    ${isActive ? 'bg-primary text-white' : 'bg-background text-slate-600'}`}>
                    #{a.tokenNo}
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{a.patient.name}</p>
                      {isActive && <Badge variant="primary">● In Consultation</Badge>}
                      {a.patient.allergies?.length > 0 && (
                        <Badge variant="danger">⚠ Allergic</Badge>
                      )}
                      {a.patient.chronicConditions?.length > 0 && (
                        <Badge variant="warning">{a.patient.chronicConditions[0]}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.patient.patientCode} • {a.patient.age}y {a.patient.gender} • {a.patient.phone}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.status === 'Waiting' && (
                      <Button variant="primary" size="sm"
                        onClick={() => updateStatus(a.id, 'InConsultation')}>
                        Call In
                      </Button>
                    )}
                    {a.status === 'InConsultation' && (
                      <Button variant="success" size="sm"
                        onClick={() => updateStatus(a.id, 'Done')}>
                        Done
                      </Button>
                    )}
                    {(a.status === 'Waiting' || a.status === 'InConsultation') && (
                      <Button variant="ghost" size="sm"
                        onClick={() => updateStatus(a.id, 'Skipped')}>
                        Skip
                      </Button>
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
    </div>
  )
}
