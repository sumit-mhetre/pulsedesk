// Medications tab — list of medication orders for the admission, with the
// ability to write new orders (doctor) and stop active orders.
//
// Layout:
//   - Active orders section (cards)
//   - Stopped/Completed section (collapsed)
//   - "Add Medication" button → modal with med picker + dose + route + frequency
//   - Each order shows: med name, dose, route, frequency, prescribed by, dates,
//     count of given/refused/missed doses

import { useEffect, useState, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pill, StopCircle, AlertTriangle, Save, X, ChevronDown, ChevronUp,
  CheckCircle, Clock, Printer, Package, Search,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

const FREQUENCIES = [
  { value: 'OD',   label: 'OD — Once a day',         times: '9 AM' },
  { value: 'BD',   label: 'BD — Twice a day',        times: '9 AM, 9 PM' },
  { value: 'TDS',  label: 'TDS — Three times a day', times: '8 AM, 2 PM, 8 PM' },
  { value: 'QID',  label: 'QID — Four times a day',  times: '6 AM, 12 PM, 6 PM, 10 PM' },
  { value: 'HS',   label: 'HS — At bedtime',         times: '10 PM' },
  { value: 'STAT', label: 'STAT — Once, immediately', times: 'Now' },
  { value: 'SOS',  label: 'SOS — As needed',         times: 'When required' },
  { value: 'Q4H',  label: 'Q4H — Every 4 hours',     times: '6, 10, 2, 6, 10, 2' },
  { value: 'Q6H',  label: 'Q6H — Every 6 hours',     times: '6 AM, 12, 6 PM, 12 AM' },
  { value: 'Q8H',  label: 'Q8H — Every 8 hours',     times: '8 AM, 4 PM, 12 AM' },
]

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'SL', 'PR', 'Topical', 'Inhalation', 'Eye', 'Ear', 'Nasal']

