// Nursing Notes tab — nurse's per-shift observations + care actions.
//
// Note (UX): nurses typically work in 8-hour shifts. The form auto-suggests
// the current shift based on time of day, but lets them override.

import { useEffect, useState } from 'react'
import {
  Plus, Heart, Sun, Moon, Sunset, Clock, Pencil, Save,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

const SHIFTS = [
  { value: 'MORNING',   label: 'Morning',   icon: Sun },
  { value: 'AFTERNOON', label: 'Afternoon', icon: Sunset },
  { value: 'NIGHT',     label: 'Night',     icon: Moon },
]

// Suggest shift based on current hour (IST mental model):
//   06:00 - 13:59 → MORNING
//   14:00 - 21:59 → AFTERNOON
//   22:00 - 05:59 → NIGHT
function suggestShift() {
  const h = new Date().getHours()
  if (h >= 6  && h < 14) return 'MORNING'
  if (h >= 14 && h < 22) return 'AFTERNOON'
  return 'NIGHT'
}

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function NursingNotesTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'recordNursingNotes')
  const isOpen   = admission.status === 'ADMITTED'

  const [notes, setNotes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/nursing-notes`)
      setNotes(data.data || [])
    } catch {
      toast.error('Failed to load nursing notes')
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
            Nursing Notes
            {notes.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({notes.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Per-shift observations and care actions</p>
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
          <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No nursing notes yet</p>
          {canWrite && isOpen && (
            <p className="text-xs text-slate-400">Click "Add Note" to record observations.</p>
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

// ─────────────────────────────────────────────────────────
function NoteCard({ note, currentUserId, onEdit }) {
  const ageHours = (Date.now() - new Date(note.createdAt).getTime()) / (1000 * 60 * 60)
  const canEdit = note.nurseId === currentUserId && ageHours < 24

  // Border color by shift -- helps visually group consecutive shifts
  const shiftBorder = {
    MORNING:   'border-l-amber-400',
    AFTERNOON: 'border-l-blue-400',
    NIGHT:     'border-l-indigo-500',
  }
  const borderClass = shiftBorder[note.shift] || 'border-l-slate-300'

  return (
    <div className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{note.nurse?.name}</p>
        <Badge variant="accent">{note.shift}</Badge>
        <span className="text-xs text-slate-500 flex-1 min-w-0">
          {format(new Date(note.recordedAt), 'd MMM yyyy, hh:mm a')}
          <span className="text-slate-400"> · {formatDistanceToNow(new Date(note.recordedAt), { addSuffix: true })}</span>
        </span>
        {canEdit && (
          <button onClick={() => onEdit(note)}
            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 whitespace-nowrap">
            <Pencil className="w-3 h-3"/> Edit
          </button>
        )}
      </div>

      <div className="mt-1.5 space-y-1.5 text-sm">
        {note.observations && (
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mr-1">Obs:</span>
            <span className="text-slate-700 whitespace-pre-wrap">{note.observations}</span>
          </div>
        )}
        {note.careActions && (
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mr-1">Care:</span>
            <span className="text-slate-700 whitespace-pre-wrap">{note.careActions}</span>
          </div>
        )}
        {note.handoverNotes && (
          <div className="bg-orange-50/60 rounded-md p-1.5 border border-orange-100">
            <span className="text-[10px] uppercase font-semibold text-warning tracking-wide mr-1">Handover:</span>
            <span className="text-slate-700 whitespace-pre-wrap">{note.handoverNotes}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function NoteForm({ admissionId, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    recordedAt:    initial?.recordedAt ? toLocalInput(initial.recordedAt) : toLocalInput(new Date()),
    shift:         initial?.shift || suggestShift(),
    observations:  initial?.observations  || '',
    careActions:   initial?.careActions   || '',
    handoverNotes: initial?.handoverNotes || '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.observations.trim() && !form.careActions.trim() && !form.handoverNotes.trim()) {
      return toast.error('At least one field is required')
    }
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/ipd/nursing-notes/${initial.id}`, {
          shift: form.shift,
          observations:  form.observations,
          careActions:   form.careActions,
          handoverNotes: form.handoverNotes,
        })
        toast.success('Note updated')
      } else {
        await api.post(`/ipd/admissions/${admissionId}/nursing-notes`, form)
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
    <Modal open onClose={onClose} title={isEdit ? 'Edit Nursing Note' : 'Add Nursing Note'} size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save Note
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Recorded At</label>
            <input type="datetime-local" className="form-input"
              value={form.recordedAt}
              onChange={e => setForm(f => ({ ...f, recordedAt: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Shift *</label>
            <select className="form-select" value={form.shift}
              onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
              {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Observations</label>
          <textarea className="form-input" rows={3} value={form.observations}
            onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            placeholder="Patient general condition, mood, mobility, alertness, complaints..."/>
        </div>

        <div className="form-group">
          <label className="form-label">Care Actions</label>
          <textarea className="form-input" rows={3} value={form.careActions}
            onChange={e => setForm(f => ({ ...f, careActions: e.target.value }))}
            placeholder="Bath, dressing change, position change, medications administered (cross-ref MAR)..."/>
        </div>

        <div className="form-group">
          <label className="form-label">Handover Notes</label>
          <textarea className="form-input" rows={2} value={form.handoverNotes}
            onChange={e => setForm(f => ({ ...f, handoverNotes: e.target.value }))}
            placeholder="Important info for next shift: pending tasks, doctor instructions, watch points..."/>
        </div>
      </div>
    </Modal>
  )
}
