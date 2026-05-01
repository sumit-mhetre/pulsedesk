// Intake/Output (I/O) tab — fluid balance tracking.
//
// Shows: daily totals at top (intake / output / balance per day), then full
// table of individual records below. New entries via inline modal.

import { useEffect, useState } from 'react'
import {
  Plus, Droplet, ArrowDown, ArrowUp, Equal, Trash2, Save,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const SHIFTS = [
  { value: '',          label: '— None —' },
  { value: 'MORNING',   label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'NIGHT',     label: 'Night' },
]

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function IntakeOutputTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'recordIntakeOutput')
  const isOpen   = admission.status === 'ADMITTED'

  const [records, setRecords] = useState([])
  const [daily, setDaily]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/intake-output`)
      setRecords(data.data?.records || [])
      setDaily(data.data?.daily || [])
    } catch {
      toast.error('Failed to load intake/output')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const onDelete = async (id) => {
    if (!confirm('Delete this I/O record?')) return
    try {
      await api.delete(`/ipd/intake-output/${id}`)
      toast.success('Deleted')
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cannot delete (only the recorder, within 4 hours)')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Intake / Output
            {records.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({records.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Fluid balance tracking</p>
        </div>
        {canWrite && isOpen && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setShowForm(true)}>
            Add Record
          </Button>
        )}
      </div>

      {/* Daily totals -- compact rows */}
      {daily.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide">Daily Totals</p>
          {daily.map(d => (
            <div key={d.date}
              className="bg-white border border-slate-200 border-l-4 border-l-slate-300 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <p className="font-semibold text-slate-700">{format(new Date(d.date), 'd MMM yyyy')}</p>
                <span className="text-[11px] text-slate-400">({d.count} entries)</span>
                <span className="flex-1"/>
                <span className="text-xs">
                  <span className="text-slate-500">In </span>
                  <span className="font-bold text-success">{d.intake.toLocaleString()} mL</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs">
                  <span className="text-slate-500">Out </span>
                  <span className="font-bold text-danger">{d.output.toLocaleString()} mL</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs">
                  <span className="text-slate-500">Bal </span>
                  <span className={`font-bold ${d.balance >= 0 ? 'text-primary' : 'text-warning'}`}>
                    {d.balance > 0 ? '+' : ''}{d.balance.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Records table */}
      {records.length === 0 ? (
        <Card className="p-10 text-center">
          <Droplet className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500">No intake/output records yet</p>
        </Card>
      ) : (
        <Card>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Recorded</th><th>Shift</th>
                  <th colSpan={3} className="text-center bg-green-50/50">Intake (mL)</th>
                  <th colSpan={4} className="text-center bg-red-50/50">Output</th>
                  <th>By</th><th></th>
                </tr>
                <tr className="text-xs text-slate-500">
                  <th></th><th></th>
                  <th className="bg-green-50/50">Oral</th>
                  <th className="bg-green-50/50">IV</th>
                  <th className="bg-green-50/50">RT Feed</th>
                  <th className="bg-red-50/50">Urine</th>
                  <th className="bg-red-50/50">Drain</th>
                  <th className="bg-red-50/50">Vomit</th>
                  <th className="bg-red-50/50">Stool</th>
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <Row key={r.id} r={r} currentUserId={user?.id} onDelete={onDelete}/>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <Form admissionId={admission.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}/>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Row({ r, currentUserId, onDelete }) {
  const ageHours = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60)
  const canDelete = r.recordedById === currentUserId && ageHours < 4

  return (
    <tr>
      <td className="text-xs">
        <p className="text-slate-700">{format(new Date(r.recordedAt), 'd MMM')}</p>
        <p className="text-slate-400">{format(new Date(r.recordedAt), 'HH:mm')}</p>
      </td>
      <td>{r.shift && <Badge variant="accent">{r.shift}</Badge>}</td>
      <td className="text-sm">{r.oralIntake ?? '—'}</td>
      <td className="text-sm">{r.ivFluids ?? '—'}</td>
      <td className="text-sm">{r.rylesTubeFeed ?? '—'}</td>
      <td className="text-sm">{r.urineOutput ?? '—'}</td>
      <td className="text-sm">{r.drainOutput ?? '—'}</td>
      <td className="text-sm">{r.vomit ?? '—'}</td>
      <td className="text-sm">{r.stoolCount ?? '—'}</td>
      <td className="text-xs text-slate-500">{r.recordedBy?.name}</td>
      <td className="text-right">
        {canDelete && (
          <button onClick={() => onDelete(r.id)}
            className="text-xs text-danger hover:underline">
            <Trash2 className="w-3 h-3"/>
          </button>
        )}
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────
function Form({ admissionId, onClose, onSaved }) {
  const [form, setForm] = useState({
    recordedAt:    toLocalInput(new Date()),
    shift:         '',
    oralIntake:    '',
    ivFluids:      '',
    rylesTubeFeed: '',
    urineOutput:   '',
    drainOutput:   '',
    vomit:         '',
    stoolCount:    '',
    notes:         '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await api.post(`/ipd/admissions/${admissionId}/intake-output`, form)
      toast.success('I/O recorded')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add I/O Record" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="form-label">Recorded At</label>
          <input type="datetime-local" className="form-input"
            value={form.recordedAt}
            onChange={e => setForm(f => ({ ...f, recordedAt: e.target.value }))}/>
        </div>
        <div className="form-group">
          <label className="form-label">Shift</label>
          <select className="form-select" value={form.shift}
            onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
            {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-success mt-4 mb-2">
        <ArrowDown className="w-3.5 h-3.5 inline mr-1"/> Intake (mL)
      </p>
      <div className="grid grid-cols-3 gap-3">
        <NumField label="Oral" val={form.oralIntake} onChange={v => setForm(f => ({ ...f, oralIntake: v }))}/>
        <NumField label="IV Fluids" val={form.ivFluids} onChange={v => setForm(f => ({ ...f, ivFluids: v }))}/>
        <NumField label="RT Feed" val={form.rylesTubeFeed} onChange={v => setForm(f => ({ ...f, rylesTubeFeed: v }))}/>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-danger mt-4 mb-2">
        <ArrowUp className="w-3.5 h-3.5 inline mr-1"/> Output
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <NumField label="Urine (mL)" val={form.urineOutput} onChange={v => setForm(f => ({ ...f, urineOutput: v }))}/>
        <NumField label="Drain (mL)" val={form.drainOutput} onChange={v => setForm(f => ({ ...f, drainOutput: v }))}/>
        <NumField label="Vomit (mL)" val={form.vomit} onChange={v => setForm(f => ({ ...f, vomit: v }))}/>
        <NumField label="Stool (count)" val={form.stoolCount} onChange={v => setForm(f => ({ ...f, stoolCount: v }))}/>
      </div>

      <div className="form-group mt-4">
        <label className="form-label">Notes</label>
        <input className="form-input" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Optional"/>
      </div>
    </Modal>
  )
}

function NumField({ label, val, onChange }) {
  return (
    <div>
      <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-0.5">{label}</p>
      <input type="number" min="0" className="form-input py-1.5 text-sm"
        value={val} onChange={e => onChange(e.target.value)}/>
    </div>
  )
}
