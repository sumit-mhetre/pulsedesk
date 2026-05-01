// MAR tab — Medication Administration Record. Nurse's view: each scheduled
// dose is a row, marked Given / Refused / Held / Missed.
//
// Layout:
//   Date selector (default: today) — show schedule for that day
//   Per row: time, medicine, dose, route, status badge + action buttons
//   Late doses (> 30 min past scheduled time, still pending) highlighted in orange
//   Click "Given" → quick log with current time
//   Click "Refused/Held/Missed" → modal asks for reason

import { useEffect, useState } from 'react'
import {
  CheckCircle, XCircle, PauseCircle, AlertCircle, Calendar, ChevronLeft,
  ChevronRight, Clock, Pill, Save,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  PENDING: { variant: 'gray',    label: 'Pending',  icon: Clock },
  GIVEN:   { variant: 'success', label: 'Given',    icon: CheckCircle },
  REFUSED: { variant: 'warning', label: 'Refused',  icon: XCircle },
  HELD:    { variant: 'accent',  label: 'Held',     icon: PauseCircle },
  MISSED:  { variant: 'danger',  label: 'Missed',   icon: AlertCircle },
}

function dateInput(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
}

export default function MARTab({ admission }) {
  const { user } = useAuthStore()
  const canRecord = can(user, 'recordMAR')
  const isOpen    = admission.status === 'ADMITTED'

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate]       = useState(dateInput(new Date()))
  const [actionDialog, setActionDialog] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const fromIso = new Date(date + 'T00:00:00').toISOString()
      const toIso   = new Date(date + 'T23:59:59').toISOString()
      const { data } = await api.get(
        `/ipd/admissions/${admission.id}/mar?from=${fromIso}&to=${toIso}`
      )
      setEntries(data.data || [])
    } catch {
      toast.error('Failed to load MAR')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id, date])

  const recordEntry = async (entry, status, notes = null) => {
    try {
      await api.post(`/ipd/mar/${entry.id}/record`, { status, notes })
      toast.success(`Marked as ${status.toLowerCase()}`)
      setActionDialog(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record')
    }
  }

  const shiftDay = (delta) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(dateInput(d))
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  const isLate = (entry) => {
    if (entry.status !== 'PENDING') return false
    return new Date(entry.scheduledTime) < new Date(Date.now() - 30 * 60 * 1000)
  }

  // Group entries by hour for cleaner readability
  const grouped = {}
  for (const e of entries) {
    const t = new Date(e.scheduledTime)
    const hourKey = format(t, 'HH:mm')
    if (!grouped[hourKey]) grouped[hourKey] = []
    grouped[hourKey].push(e)
  }
  const hourKeys = Object.keys(grouped).sort()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-700 text-base">Medication Administration Record</h3>
          <p className="text-xs text-slate-500">Mark each dose Given / Refused / Held / Missed</p>
        </div>

        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 px-1 py-1">
          <button onClick={() => shiftDay(-1)} className="btn-icon p-1.5 text-slate-500 hover:text-primary">
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <input type="date" className="border-0 outline-none text-sm font-medium px-1"
            value={date}
            onChange={e => setDate(e.target.value)}/>
          <button onClick={() => shiftDay(1)} className="btn-icon p-1.5 text-slate-500 hover:text-primary">
            <ChevronRight className="w-4 h-4"/>
          </button>
          <button onClick={() => setDate(dateInput(new Date()))}
            className="text-xs font-semibold text-primary hover:bg-blue-50 rounded-md px-2 py-1">
            Today
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card className="p-10 text-center">
          <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500">No medications scheduled for {format(new Date(date), 'd MMM yyyy')}</p>
          <p className="text-xs text-slate-400 mt-1">Add medication orders from the Medications tab.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {hourKeys.map(hk => (
            <div key={hk}>
              <p className="text-xs font-mono font-bold text-slate-400 mb-1.5">{hk}</p>
              <div className="space-y-1.5">
                {grouped[hk].map(entry => (
                  <MARRow
                    key={entry.id}
                    entry={entry}
                    isLate={isLate(entry)}
                    canRecord={canRecord && isOpen && entry.status === 'PENDING'}
                    onAction={(status) => {
                      if (status === 'GIVEN') {
                        recordEntry(entry, 'GIVEN')
                      } else {
                        setActionDialog({ entry, status })
                      }
                    }}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {actionDialog && (
        <ActionDialog
          entry={actionDialog.entry}
          status={actionDialog.status}
          onConfirm={(notes) => recordEntry(actionDialog.entry, actionDialog.status, notes)}
          onCancel={() => setActionDialog(null)}/>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function MARRow({ entry, isLate, canRecord, onAction }) {
  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.PENDING
  const StatusIcon = cfg.icon
  const orderActive = entry.order?.status === 'ACTIVE'

  return (
    <div className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-colors
      ${isLate ? 'border-warning/40 bg-orange-50/40' : 'border-slate-200'}`}>

      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Pill className="w-4 h-4 text-primary"/>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">
          {entry.order?.medicineName}
        </p>
        <p className="text-xs text-slate-500">
          <span className="font-mono">{entry.order?.dose}</span>
          {' • '}
          <span>{entry.order?.route}</span>
          {' • '}
          <span>{format(new Date(entry.scheduledTime), 'hh:mm a')}</span>
          {entry.actualTime && (
            <span className="text-slate-400 ml-1">
              (given {format(new Date(entry.actualTime), 'hh:mm a')})
            </span>
          )}
          {!orderActive && entry.order?.status && (
            <span className="ml-2 text-warning italic">Order {entry.order.status.toLowerCase()}</span>
          )}
        </p>
        {entry.notes && (
          <p className="text-xs text-slate-400 italic mt-0.5">{entry.notes}</p>
        )}
        {entry.givenBy && (
          <p className="text-xs text-slate-400">— {entry.givenBy.name}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isLate && (
          <span className="text-xs font-semibold text-warning bg-orange-100 px-2 py-0.5 rounded-full">
            Late
          </span>
        )}
        <Badge variant={cfg.variant}>
          <StatusIcon className="w-3 h-3 inline mr-1"/>
          {cfg.label}
        </Badge>

        {canRecord && (
          <div className="flex gap-1">
            <button onClick={() => onAction('GIVEN')}
              className="px-2 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 text-xs font-semibold transition-colors">
              Given
            </button>
            <button onClick={() => onAction('REFUSED')}
              className="px-2 py-1 rounded-md bg-warning/10 text-warning hover:bg-warning/20 text-xs font-semibold transition-colors">
              Refused
            </button>
            <button onClick={() => onAction('HELD')}
              className="px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 text-xs font-semibold transition-colors">
              Held
            </button>
            <button onClick={() => onAction('MISSED')}
              className="px-2 py-1 rounded-md bg-danger/10 text-danger hover:bg-danger/20 text-xs font-semibold transition-colors">
              Missed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ActionDialog({ entry, status, onConfirm, onCancel }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const cfg = STATUS_CONFIG[status]

  const placeholder = status === 'REFUSED' ? 'Why did the patient refuse? (optional)'
    : status === 'HELD' ? 'Why is the dose held? (e.g. NPO, BP low, doctor instruction)'
    : status === 'MISSED' ? 'Why was the dose missed?'
    : ''

  return (
    <Modal open onClose={onCancel} title={`Mark as ${cfg.label}`} size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>}
            onClick={async () => { setSaving(true); await onConfirm(notes) }}>
            Confirm
          </Button>
        </>
      }>
      <div className="mb-3">
        <p className="text-sm text-slate-700">
          <strong>{entry.order?.medicineName}</strong> — {entry.order?.dose} {entry.order?.route}
        </p>
        <p className="text-xs text-slate-500">
          Scheduled: {format(new Date(entry.scheduledTime), 'd MMM, hh:mm a')}
        </p>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={placeholder}/>
      </div>
    </Modal>
  )
}
