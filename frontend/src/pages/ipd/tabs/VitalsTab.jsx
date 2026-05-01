// IPD Vitals tab — time-series readings with quick-entry inline row.
//
// Quick row at top: type values inline → press Save → vital recorded.
// Below: chronological table of readings.
// Right side: simple trend chart for the most-tracked metric (BP).

import { useEffect, useState, useRef } from 'react'
import {
  Plus, Activity, Trash2, Heart, Thermometer, Wind, Droplet, X,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Card, Button } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function VitalsTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'recordIPDVitals')
  const isOpen   = admission.status === 'ADMITTED'

  const [vitals, setVitals]   = useState([])
  const [loading, setLoading] = useState(true)

  // Quick entry form state
  const [entry, setEntry] = useState(emptyEntry())
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef(null)

  function emptyEntry() {
    return { bp: '', pulse: '', temperature: '', spo2: '', respRate: '', bloodSugar: '', painScore: '', notes: '' }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/vitals`)
      setVitals(data.data || [])
    } catch {
      toast.error('Failed to load vitals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const submit = async () => {
    // Require at least one field filled
    const hasAny = ['bp','pulse','temperature','spo2','respRate','bloodSugar','painScore','notes']
      .some(k => String(entry[k] || '').trim())
    if (!hasAny) return toast.error('Enter at least one value')

    setSaving(true)
    try {
      await api.post(`/ipd/admissions/${admission.id}/vitals`, entry)
      toast.success('Vitals recorded')
      setEntry(emptyEntry())
      firstFieldRef.current?.focus()
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id) => {
    if (!confirm('Delete this vitals record?')) return
    try {
      await api.delete(`/ipd/vitals/${id}`)
      toast.success('Deleted')
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cannot delete (only the recorder, within 4 hours)')
    }
  }

  // Chart data — pulse + temperature + spo2 over time, oldest → newest
  const chartData = [...vitals].reverse().map(v => ({
    time: format(new Date(v.recordedAt), 'd MMM HH:mm'),
    pulse: v.pulse,
    temp:  v.temperature,
    spo2:  v.spo2,
  })).filter(d => d.pulse || d.temp || d.spo2)

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Vitals
            {vitals.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({vitals.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Time-series readings during admission</p>
        </div>
      </div>

      {/* Quick entry row */}
      {canWrite && isOpen && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Quick Entry</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <FieldInline ref={firstFieldRef} label="BP" placeholder="120/80"
              value={entry.bp}
              onChange={v => setEntry(e => ({ ...e, bp: v }))}/>
            <FieldInline label="Pulse" placeholder="80"
              type="number" suffix="bpm"
              value={entry.pulse}
              onChange={v => setEntry(e => ({ ...e, pulse: v }))}/>
            <FieldInline label="Temp" placeholder="98.6"
              type="number" step="0.1" suffix="°F"
              value={entry.temperature}
              onChange={v => setEntry(e => ({ ...e, temperature: v }))}/>
            <FieldInline label="SpO2" placeholder="98"
              type="number" suffix="%"
              value={entry.spo2}
              onChange={v => setEntry(e => ({ ...e, spo2: v }))}/>
            <FieldInline label="RR" placeholder="16"
              type="number" suffix="/min"
              value={entry.respRate}
              onChange={v => setEntry(e => ({ ...e, respRate: v }))}/>
            <FieldInline label="Sugar" placeholder="110"
              type="number" suffix="mg/dL"
              value={entry.bloodSugar}
              onChange={v => setEntry(e => ({ ...e, bloodSugar: v }))}/>
            <FieldInline label="Pain" placeholder="0-10"
              type="number" min="0" max="10"
              value={entry.painScore}
              onChange={v => setEntry(e => ({ ...e, painScore: v }))}/>
            <FieldInline label="Notes" placeholder="..."
              value={entry.notes}
              onChange={v => setEntry(e => ({ ...e, notes: v }))}/>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="primary" size="sm" loading={saving}
              icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={submit}>
              Save Reading
            </Button>
          </div>
        </Card>
      )}

      {/* Trend chart */}
      {chartData.length >= 2 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            <Activity className="w-3.5 h-3.5 inline mr-1"/> Trends (Pulse / Temp / SpO2)
          </p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Line type="monotone" dataKey="pulse" stroke="#E53935" name="Pulse" connectNulls/>
                <Line type="monotone" dataKey="temp"  stroke="#FB8C00" name="Temp"  connectNulls/>
                <Line type="monotone" dataKey="spo2"  stroke="#43A047" name="SpO2"  connectNulls/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Table */}
      {vitals.length === 0 ? (
        <Card className="p-10 text-center">
          <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500">No vitals recorded yet</p>
        </Card>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] uppercase text-slate-500 tracking-wide">
                  <th className="text-left px-3 py-2 font-semibold">Time</th>
                  <th className="text-left px-2 py-2 font-semibold">BP</th>
                  <th className="text-left px-2 py-2 font-semibold">Pulse</th>
                  <th className="text-left px-2 py-2 font-semibold">Temp</th>
                  <th className="text-left px-2 py-2 font-semibold">SpO2</th>
                  <th className="text-left px-2 py-2 font-semibold">RR</th>
                  <th className="text-left px-2 py-2 font-semibold">Sugar</th>
                  <th className="text-left px-2 py-2 font-semibold">Pain</th>
                  <th className="text-left px-2 py-2 font-semibold">By</th>
                  <th className="text-left px-2 py-2 font-semibold">Notes</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vitals.map(v => (
                  <VitalRow key={v.id} v={v} currentUserId={user?.id} onDelete={onDelete}/>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline field helper ─────────────────────────────────────
import { forwardRef } from 'react'
const FieldInline = forwardRef(function FieldInline({ label, value, onChange, type = 'text', placeholder, suffix, ...rest }, ref) {
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide mb-0.5">
        {label}{suffix && <span className="text-slate-300 font-normal normal-case ml-1">({suffix})</span>}
      </p>
      <input
        ref={ref}
        type={type}
        className="form-input py-1.5 px-2 text-sm w-full"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  )
})

// ── Single vital row ────────────────────────────────────────
// Severity check: any value outside normal range tints the row's left border red.
// BP > 140/90 or < 90/60, pulse < 60 or > 100, temp >= 38 or < 36,
// spo2 < 92, sugar < 70 or > 200.
function isVitalAbnormal(v) {
  if (v.bp) {
    const m = String(v.bp).match(/^(\d+)\s*\/\s*(\d+)/)
    if (m) {
      const sys = +m[1], dia = +m[2]
      if (sys >= 140 || sys < 90 || dia >= 90 || dia < 60) return true
    }
  }
  if (v.pulse != null && (v.pulse < 60 || v.pulse > 100)) return true
  if (v.temperature != null && (v.temperature >= 38 || v.temperature < 36)) return true
  if (v.spo2 != null && v.spo2 < 92) return true
  if (v.bloodSugar != null && (v.bloodSugar < 70 || v.bloodSugar > 200)) return true
  if (v.painScore != null && v.painScore >= 7) return true
  return false
}

function VitalRow({ v, currentUserId, onDelete }) {
  const ageHours = (Date.now() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60)
  const canDelete = v.recordedById === currentUserId && ageHours < 4
  const abnormal = isVitalAbnormal(v)

  // Left border accent: red if any value abnormal, slate otherwise.
  // Applied via box-shadow inset on the first cell (works inside table layout).
  const accent = abnormal ? 'shadow-[inset_4px_0_0_0_var(--color-danger,#E53935)]'
                          : 'shadow-[inset_4px_0_0_0_var(--color-slate-200,#E2E8F0)]'

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className={`text-xs px-3 py-1.5 ${accent}`}>
        <p className="text-slate-700">{format(new Date(v.recordedAt), 'd MMM')}</p>
        <p className="text-slate-400">{format(new Date(v.recordedAt), 'HH:mm')}</p>
      </td>
      <td className="text-sm font-mono px-2 py-1.5">{v.bp || '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.pulse ?? '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.temperature ?? '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.spo2 ?? '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.respRate ?? '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.bloodSugar ?? '—'}</td>
      <td className="text-sm px-2 py-1.5">{v.painScore ?? '—'}</td>
      <td className="text-xs text-slate-500 px-2 py-1.5">{v.recordedBy?.name || '—'}</td>
      <td className="text-xs text-slate-500 max-w-[180px] truncate px-2 py-1.5">{v.notes || '—'}</td>
      <td className="text-right px-2 py-1.5">
        {canDelete && (
          <button onClick={() => onDelete(v.id)}
            className="text-xs text-danger hover:underline inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3"/>
          </button>
        )}
      </td>
    </tr>
  )
}