const STATUS_VARIANTS = {
  ACTIVE:    'success',
  STOPPED:   'warning',
  COMPLETED: 'primary',
  CANCELLED: 'gray',
}

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function MedicationsTab({ admission }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageMedicationOrders')
  const isOpen   = admission.status === 'ADMITTED'

  const [orders, setOrders]     = useState([])
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [confirmStop, setConfirmStop] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/medications`)
      setOrders(data.data || [])
    } catch {
      toast.error('Failed to load medications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  // Load medicines master once, use across modals + bulk editor
  useEffect(() => {
    api.get('/master/medicines')
      .then(r => setMedicines(r.data.data || []))
      .catch(() => {})
  }, [])

  const stopOrder = async (order, reason) => {
    try {
      await api.post(`/ipd/medications/${order.id}/stop`, { stopReason: reason })
      toast.success('Medication stopped')
      setConfirmStop(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to stop')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  const activeOrders   = orders.filter(o => o.status === 'ACTIVE')
  const inactiveOrders = orders.filter(o => o.status !== 'ACTIVE')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">Medications</h3>
          <p className="text-xs text-slate-500">Inpatient prescriptions and MAR schedule</p>
        </div>
        <div className="flex gap-2">
          {orders.some(o => o.procurementMode === 'PROCURE') && (
            <Button variant="ghost" size="sm" icon={<Printer className="w-3.5 h-3.5"/>}
              onClick={() => navigate(`/ipd/admissions/${admission.id}/procurement-slip/print`)}>
              Procurement Slip
            </Button>
          )}
          {canWrite && isOpen && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={() => setShowForm(true)}>
              Add Medications
            </Button>
          )}
        </div>
      </div>

      {/* Inline bulk editor — appears at the top when showForm=true */}
      {showForm && canWrite && isOpen && (
        <BulkAddEditor
          admission={admission}
          medicines={medicines}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData() }}
        />
      )}

      {/* Active */}
      {activeOrders.length === 0 && inactiveOrders.length === 0 ? (
        <Card className="p-10 text-center">
          <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No medications ordered</p>
          {canWrite && isOpen && (
            <p className="text-xs text-slate-400">Click "Add Medication" to write the first order.</p>
          )}
        </Card>
      ) : (
        <>
          {activeOrders.length > 0 && (
            <div className="space-y-1.5 mb-4">
              <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
                Active ({activeOrders.length})
              </p>
              {activeOrders.map(o => (
                <OrderCard key={o.id} order={o}
                  canWrite={canWrite && isOpen}
                  onStop={() => setConfirmStop(o)}/>
              ))}
            </div>
          )}

          {inactiveOrders.length > 0 && (
            <div>
              <button
                onClick={() => setShowInactive(s => !s)}
                className="text-xs uppercase font-semibold text-slate-500 hover:text-slate-700 tracking-wide flex items-center gap-1 mb-3">
                {showInactive ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                Stopped / Completed ({inactiveOrders.length})
              </button>
              {showInactive && (
                <div className="space-y-1.5">
                  {inactiveOrders.map(o => (
                    <OrderCard key={o.id} order={o} canWrite={false}/>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmStop}
        title={`Stop ${confirmStop?.medicineName}?`}
        message="This will stop future scheduled doses. Past doses remain in the record."
        variant="warning"
        confirmLabel="Yes, Stop"
        cancelLabel="Cancel"
        onConfirm={() => stopOrder(confirmStop, prompt('Reason for stopping (optional):') || '')}
        onClose={() => setConfirmStop(null)}/>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bulk inline editor -- doctor adds multiple medications at once
// without re-opening a modal each time.
//
// Behavior matches OPD prescription page:
//   - Starts with 1 empty row
//   - Typing a medicine in the LAST row auto-appends a new empty row below
//   - Each row picks medicine -> auto-focuses next row's medicine input
//   - "Save All" sends bulk POST -- transactional, all or nothing
//   - "Cancel" with confirm dialog if any rows have data
//
// Compact layout: Medicine | Dose | Route | Frequency | Source | Delete
// Expand-arrow per row reveals: Notes, Duration, Stop date, Expected qty
function BulkAddEditor({ admission, medicines, onClose, onSaved }) {
  const emptyRow = () => ({
    medicineId:    '',
    medicineName:  '',
    dose:          '',
    route:         'PO',
    frequency:     'BD',
    procurementMode: 'PROCURE',
    expectedQty:   '',
    duration:      '',
    notes:         '',
    expanded:      false,
  })

  const [rows, setRows] = useState([emptyRow()])
  const [saving, setSaving] = useState(false)
  const [errorRows, setErrorRows] = useState({}) // { rowIndex: errorMessage }
  const [confirmCancel, setConfirmCancel] = useState(false)

  const setRow = (idx, patch) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      // Auto-append empty row when typing in the last row's medicine
      if (idx === next.length - 1 && (patch.medicineId || (patch.medicineName && patch.medicineName.trim()))) {
        next.push(emptyRow())
      }
      return next
    })
    if (errorRows[idx]) {
      setErrorRows(prev => { const n = { ...prev }; delete n[idx]; return n })
    }
  }

  const removeRow = (idx) => {
    setRows(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length === 0 ? [emptyRow()] : next
    })
  }

  const toggleExpand = (idx) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], expanded: !next[idx].expanded }
      return next
    })
  }

  // Filled rows = rows where doctor entered a medicine name (or picked one)
  const filledRows = rows.filter(r => r.medicineId || (r.medicineName && r.medicineName.trim()))
  const hasAnyData = filledRows.length > 0

  const handleSave = async () => {
    if (filledRows.length === 0) {
      return toast.error('Add at least one medication')
    }

    // Client-side validation
    const newErrors = {}
    rows.forEach((r, i) => {
      const filled = r.medicineId || (r.medicineName && r.medicineName.trim())
      if (!filled) return
      if (!r.dose.trim())  newErrors[i] = 'Dose required'
      else if (!r.route)   newErrors[i] = 'Route required'
      else if (!r.frequency) newErrors[i] = 'Frequency required'
    })
    if (Object.keys(newErrors).length > 0) {
      setErrorRows(newErrors)
      toast.error('Fix the highlighted rows first')
      return
    }

    setSaving(true)
    try {
      const payload = {
        orders: filledRows.map(r => ({
          medicineId:      r.medicineId || undefined,
          medicineName:    r.medicineId ? undefined : r.medicineName.trim(),
          dose:            r.dose.trim(),
          route:           r.route,
          frequency:       r.frequency,
          procurementMode: r.procurementMode,
          expectedQty:     r.expectedQty.trim() || undefined,
          duration:        r.duration.trim() || undefined,
          notes:           r.notes.trim() || undefined,
        })),
      }
      const { data } = await api.post(`/ipd/admissions/${admission.id}/medications/bulk`, payload)
      toast.success(`${data.data.created} medication(s) saved`)
      onSaved()
    } catch (err) {
      const rowErrors = err?.response?.data?.errors?.rowErrors
      if (Array.isArray(rowErrors)) {
        const newErrors = {}
        for (const e of rowErrors) newErrors[e.rowIndex] = e.message
        setErrorRows(newErrors)
        toast.error(`${rowErrors.length} row(s) need fixing`)
      } else {
        toast.error(err?.response?.data?.message || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasAnyData) setConfirmCancel(true)
    else onClose()
  }

  return (
    <Card className="mb-5 border-primary/30 bg-blue-50/30">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-primary">New Medications</p>
          <p className="text-[11px] text-slate-500">
            {filledRows.length === 0 ? 'Type to add. New rows appear automatically.' : `${filledRows.length} row(s) ready to save`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" size="sm" loading={saving}
            disabled={filledRows.length === 0}
            icon={<Save className="w-3.5 h-3.5"/>}
            onClick={handleSave}>
            Save All ({filledRows.length})
          </Button>
        </div>
      </div>

      {/* Header row */}
      <div className="hidden md:grid gap-2 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400 font-bold border-b border-slate-200"
        style={{ gridTemplateColumns: '24px 2fr 100px 80px 100px 100px 28px 28px' }}>
        <div></div>
        <div>Medicine</div>
        <div>Dose</div>
        <div>Route</div>
        <div>Frequency</div>
        <div>Source</div>
        <div></div>
        <div></div>
      </div>

      {/* Rows */}
      {rows.map((r, idx) => (
        <BulkRow key={idx} row={r} idx={idx} medicines={medicines}
          isLast={idx === rows.length - 1}
          error={errorRows[idx]}
          onChange={(patch) => setRow(idx, patch)}
          onRemove={() => removeRow(idx)}
          onToggleExpand={() => toggleExpand(idx)}
          rowsLength={rows.length}/>
      ))}

      <ConfirmDialog
        open={confirmCancel}
        title={`Discard ${filledRows.length} medication(s)?`}
        message="The medications you've typed will not be saved. This cannot be undone."
        variant="warning"
        confirmLabel="Yes, Discard"
        cancelLabel="Keep Editing"
        onConfirm={() => { setConfirmCancel(false); onClose() }}
        onClose={() => setConfirmCancel(false)}/>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
function BulkRow({ row, idx, medicines, isLast, error, onChange, onRemove, onToggleExpand, rowsLength }) {
  // Auto-focus medicine input on the new row that just appeared.
  // Use setTimeout (not effect-during-render) so React commits the row's
  // DOM node before we try to focus it.
  const medicineInputRef = useRef(null)
  useEffect(() => {
    if (isLast && rowsLength > 1 && !row.medicineId && !row.medicineName) {
      const t = setTimeout(() => medicineInputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsLength])

  const isEmpty = !row.medicineId && !row.medicineName

  return (
    <div>
      <div className={`md:grid grid-cols-1 gap-2 px-2 py-1.5 border-b border-slate-100 ${error ? 'bg-red-50' : ''}`}
        style={{ gridTemplateColumns: '24px 2fr 100px 80px 100px 100px 28px 28px' }}>
        <div className="hidden md:flex items-center text-[11px] text-slate-400 font-mono">
          {idx + 1}
        </div>

        {/* Medicine (autocomplete) */}
        <div className="mb-2 md:mb-0">
          <RowMedicineInput
            ref={medicineInputRef}
            value={row.medicineName}
            medicines={medicines}
            onSelect={(med) => onChange({
              medicineId: med.id,
              medicineName: med.name,
              dose: row.dose || med.defaultDosage || '',
            })}
            onTypedCustom={(name) => onChange({ medicineId: '', medicineName: name })}
          />
        </div>

        {/* Dose */}
        <div className="mb-2 md:mb-0">
          <input className="form-input py-1.5 text-sm" value={row.dose}
            placeholder="500 mg"
            onChange={e => onChange({ dose: e.target.value })}/>
        </div>

        {/* Route */}
        <div className="mb-2 md:mb-0">
          <select className="form-select py-1.5 text-sm" value={row.route}
            onChange={e => onChange({ route: e.target.value })}>
            {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Frequency */}
        <div className="mb-2 md:mb-0">
          <select className="form-select py-1.5 text-sm" value={row.frequency}
            onChange={e => onChange({ frequency: e.target.value })}>
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.value}</option>)}
          </select>
        </div>

        {/* Source */}
        <div className="mb-2 md:mb-0">
          <select className="form-select py-1.5 text-sm" value={row.procurementMode}
            onChange={e => onChange({ procurementMode: e.target.value })}>
            <option value="PROCURE">Procure</option>
            <option value="STOCK">Stock</option>
          </select>
        </div>

        {/* Expand toggle */}
        <button type="button" onClick={onToggleExpand}
          className="hidden md:flex items-center justify-center text-slate-400 hover:text-primary"
          title="Show more fields">
          {row.expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>

        {/* Delete (hidden if only empty row left) */}
        {!isEmpty || rowsLength > 1 ? (
          <button type="button" onClick={onRemove}
            className="hidden md:flex items-center justify-center text-slate-300 hover:text-danger"
            title="Remove row">
            <X className="w-4 h-4"/>
          </button>
        ) : <div/>}
      </div>

      {/* Expanded extra fields */}
      {row.expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-2 py-2 bg-slate-50 border-b border-slate-100">
          <div className="form-group mb-0">
            <label className="form-label text-[10px]">Duration</label>
            <input className="form-input py-1 text-xs" value={row.duration}
              placeholder="5 days"
              onChange={e => onChange({ duration: e.target.value })}/>
          </div>
          <div className="form-group mb-0">
            <label className="form-label text-[10px]">Expected Qty (esp. SOS)</label>
            <input className="form-input py-1 text-xs" value={row.expectedQty}
              placeholder="5 vials"
              onChange={e => onChange({ expectedQty: e.target.value })}/>
          </div>
          <div className="form-group mb-0 sm:col-span-3">
            <label className="form-label text-[10px]">Notes</label>
            <input className="form-input py-1 text-xs" value={row.notes}
              placeholder="With food, watch BP, etc."
              onChange={e => onChange({ notes: e.target.value })}/>
          </div>
        </div>
      )}

      {error && (
        <div className="px-2 py-1 bg-red-50 text-xs text-danger border-b border-red-200">
          Row {idx + 1}: {error}
        </div>
      )}
    </div>
  )
}

// Wrapper around MedicineAutocomplete that exposes a ref to the input
// so the parent can focus the next row after pick.
const RowMedicineInput = forwardRef(function RowMedicineInput(
  { value, medicines, onSelect, onTypedCustom }, ref
) {
  return (
    <MedicineAutocomplete
      value={value}
      medicines={medicines}
      onSelect={onSelect}
      onTypedCustom={onTypedCustom}
      inputRef={ref}/>
  )
})

// ─────────────────────────────────────────────────────────
function OrderCard({ order, canWrite, onStop }) {
  const givenCount   = order.administrations?.filter(a => a.status === 'GIVEN').length || 0
  const pendingCount = order.administrations?.filter(a => a.status === 'PENDING').length || 0
  const refusedCount = order.administrations?.filter(a => ['REFUSED','MISSED','HELD'].includes(a.status)).length || 0
  const totalCount   = order.administrations?.length || 0
  const freqInfo = FREQUENCIES.find(f => f.value === order.frequency)

  // Left border color encodes status -- visual scan without reading badges.
  // ACTIVE = green (live), STOPPED = amber (caution, manual stop),
  // COMPLETED = slate (course done naturally), CANCELLED = red (genuine error).
  const borderColors = {
    ACTIVE:    'border-l-success',
    STOPPED:   'border-l-warning',
    COMPLETED: 'border-l-slate-300',
    CANCELLED: 'border-l-danger',
  }
  const borderClass = borderColors[order.status] || 'border-l-slate-300'

  return (
    <div className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2 hover:border-slate-300 transition-colors`}>
      {/* Line 1: medicine name, schedule, counts, badges, stop */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{order.medicineName}</p>
        <p className="text-xs text-slate-600 flex-1 min-w-0">
          <span className="font-mono">{order.dose}</span>
          <span className="text-slate-400"> · </span>
          <span>{order.route}</span>
          <span className="text-slate-400"> · </span>
          <span className="font-semibold">{order.frequency}</span>
          {freqInfo?.times && <span className="text-slate-400 ml-1">({freqInfo.times})</span>}
        </p>

        {/* Dose counts -- compact form */}
        {totalCount > 0 && (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            <span className="font-semibold text-success">{givenCount}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-primary">{pendingCount}</span>
            {refusedCount > 0 && (
              <>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-warning">{refusedCount}</span>
              </>
            )}
            <span className="text-slate-400 ml-1 text-[10px]">
              {refusedCount > 0 ? 'g/p/m' : 'g/p'}
            </span>
          </span>
        )}

        {/* Procurement source */}
        {order.procurementMode === 'STOCK' && (
          <Badge variant="accent" title="From clinic stock">Stock</Badge>
        )}
        {order.procurementMode === 'PROCURE' && (
          <Badge variant="warning" title="Relatives need to buy">Procure</Badge>
        )}

        {/* Status badge only if NOT active (active is implied by green stripe) */}
        {order.status !== 'ACTIVE' && (
          <Badge variant={STATUS_VARIANTS[order.status]}>{order.status}</Badge>
        )}

        {/* Stop action */}
        {canWrite && order.status === 'ACTIVE' && (
          <button onClick={onStop}
            className="text-xs text-warning hover:underline inline-flex items-center gap-0.5 whitespace-nowrap">
            <StopCircle className="w-3 h-3"/> Stop
          </button>
        )}
      </div>

      {/* Line 2: prescriber + time + duration */}
      <p className="text-[11px] text-slate-500 mt-0.5">
        by <span className="font-medium text-slate-600">{order.prescribedBy?.name || '--'}</span>
        <span className="text-slate-300"> · </span>
        {format(new Date(order.startDate), 'd MMM, hh:mm a')}
        {order.duration && <><span className="text-slate-300"> · </span>{order.duration}</>}
        {order.stopReason && (
          <><span className="text-slate-300"> · </span><span className="text-warning italic">stopped: {order.stopReason}</span></>
        )}
      </p>

      {/* Notes -- only if present */}
      {order.notes && (
        <p className="text-[11px] text-slate-500 italic mt-0.5">
          <span className="text-slate-400">note:</span> {order.notes}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function OrderFormModal({ admission, onClose, onSaved }) {
  const [medicines, setMedicines] = useState([])
  const [form, setForm] = useState({
    medicineId:    '',
    medicineName:  '',
    dose:          '',
    route:         'PO',
    frequency:     'BD',
    startDate:     toLocalInput(new Date()),
    stopDate:      '',
    duration:      '',
    notes:         '',
    procurementMode: 'PROCURE',
    expectedQty:   '',
  })
  const [saving, setSaving] = useState(false)
  const [allergyConflict, setAllergyConflict] = useState(null)
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    api.get('/master/medicines')
      .then(r => setMedicines(r.data.data || []))
      .catch(() => {})
  }, [])

  const submitWithOverride = async (override = false) => {
    if (!form.dose.trim())  return toast.error('Dose is required')
    if (!form.route.trim()) return toast.error('Route is required')
    if (!form.medicineId && !form.medicineName.trim()) {
      return toast.error('Select a medicine or type a custom name')
    }

    setSaving(true)
    try {
      const payload = {
        medicineId:   form.medicineId || undefined,
        medicineName: form.medicineId ? undefined : form.medicineName.trim(),
        dose:         form.dose.trim(),
        route:        form.route,
        frequency:    form.frequency,
        startDate:    form.startDate,
        stopDate:     form.stopDate || undefined,
        duration:     form.duration.trim() || undefined,
        notes:        form.notes.trim() || undefined,
        procurementMode: form.procurementMode,
        expectedQty:  form.expectedQty.trim() || undefined,
      }
      if (override) {
        payload.allergyOverride = true
        payload.allergyOverrideReason = overrideReason.trim() || 'no reason given'
      }
      await api.post(`/ipd/admissions/${admission.id}/medications`, payload)
      toast.success('Medication ordered')
      onSaved()
    } catch (err) {
      const errors = err?.response?.data?.errors
      if (errors?.allergyConflict) {
        setAllergyConflict(errors)
      } else {
        toast.error(err?.response?.data?.message || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Medication" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>}
            onClick={() => submitWithOverride(false)}>
            Save Order
          </Button>
        </>
      }>
      <div className="space-y-3">
        {/* Medicine picker — type to search master, or type custom name */}
        <div className="form-group">
          <label className="form-label">Medicine *</label>
          <MedicineAutocomplete
            value={form.medicineName}
            medicines={medicines}
            onSelect={(med) => {
              setForm(f => ({
                ...f,
                medicineId: med.id,
                medicineName: med.name,
                dose: med.defaultDosage || f.dose,
              }))
            }}
            onTypedCustom={(name) => {
              setForm(f => ({ ...f, medicineId: '', medicineName: name }))
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Dose *</label>
            <input className="form-input" value={form.dose}
              placeholder="500 mg / 1 tab / 5 mL"
              onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Route *</label>
            <select className="form-select" value={form.route}
              onChange={e => setForm(f => ({ ...f, route: e.target.value }))}>
              {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2">
            <label className="form-label">Frequency *</label>
            <select className="form-select" value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQUENCIES.map(f => (
                <option key={f.value} value={f.value}>{f.label} • {f.times}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input type="datetime-local" className="form-input"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Stop Date</label>
            <input type="datetime-local" className="form-input"
              value={form.stopDate}
              onChange={e => setForm(f => ({ ...f, stopDate: e.target.value }))}/>
          </div>
          <div className="form-group col-span-2">
            <label className="form-label">Duration (optional)</label>
            <input className="form-input" value={form.duration}
              placeholder="5 days, 1 week, until further notice"
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}/>
          </div>
          <div className="form-group col-span-2">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Special instructions, e.g. with food, watch BP, etc."/>
          </div>

          {/* Procurement section */}
          <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-primary"/>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Procurement</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="form-group mb-0">
                <label className="form-label text-[11px]">Source</label>
                <div className="flex gap-1">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, procurementMode: 'PROCURE' }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${form.procurementMode === 'PROCURE'
                        ? 'bg-primary text-white'
                        : 'bg-white border border-slate-200 text-slate-600'}`}>
                    Buy outside
                  </button>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, procurementMode: 'STOCK' }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${form.procurementMode === 'STOCK'
                        ? 'bg-primary text-white'
                        : 'bg-white border border-slate-200 text-slate-600'}`}>
                    From stock
                  </button>
                </div>
              </div>
              <div className="form-group mb-0">
                <label className="form-label text-[11px]">
                  Expected Qty <span className="font-normal text-slate-400">(esp. for SOS)</span>
                </label>
                <input className="form-input py-1.5 text-sm" value={form.expectedQty}
                  placeholder="e.g. 5 vials, 1 strip"
                  onChange={e => setForm(f => ({ ...f, expectedQty: e.target.value }))}/>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              "Buy outside" items appear on the procurement slip given to relatives.
              "From stock" items skip the slip and are added to charges directly.
            </p>
          </div>
        </div>
      </div>

      {/* Allergy override modal-within-modal */}
      {allergyConflict && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAllergyConflict(null)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-2 border-danger/30">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5"/>
              <div>
                <h3 className="font-bold text-slate-800">Allergy Warning</h3>
                <p className="text-sm text-slate-700 mt-1">
                  Patient has known allergies that may conflict:
                </p>
                <p className="text-sm font-semibold text-danger mt-1">
                  {allergyConflict.allergies?.join(', ')}
                </p>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Override Reason</label>
              <textarea className="form-input" rows={3}
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="E.g. Documented mild reaction only, alternatives unavailable, monitored administration"/>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="ghost" onClick={() => setAllergyConflict(null)}>Cancel</Button>
              <Button variant="danger" loading={saving}
                onClick={() => { setAllergyConflict(null); submitWithOverride(true) }}>
                Override and Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────
// Medicine autocomplete -- type to search master, or type a name
// not in master to save it as a custom (free-text) medicine.
//
// Behavior:
//   - Click input -> dropdown shows all medicines (top 14)
//   - Type 1+ chars -> dropdown filters by name (case-insensitive)
//   - Click a medicine -> calls onSelect(medicine), closes dropdown
//   - Type free text + blur/enter -> calls onTypedCustom(name) if no match
//   - Esc closes dropdown
//
// Behaves like the OPD prescription form's medicine picker.
//
// IMPORTANT: this is a CONTROLLED component. The displayed text is always
// `value` from the parent. Local state is only used for: dropdown open/closed,
// and an intermediate "typing buffer" that holds keystrokes before they're
// committed to the parent.
//
// Typing flow:
//   - User types -> local typing state updates -> filters dropdown
//   - User picks from dropdown -> onSelect(med) -> parent updates value
//   - User blurs without picking -> if there was typing, onTypedCustom(text)
//   - When parent's value changes, typing buffer is reset
function MedicineAutocomplete({ value, medicines, onSelect, onTypedCustom, inputRef: externalRef }) {
  const [typing, setTyping] = useState(null)  // null = use parent value; string = user is typing
  const [open,   setOpen]   = useState(false)
  const internalInputRef = useRef(null)
  const dropRef          = useRef(null)
  const justSelectedRef  = useRef(false)

  // Whenever parent's value changes (e.g. after pick or row reset), clear typing buffer
  useEffect(() => { setTyping(null) }, [value])

  // Display: typing buffer if user is actively typing, else parent value
  const display = typing !== null ? typing : (value || '')
  const qLc = display.toLowerCase().trim()

  // Merge external + internal ref
  const inputRef = (node) => {
    internalInputRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef && typeof externalRef === 'object') externalRef.current = node
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!internalInputRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const filtered = qLc.length === 0
    ? medicines.slice(0, 14)
    : medicines
        .filter(m =>
          m.name.toLowerCase().includes(qLc) ||
          (m.genericName || '').toLowerCase().includes(qLc) ||
          (m.category    || '').toLowerCase().includes(qLc))
        .slice(0, 14)

  const exactMatch = (typed) => medicines.find(
    m => m.name.toLowerCase() === typed.toLowerCase()
  )

  const commitTyped = () => {
    if (typing === null) return
    const typed = typing.trim()
    setTyping(null)
    if (!typed) return
    const exact = exactMatch(typed)
    if (exact) onSelect(exact)
    else       onTypedCustom(typed)
  }

  const handleSelect = (m) => {
    justSelectedRef.current = true
    setTyping(null)   // clear typing buffer immediately
    onSelect(m)       // parent will set value to m.name; useEffect resets typing
    setOpen(false)
    setTimeout(() => { justSelectedRef.current = false }, 300)
  }

  const TYPE_COLORS = {
    tablet:    'bg-blue-50 text-blue-700',
    capsule:   'bg-purple-50 text-purple-700',
    liquid:    'bg-cyan-50 text-cyan-700',
    drops:     'bg-green-50 text-green-700',
    cream:     'bg-orange-50 text-orange-700',
    sachet:    'bg-yellow-50 text-yellow-700',
    injection: 'bg-red-50 text-red-700',
    inhaler:   'bg-indigo-50 text-indigo-700',
    powder:    'bg-slate-100 text-slate-600',
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
        <input
          ref={inputRef}
          className="form-input pl-9"
          autoComplete="off"
          placeholder="Type to search medicine, or type a custom name..."
          value={display}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setTyping(e.target.value); setOpen(true) }}
          onBlur={() => {
            setTimeout(() => {
              if (!justSelectedRef.current) commitTyped()
            }, 200)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length > 0 && qLc.length > 0) {
                handleSelect(filtered[0])
              } else {
                commitTyped()
                setOpen(false)
              }
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
      </div>

      {open && (
        <div ref={dropRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-modal border border-blue-100 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400 italic">
              No medicines match "{display}". Press Enter to use it as a custom name.
            </div>
          ) : (
            filtered.map(m => (
              <button key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(m)
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-slate-50 last:border-0">
                {m.type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${TYPE_COLORS[m.type] || 'bg-slate-100 text-slate-600'}`}>
                    {m.type}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                  {(m.genericName || m.category) && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {m.genericName}{m.genericName && m.category ? ' / ' : ''}{m.category}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
