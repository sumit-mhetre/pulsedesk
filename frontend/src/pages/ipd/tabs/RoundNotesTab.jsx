// Round Notes tab — doctor's daily clinical entries.
// Toggle between Free-form (default) and Structured SOAP.
//
// Used on AdmissionDetailPage as one of the tabs.

import { useEffect, useState } from 'react'
import {
  Plus, AlertTriangle, ClipboardEdit, Bookmark, FileText, Stethoscope,
  X, Save, Pencil,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function RoundNotesTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'recordRoundNotes')
  const isOpen   = admission.status === 'ADMITTED'

  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/round-notes`)
      setNotes(data.data || [])
    } catch {
      toast.error('Failed to load round notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Round Notes
            {notes.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({notes.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Doctor's clinical entries during admission</p>
        </div>
        {canWrite && isOpen && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => { setEditing(null); setShowForm(true) }}>
            Add Note
          </Button>
        )}
      </div>

      {notes.length === 0 ? (
        <Card className="p-10 text-center">
          <ClipboardEdit className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No round notes yet</p>
          {canWrite && isOpen && (
            <p className="text-xs text-slate-400">Click "Add Note" to record the first entry.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {notes.map(n => (
            <NoteCard key={n.id} note={n}
              currentUserId={user?.id}
              onEdit={(note) => { setEditing(note); setShowForm(true) }}/>
          ))}
        </div>
      )}

      {showForm && (
        <NoteForm
          admissionId={admission.id}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchData() }}/>
      )}
    </div>
  )
}

// ── Single note display ──────────────────────────────────
function NoteCard({ note, currentUserId, onEdit }) {
  const ageHours = (Date.now() - new Date(note.createdAt).getTime()) / (1000 * 60 * 60)
  const canEdit = note.doctorId === currentUserId && ageHours < 24

  const isSOAP = note.subjective || note.objective || note.assessment || note.plan

  // Border color: red if critical, amber if needs follow-up, slate otherwise
  const borderClass = note.isCritical
    ? 'border-l-danger'
    : note.needsFollowUp
      ? 'border-l-warning'
      : 'border-l-slate-300'

  return (
    <div className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{note.doctor?.name}</p>
        <span className="text-xs text-slate-500 flex-1 min-w-0">
          {format(new Date(note.recordedAt), 'd MMM yyyy, hh:mm a')}
          <span className="text-slate-400"> · {formatDistanceToNow(new Date(note.recordedAt), { addSuffix: true })}</span>
        </span>
        {note.isCritical    && <Badge variant="danger">Critical</Badge>}
        {note.needsFollowUp && <Badge variant="warning">Follow-up</Badge>}
        {canEdit && (
          <button onClick={() => onEdit(note)}
            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 whitespace-nowrap">
            <Pencil className="w-3 h-3"/> Edit
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-1.5">
        {isSOAP ? (
          <div className="space-y-1 text-sm">
            {note.subjective && <SoapField label="S — Subjective" value={note.subjective}/>}
            {note.objective  && <SoapField label="O — Objective"  value={note.objective}/>}
            {note.assessment && <SoapField label="A — Assessment" value={note.assessment}/>}
            {note.plan       && <SoapField label="P — Plan"       value={note.plan}/>}
            {note.freeText   && <SoapField label="Note"          value={note.freeText}/>}
          </div>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.freeText}</p>
        )}
      </div>
    </div>
  )
}

function SoapField({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// ── Add/Edit form (modal) ────────────────────────────────
function NoteForm({ admissionId, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const initialMode = initial && (initial.subjective || initial.objective || initial.assessment || initial.plan)
    ? 'soap'
    : 'free'
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({
    recordedAt:    initial?.recordedAt ? toLocalInput(initial.recordedAt) : toLocalInput(new Date()),
    subjective:    initial?.subjective || '',
    objective:     initial?.objective  || '',
    assessment:    initial?.assessment || '',
    plan:          initial?.plan       || '',
    freeText:      initial?.freeText   || '',
    isCritical:    initial?.isCritical || false,
    needsFollowUp: initial?.needsFollowUp || false,
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    // Pull only fields relevant to the mode (so switching modes doesn't keep stale data)
    const payload = {
      recordedAt:    form.recordedAt,
      isCritical:    form.isCritical,
      needsFollowUp: form.needsFollowUp,
    }
    if (mode === 'soap') {
      payload.subjective = form.subjective
      payload.objective  = form.objective
      payload.assessment = form.assessment
      payload.plan       = form.plan
      payload.freeText   = null
    } else {
      payload.subjective = null
      payload.objective  = null
      payload.assessment = null
      payload.plan       = null
      payload.freeText   = form.freeText
    }

    const hasContent = mode === 'soap'
      ? (form.subjective || form.objective || form.assessment || form.plan).trim()
      : form.freeText.trim()
    if (!hasContent) return toast.error('Note content is required')

    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/ipd/round-notes/${initial.id}`, payload)
        toast.success('Note updated')
      } else {
        await api.post(`/ipd/admissions/${admissionId}/round-notes`, payload)
        toast.success('Note recorded')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Round Note' : 'Add Round Note'} size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save Note
          </Button>
        </>
      }>
      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4">
        <button
          onClick={() => setMode('free')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
            ${mode === 'free' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
          Free-form
        </button>
        <button
          onClick={() => setMode('soap')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
            ${mode === 'soap' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
          SOAP
        </button>
      </div>

      {/* Date/Time */}
      <div className="form-group mb-3">
        <label className="form-label">Recorded At</label>
        <input type="datetime-local" className="form-input"
          value={form.recordedAt}
          onChange={e => setForm(f => ({ ...f, recordedAt: e.target.value }))}/>
      </div>

      {/* Content */}
      {mode === 'free' ? (
        <div className="form-group">
          <label className="form-label">Note</label>
          <textarea className="form-input" rows={6} value={form.freeText}
            onChange={e => setForm(f => ({ ...f, freeText: e.target.value }))}
            placeholder="Patient progress, observations, assessment, plan..."/>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label">S — Subjective</label>
            <textarea className="form-input" rows={2} value={form.subjective}
              onChange={e => setForm(f => ({ ...f, subjective: e.target.value }))}
              placeholder="Patient's reported symptoms, complaints..."/>
          </div>
          <div className="form-group">
            <label className="form-label">O — Objective</label>
            <textarea className="form-input" rows={2} value={form.objective}
              onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              placeholder="Examination findings, vitals, lab results..."/>
          </div>
          <div className="form-group">
            <label className="form-label">A — Assessment</label>
            <textarea className="form-input" rows={2} value={form.assessment}
              onChange={e => setForm(f => ({ ...f, assessment: e.target.value }))}
              placeholder="Clinical assessment, working diagnosis..."/>
          </div>
          <div className="form-group">
            <label className="form-label">P — Plan</label>
            <textarea className="form-input" rows={2} value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
              placeholder="Treatment plan, investigations, follow-up..."/>
          </div>
        </div>
      )}

      {/* Flags */}
      <div className="flex flex-wrap gap-4 mt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="form-checkbox"
            checked={form.isCritical}
            onChange={e => setForm(f => ({ ...f, isCritical: e.target.checked }))}/>
          <span className="text-sm text-slate-700">Mark as Critical</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="form-checkbox"
            checked={form.needsFollowUp}
            onChange={e => setForm(f => ({ ...f, needsFollowUp: e.target.checked }))}/>
          <span className="text-sm text-slate-700">Needs Follow-up</span>
        </label>
      </div>
    </Modal>
  )
}
