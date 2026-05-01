// Consultations tab — request internal (in-clinic doctor) or external
// (named outside specialist) consultations during admission.
//
// Internal: pick a doctor from clinic users → record reason
// External: type consultant name + specialty → record reason
//
// Once consult happens, record response (notes + recommendations).

import { useEffect, useState } from 'react'
import {
  Plus, MessageSquare, Save, Trash2, Stethoscope, Building2, Check,
  ClipboardEdit,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

function dateInput(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

export default function ConsultationsTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageConsultations')

  const [consultations, setConsultations] = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [responding, setResponding]       = useState(null)
  const [deleting, setDeleting]           = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/consultations`)
      setConsultations(data.data || [])
    } catch {
      toast.error('Failed to load consultations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const removeConsult = async (c) => {
    try {
      await api.delete(`/ipd/consultations/${c.id}`)
      toast.success('Consultation deleted')
      setDeleting(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  const pending   = consultations.filter(c => !c.consultedAt)
  const completed = consultations.filter(c =>  c.consultedAt)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Consultations
            {consultations.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({consultations.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Internal and external specialist referrals</p>
        </div>
        {canWrite && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setShowForm(true)}>
            Request Consultation
          </Button>
        )}
      </div>

      {consultations.length === 0 ? (
        <Card className="p-10 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No consultations requested</p>
          {canWrite && (
            <p className="text-xs text-slate-400">Click "Request Consultation" to refer this patient to another specialist.</p>
          )}
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-5">
              <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
                Pending ({pending.length})
              </p>
              <div className="space-y-1.5">
                {pending.map(c => (
                  <ConsultCard key={c.id} consult={c}
                    canWrite={canWrite}
                    onRespond={() => setResponding(c)}
                    onDelete={() => setDeleting(c)}/>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
                Completed ({completed.length})
              </p>
              <div className="space-y-1.5">
                {completed.map(c => (
                  <ConsultCard key={c.id} consult={c} canWrite={canWrite}
                    onRespond={() => setResponding(c)}/>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <RequestModal
          admission={admission}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}/>
      )}

      {responding && (
        <ResponseModal
          consult={responding}
          onClose={() => setResponding(null)}
          onSaved={() => { setResponding(null); fetchData() }}/>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete consultation request?"
        message="This will remove the pending consultation. Already-completed consultations cannot be deleted."
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => removeConsult(deleting)}
        onClose={() => setDeleting(null)}/>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ConsultCard({ consult, canWrite, onRespond, onDelete }) {
  const isInternal = !!consult.consultantDoctorId
  const completed  = !!consult.consultedAt

  // Border: amber=pending, slate=completed
  const borderClass = completed ? 'border-l-slate-300' : 'border-l-warning'

  return (
    <div className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{consult.consultantName}</p>
        <Badge variant={isInternal ? 'primary' : 'accent'}>
          {isInternal ? 'Internal' : 'External'}
        </Badge>
        {completed
          ? <Badge variant="success">Completed</Badge>
          : <Badge variant="warning">Pending</Badge>}
        {consult.consultantSpecialty && (
          <span className="text-xs text-slate-500">{consult.consultantSpecialty}</span>
        )}
        <span className="flex-1 min-w-0"/>
        {canWrite && (
          <>
            <button onClick={onRespond}
              className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">
              <ClipboardEdit className="w-3 h-3 inline mr-0.5"/>
              {completed ? 'Edit response' : 'Record response'}
            </button>
            {!completed && onDelete && (
              <button onClick={onDelete}
                className="text-xs text-danger hover:underline whitespace-nowrap">
                <Trash2 className="w-3 h-3 inline"/>
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-0.5">
        <span className="text-slate-400">Reason:</span> {consult.reason}
      </p>
      <p className="text-[11px] text-slate-400 mt-0.5">
        Requested {formatDistanceToNow(new Date(consult.requestedAt), { addSuffix: true })}
        <span className="text-slate-300"> · </span>
        {format(new Date(consult.requestedAt), 'd MMM, hh:mm a')}
      </p>

      {completed && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-xs">
          {consult.recommendations && (
            <p>
              <span className="font-semibold text-success">Recommendations:</span> {consult.recommendations}
            </p>
          )}
          {consult.notes && (
            <p className="text-slate-600 italic mt-0.5">{consult.notes}</p>
          )}
          <p className="text-[11px] text-slate-400 mt-0.5">
            Consulted {format(new Date(consult.consultedAt), 'd MMM, hh:mm a')}
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function RequestModal({ admission, onClose, onSaved }) {
  const [mode, setMode] = useState('internal') // internal | external
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({
    consultantDoctorId:  '',
    consultantName:      '',
    consultantSpecialty: '',
    reason:              '',
  })
  const [saving, setSaving] = useState(false)

  // Load doctors in this clinic for internal mode
  useEffect(() => {
    api.get('/users?role=DOCTOR')
      .then(r => setDoctors(r.data.data || []))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!form.reason.trim()) return toast.error('Reason for consultation is required')
    if (mode === 'internal' && !form.consultantDoctorId) return toast.error('Pick a doctor')
    if (mode === 'external' && !form.consultantName.trim()) return toast.error('Consultant name required')

    setSaving(true)
    try {
      const payload = {
        reason: form.reason.trim(),
      }
      if (mode === 'internal') {
        payload.consultantDoctorId = form.consultantDoctorId
      } else {
        payload.consultantName      = form.consultantName.trim()
        payload.consultantSpecialty = form.consultantSpecialty.trim() || undefined
      }
      await api.post(`/ipd/admissions/${admission.id}/consultations`, payload)
      toast.success('Consultation requested')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Request Consultation" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Send Request
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Consultation Type *</label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => setMode('internal')}
              className={`flex-1 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors flex items-center justify-center gap-2
                ${mode === 'internal'
                  ? 'border-primary bg-blue-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-primary'}`}>
              <Stethoscope className="w-4 h-4"/>
              Internal — Doctor in clinic
            </button>
            <button type="button"
              onClick={() => setMode('external')}
              className={`flex-1 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors flex items-center justify-center gap-2
                ${mode === 'external'
                  ? 'border-primary bg-blue-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-primary'}`}>
              <Building2 className="w-4 h-4"/>
              External — Outside specialist
            </button>
          </div>
        </div>

        {mode === 'internal' ? (
          <div className="form-group">
            <label className="form-label">Pick Doctor *</label>
            <select className="form-select" value={form.consultantDoctorId}
              onChange={e => setForm(f => ({ ...f, consultantDoctorId: e.target.value }))}>
              <option value="">— Select a doctor —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </select>
            {doctors.length === 0 && (
              <p className="text-xs text-warning mt-1">No other doctors in this clinic. Switch to External.</p>
            )}
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Consultant Name *</label>
              <input className="form-input" value={form.consultantName}
                placeholder="e.g. Dr. Anil Kumar"
                onChange={e => setForm(f => ({ ...f, consultantName: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Specialty</label>
              <input className="form-input" value={form.consultantSpecialty}
                placeholder="Cardiologist, Neurologist, etc."
                onChange={e => setForm(f => ({ ...f, consultantSpecialty: e.target.value }))}/>
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Reason for Consultation *</label>
          <textarea className="form-input" rows={3} value={form.reason}
            placeholder="Brief clinical question or area requiring opinion"
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}/>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────
function ResponseModal({ consult, onClose, onSaved }) {
  const [form, setForm] = useState({
    consultedAt:     dateInput(consult.consultedAt) || dateInput(new Date()),
    notes:           consult.notes || '',
    recommendations: consult.recommendations || '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.notes.trim() && !form.recommendations.trim()) {
      return toast.error('Enter notes or recommendations')
    }
    setSaving(true)
    try {
      await api.post(`/ipd/consultations/${consult.id}/response`, {
        consultedAt:     form.consultedAt,
        notes:           form.notes.trim() || undefined,
        recommendations: form.recommendations.trim() || undefined,
      })
      toast.success('Response recorded')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Response — ${consult.consultantName}`} size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save Response
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="bg-slate-50 rounded-xl p-3 text-sm">
          <p className="text-slate-600 text-xs mb-1">Reason for consultation:</p>
          <p>{consult.reason}</p>
        </div>

        <div className="form-group">
          <label className="form-label">Date & Time of Consult</label>
          <input type="datetime-local" className="form-input"
            value={form.consultedAt}
            onChange={e => setForm(f => ({ ...f, consultedAt: e.target.value }))}/>
        </div>

        <div className="form-group">
          <label className="form-label">Recommendations</label>
          <textarea className="form-input" rows={3}
            value={form.recommendations}
            onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))}
            placeholder="Specific medications, procedures, follow-up recommendations from the consultant"/>
        </div>

        <div className="form-group">
          <label className="form-label">Clinical Notes / Observations</label>
          <textarea className="form-input" rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Findings, examination notes from the consultation"/>
        </div>
      </div>
    </Modal>
  )
}
