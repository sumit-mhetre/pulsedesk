// IPD Orders tab — lab tests, imaging, diet, physiotherapy, special instructions.
// Distinct from medications (which have their own tab + MAR).
//
// Each order has lifecycle: ORDERED → ACKNOWLEDGED → IN_PROGRESS → COMPLETED.
// Or CANCELLED at any point.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, ClipboardList, FlaskConical, Image as ImageIcon, Utensils,
  Activity, MessageSquare, Save, Pencil, Trash2, X, Check, Printer,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

const ORDER_TYPES = [
  { value: 'LAB_TEST',              label: 'Lab Test',         icon: FlaskConical, accent: 'primary' },
  { value: 'IMAGING',               label: 'Imaging',          icon: ImageIcon,    accent: 'accent' },
  { value: 'DIET',                  label: 'Diet',             icon: Utensils,     accent: 'success' },
  { value: 'PHYSIOTHERAPY',         label: 'Physiotherapy',    icon: Activity,     accent: 'warning' },
  { value: 'NURSING_INSTRUCTION',   label: 'Nursing',          icon: MessageSquare, accent: 'accent' },
  { value: 'CONSULTATION_REFERRAL', label: 'Consult Referral', icon: MessageSquare, accent: 'primary' },
  { value: 'OTHER',                 label: 'Other',            icon: ClipboardList, accent: 'gray' },
]

const ORDER_TYPE_BY_VALUE = Object.fromEntries(ORDER_TYPES.map(t => [t.value, t]))

const DIET_TYPES = [
  'NORMAL', 'DIABETIC', 'RENAL', 'CARDIAC', 'SOFT', 'NPO', 'LIQUID',
  'HIGH_PROTEIN', 'LOW_SALT', 'CUSTOM',
]

const STATUS_VARIANTS = {
  ORDERED:      'gray',
  ACKNOWLEDGED: 'accent',
  IN_PROGRESS:  'warning',
  COMPLETED:    'success',
  CANCELLED:    'danger',
  HELD:         'warning',
}

export default function IPDOrdersTab({ admission }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageIPDOrders')
  const isOpen   = admission.status === 'ADMITTED'

  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/ipd-orders`)
      setOrders(data.data || [])
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const setStatus = async (order, status) => {
    try {
      await api.patch(`/ipd/ipd-orders/${order.id}/status`, { status })
      toast.success(`Marked ${status.toLowerCase()}`)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  // Group: open (not completed/cancelled) vs done
  const openOrders = orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status))
  const doneOrders = orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            IPD Orders
            {orders.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({orders.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Lab tests, imaging, diet, physio, and instructions</p>
        </div>
        {canWrite && isOpen && (
          <div className="flex gap-2">
            {orders.some(o => ['LAB_TEST', 'IMAGING'].includes(o.orderType) && !['COMPLETED', 'CANCELLED'].includes(o.status)) && (
              <Button variant="ghost" size="sm" icon={<Printer className="w-3.5 h-3.5"/>}
                onClick={() => navigate(`/ipd/admissions/${admission.id}/sample-slip/print`)}>
                Sample Slip
              </Button>
            )}
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={() => { setEditing(null); setShowForm(true) }}>
              Add Order
            </Button>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <Card className="p-10 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No orders yet</p>
          {canWrite && isOpen && (
            <p className="text-xs text-slate-400">Click "Add Order" to create the first one.</p>
          )}
        </Card>
      ) : (
        <>
          {openOrders.length > 0 && (
            <div className="mb-5">
              <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
                Active ({openOrders.length})
              </p>
              <div className="space-y-1.5">
                {openOrders.map(o => (
                  <OrderCard key={o.id} order={o}
                    canWrite={canWrite && isOpen}
                    onSetStatus={setStatus}
                    onEdit={() => { setEditing(o); setShowForm(true) }}/>
                ))}
              </div>
            </div>
          )}

          {doneOrders.length > 0 && (
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
                Completed / Cancelled ({doneOrders.length})
              </p>
              <div className="space-y-1.5 opacity-75">
                {doneOrders.map(o => (
                  <OrderCard key={o.id} order={o} canWrite={false}/>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <OrderFormModal
          admission={admission}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchData() }}/>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function OrderCard({ order, canWrite, onSetStatus, onEdit }) {
  const typeInfo = ORDER_TYPE_BY_VALUE[order.orderType] || ORDER_TYPE_BY_VALUE.OTHER

  const nextStatus = (() => {
    if (order.status === 'ORDERED')      return 'ACKNOWLEDGED'
    if (order.status === 'ACKNOWLEDGED') return 'IN_PROGRESS'
    if (order.status === 'IN_PROGRESS')  return 'COMPLETED'
    return null
  })()

  // Border color: blue=ordered, amber=acknowledged/in-progress,
  // green=completed, red=cancelled, slate=default
  const borderColors = {
    ORDERED:      'border-l-primary',
    ACKNOWLEDGED: 'border-l-warning',
    IN_PROGRESS:  'border-l-warning',
    COMPLETED:    'border-l-success',
    CANCELLED:    'border-l-danger',
    HELD:         'border-l-slate-400',
  }
  const borderClass = borderColors[order.status] || 'border-l-slate-300'

  return (
    <div className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">{typeInfo.label}</span>
        <p className="font-semibold text-slate-800 text-sm flex-1 min-w-0 truncate">{order.description}</p>
        <Badge variant={STATUS_VARIANTS[order.status] || 'gray'}>{order.status}</Badge>
        {canWrite && (
          <>
            {nextStatus && (
              <button onClick={() => onSetStatus(order, nextStatus)}
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">
                → {nextStatus.replace('_', ' ').toLowerCase()}
              </button>
            )}
            <button onClick={onEdit}
              className="text-xs text-slate-500 hover:text-primary whitespace-nowrap">
              <Pencil className="w-3 h-3 inline"/>
            </button>
            {order.status !== 'CANCELLED' && (
              <button onClick={() => onSetStatus(order, 'CANCELLED')}
                className="text-xs text-slate-500 hover:text-danger whitespace-nowrap">
                <X className="w-3 h-3 inline"/>
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-0.5">
        by <span className="font-medium text-slate-600">{order.orderedBy?.name}</span>
        <span className="text-slate-300"> · </span>
        {format(new Date(order.orderedAt), 'd MMM, hh:mm a')}
        <span className="text-slate-400"> · {formatDistanceToNow(new Date(order.orderedAt), { addSuffix: true })}</span>
      </p>

      {order.orderType === 'DIET' && order.details?.dietType && (
        <p className="text-xs text-slate-500 mt-0.5">
          Diet type: <span className="font-semibold text-success">{order.details.dietType}</span>
        </p>
      )}
      {order.orderType === 'LAB_TEST' && order.details?.tests?.length > 0 && (
        <p className="text-xs text-slate-500 mt-0.5">
          Tests: {order.details.tests.join(', ')}
        </p>
      )}
      {order.notes && (
        <p className="text-xs text-slate-500 italic mt-0.5">
          <span className="text-slate-400">note:</span> {order.notes}
        </p>
      )}
      {order.cancelledReason && (
        <p className="text-xs text-warning italic mt-0.5">Cancelled: {order.cancelledReason}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function OrderFormModal({ admission, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    orderType:   initial?.orderType   || 'LAB_TEST',
    description: initial?.description || '',
    notes:       initial?.notes       || '',
    // For DIET
    dietType:    initial?.details?.dietType || 'NORMAL',
    customDiet:  initial?.details?.customNotes || '',
    // For LAB_TEST
    tests:       (initial?.details?.tests || []).join(', '),
    // For IMAGING
    modality:    initial?.details?.modality || '',
    region:      initial?.details?.region || '',
  })
  const [saving, setSaving] = useState(false)

  // Auto-fill description placeholders by type
  const placeholderForType = (type) => {
    if (type === 'LAB_TEST')             return 'e.g. CBC, LFT, RFT, HbA1c'
    if (type === 'IMAGING')              return 'e.g. CT abdomen with contrast'
    if (type === 'DIET')                 return 'e.g. Diabetic diet, no salt'
    if (type === 'PHYSIOTHERAPY')        return 'e.g. Chest physio twice daily'
    if (type === 'NURSING_INSTRUCTION')  return 'e.g. Strict bed rest, head-end elevated 30°'
    if (type === 'CONSULTATION_REFERRAL') return 'e.g. Cardiology opinion for chest pain'
    return 'Order description'
  }

  const submit = async () => {
    if (!form.description.trim()) return toast.error('Description is required')

    let details = null
    if (form.orderType === 'DIET') {
      details = {
        dietType: form.dietType,
        customNotes: form.dietType === 'CUSTOM' ? form.customDiet.trim() : undefined,
      }
    } else if (form.orderType === 'LAB_TEST' && form.tests.trim()) {
      details = { tests: form.tests.split(',').map(t => t.trim()).filter(Boolean) }
    } else if (form.orderType === 'IMAGING' && (form.modality || form.region)) {
      details = { modality: form.modality.trim() || undefined, region: form.region.trim() || undefined }
    }

    setSaving(true)
    try {
      const payload = {
        orderType:   form.orderType,
        description: form.description.trim(),
        details,
        notes:       form.notes.trim() || undefined,
      }
      if (isEdit) {
        await api.put(`/ipd/ipd-orders/${initial.id}`, payload)
        toast.success('Order updated')
      } else {
        await api.post(`/ipd/admissions/${admission.id}/ipd-orders`, payload)
        toast.success('Order created')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Order' : 'Add IPD Order'} size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Order Type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ORDER_TYPES.map(t => {
              const Icon = t.icon
              const active = form.orderType === t.value
              return (
                <button key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, orderType: t.value }))}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium flex items-center gap-2 transition-colors
                    ${active
                      ? 'border-primary bg-blue-50 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-primary'}`}>
                  <Icon className="w-4 h-4"/>
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description *</label>
          <input className="form-input" value={form.description}
            placeholder={placeholderForType(form.orderType)}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/>
        </div>

        {/* Diet-specific fields */}
        {form.orderType === 'DIET' && (
          <>
            <div className="form-group">
              <label className="form-label">Diet Type</label>
              <select className="form-select" value={form.dietType}
                onChange={e => setForm(f => ({ ...f, dietType: e.target.value }))}>
                {DIET_TYPES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
              </select>
            </div>
            {form.dietType === 'CUSTOM' && (
              <div className="form-group">
                <label className="form-label">Custom Diet Details</label>
                <textarea className="form-input" rows={2} value={form.customDiet}
                  onChange={e => setForm(f => ({ ...f, customDiet: e.target.value }))}/>
              </div>
            )}
          </>
        )}

        {/* Lab-specific fields */}
        {form.orderType === 'LAB_TEST' && (
          <div className="form-group">
            <label className="form-label">Tests (comma-separated)</label>
            <input className="form-input" value={form.tests}
              placeholder="CBC, LFT, KFT"
              onChange={e => setForm(f => ({ ...f, tests: e.target.value }))}/>
          </div>
        )}

        {/* Imaging-specific fields */}
        {form.orderType === 'IMAGING' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Modality</label>
              <input className="form-input" value={form.modality}
                placeholder="X-ray, CT, MRI, USG"
                onChange={e => setForm(f => ({ ...f, modality: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Region</label>
              <input className="form-input" value={form.region}
                placeholder="Chest, Abdomen, etc."
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}/>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes}
            placeholder="Special instructions, urgency, etc."
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
        </div>
      </div>
    </Modal>
  )
}
