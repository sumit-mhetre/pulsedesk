// IPD Charges tab - line-item ledger of all chargeable items.
//
// Layout:
//   - Summary card with category breakdown + total
//   - "Add Charge" button → modal
//   - Table of charges, click to edit/void
//   - Voided rows shown faded with strikethrough

import { useEffect, useRef, useState } from 'react'
import {
  Plus, IndianRupee, Pencil, X, Save, AlertCircle, Trash2,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CHARGE_TYPES = [
  { value: 'DOCTOR_VISIT',  label: 'Doctor Visit' },
  { value: 'CONSULTATION',  label: 'Consultation' },
  { value: 'NURSING_CARE',  label: 'Nursing Care' },
  { value: 'MEDICINE',      label: 'Medicine' },
  { value: 'CONSUMABLE',    label: 'Consumable' },
  { value: 'LAB_TEST',      label: 'Lab Test' },
  { value: 'IMAGING',       label: 'Imaging' },
  { value: 'PROCEDURE',     label: 'Procedure' },
  { value: 'OT_CHARGE',     label: 'OT Charge' },
  { value: 'OTHER',         label: 'Other' },
]

const CHARGE_TYPE_LABELS = Object.fromEntries(CHARGE_TYPES.map(t => [t.value, t.label]))

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function ChargesTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageIPDBilling')

  const [charges, setCharges] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [voiding, setVoiding]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/charges?includeVoided=true`)
      setCharges(data.data?.charges || [])
      setSummary(data.data?.summary || null)
    } catch {
      toast.error('Failed to load charges')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const voidCharge = async (charge, reason) => {
    try {
      await api.post(`/ipd/charges/${charge.id}/void`, { reason })
      toast.success('Charge voided')
      setVoiding(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to void')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Charges
            {summary && summary.count > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">
                ({summary.count} items)
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">All non-bed charges (medicines, lab, procedures, etc.)</p>
        </div>
        <div className="flex items-center gap-4">
          {summary && summary.count > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">Total</p>
              <p className="text-base font-bold text-primary leading-tight">
                &#8377;{summary.total.toLocaleString('en-IN')}
              </p>
            </div>
          )}
          {canWrite && (
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={() => { setEditing(null); setShowForm(true) }}>
              Add Charge
            </Button>
          )}
        </div>
      </div>

      {/* Charges list */}
      {charges.length === 0 ? (
        <Card className="p-10 text-center">
          <IndianRupee className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500">No charges added yet</p>
        </Card>
      ) : (
        <Card>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {charges.map(c => (
                  <tr key={c.id} className={c.voidedAt ? 'opacity-50' : ''}>
                    <td className="text-xs">
                      <p>{format(new Date(c.chargedAt), 'd MMM')}</p>
                      <p className="text-slate-400">{format(new Date(c.chargedAt), 'hh:mm a')}</p>
                    </td>
                    <td>
                      <Badge variant="primary">{CHARGE_TYPE_LABELS[c.chargeType] || c.chargeType}</Badge>
                    </td>
                    <td className="text-sm">
                      <p className={c.voidedAt ? 'line-through' : ''}>{c.description}</p>
                      {c.voidedAt && (
                        <p className="text-xs text-warning">Voided: {c.voidReason}</p>
                      )}
                      {c.notes && !c.voidedAt && (
                        <p className="text-xs text-slate-400 italic">{c.notes}</p>
                      )}
                    </td>
                    <td className="text-sm">{c.quantity}</td>
                    <td className="text-sm">₹{c.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="text-sm font-semibold">₹{c.amount.toLocaleString('en-IN')}</td>
                    <td className="text-xs text-slate-500">{c.addedBy?.name}</td>
                    <td className="text-right whitespace-nowrap">
                      {!c.voidedAt && canWrite && (
                        <>
                          <button onClick={() => { setEditing(c); setShowForm(true) }}
                            className="text-xs text-primary hover:underline mr-2">
                            <Pencil className="w-3 h-3 inline"/>
                          </button>
                          <button onClick={() => setVoiding(c)}
                            className="text-xs text-danger hover:underline">
                            <X className="w-3 h-3 inline"/>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showForm && (
        <ChargeFormModal
          admission={admission}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchData() }}/>
      )}

      {voiding && (
        <Modal open onClose={() => setVoiding(null)} title="Void Charge" size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setVoiding(null)}>Cancel</Button>
              <Button variant="danger"
                onClick={(e) => {
                  const reason = e.target.form?.reason?.value || document.getElementById('void-reason')?.value
                  if (!reason?.trim()) return toast.error('Reason is required')
                  voidCharge(voiding, reason.trim())
                }}>
                Void Charge
              </Button>
            </>
          }>
          <p className="text-sm text-slate-700 mb-3">
            Voiding <strong>{voiding.description}</strong> (₹{voiding.amount.toLocaleString('en-IN')})
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Voided charges remain in the audit log but are excluded from billing.
          </p>
          <div className="form-group">
            <label className="form-label">Reason *</label>
            <textarea id="void-reason" className="form-input" rows={2}
              placeholder="Why is this charge being voided?"/>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ChargeFormModal({ admission, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    chargeType:  initial?.chargeType  || 'MEDICINE',
    description: initial?.description || '',
    quantity:    initial?.quantity ?? 1,
    unitPrice:   initial?.unitPrice ?? 0,
    chargedAt:   initial?.chargedAt ? toLocalInput(initial.chargedAt) : toLocalInput(new Date()),
    notes:       initial?.notes       || '',
  })
  const [saving, setSaving] = useState(false)

  // Description autocomplete: pulls per-clinic recently-used descriptions
  // from the backend. Filtered by chargeType when one is picked. Recently
  // used surface first; free-typed values create new entries that show up
  // here next time.
  const [descSuggestions, setDescSuggestions] = useState([])
  const [showDescDrop, setShowDescDrop] = useState(false)
  const descBlurTimerRef = useRef(null)
  useEffect(() => {
    let cancelled = false
    api.get('/ipd/charges/descriptions', { params: { type: form.chargeType }, silent: true })
      .then(({ data }) => { if (!cancelled) setDescSuggestions(data?.data || []) })
      .catch(() => { if (!cancelled) setDescSuggestions([]) })
    return () => { cancelled = true }
  }, [form.chargeType])

  // Filter by what the user has typed so far. Empty input shows the full
  // recents list (sorted newest-first, then most-frequent).
  const filteredDesc = (() => {
    const q = (form.description || '').trim().toLowerCase()
    let list = descSuggestions
    if (q) list = list.filter(s => s.description.toLowerCase().includes(q))
    return list.slice(0, 8)
  })()

  const pickDesc = (s) => {
    setForm(f => ({
      ...f,
      description: s.description,
      // Auto-fill last-used unit price ONLY if user hasn't set one yet.
      // This matches expectations: "I usually charge ₹150 for Augmentin -
      // pre-fill that, but don't override if I just typed something."
      unitPrice: f.unitPrice ? f.unitPrice : (s.unitPrice ?? f.unitPrice),
    }))
    setShowDescDrop(false)
  }

  const amount = (parseFloat(form.unitPrice) || 0) * (parseInt(form.quantity, 10) || 1)

  const submit = async () => {
    if (!form.description.trim()) return toast.error('Description is required')
    if (!form.unitPrice && form.unitPrice !== 0) return toast.error('Unit price is required')
    setSaving(true)
    try {
      const payload = {
        chargeType:  form.chargeType,
        description: form.description.trim(),
        quantity:    parseInt(form.quantity, 10) || 1,
        unitPrice:   parseFloat(form.unitPrice) || 0,
        amount,
        chargedAt:   form.chargedAt,
        notes:       form.notes.trim() || undefined,
      }
      if (isEdit) {
        await api.put(`/ipd/charges/${initial.id}`, payload)
        toast.success('Charge updated')
      } else {
        await api.post(`/ipd/admissions/${admission.id}/charges`, payload)
        toast.success('Charge added')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Charge' : 'Add Charge'} size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Type *</label>
            <select className="form-select" value={form.chargeType}
              onChange={e => setForm(f => ({ ...f, chargeType: e.target.value }))}>
              {CHARGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Charged At</label>
            <input type="datetime-local" className="form-input" value={form.chargedAt}
              onChange={e => setForm(f => ({ ...f, chargedAt: e.target.value }))}/>
          </div>
        </div>
        <div className="form-group relative">
          <label className="form-label">Description *</label>
          <input className="form-input" value={form.description}
            placeholder="e.g. Augmentin 625mg, CBC, Wound dressing"
            onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setShowDescDrop(true) }}
            onFocus={() => setShowDescDrop(true)}
            onBlur={() => {
              if (descBlurTimerRef.current) clearTimeout(descBlurTimerRef.current)
              descBlurTimerRef.current = setTimeout(() => setShowDescDrop(false), 150)
            }}/>
          {/* Autocomplete dropdown of recently-used descriptions for this
              charge type. Tap to pick — fills description and pre-fills the
              last-used unit price (only if no price typed yet). */}
          {showDescDrop && filteredDesc.length > 0 && (
            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow max-h-48 overflow-y-auto"
              onMouseDown={() => { if (descBlurTimerRef.current) clearTimeout(descBlurTimerRef.current) }}>
              {filteredDesc.map((s, idx) => (
                <li key={`${s.description}-${idx}`}>
                  <button type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs flex items-center justify-between gap-2"
                    onMouseDown={(e) => { e.preventDefault(); pickDesc(s) }}>
                    <span className="font-medium text-slate-800 truncate">{s.description}</span>
                    <span className="text-slate-400 text-[10px] flex-shrink-0">
                      ₹{s.unitPrice}
                      {s.useCount > 1 && ` · used ${s.useCount}x`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filteredDesc.length === 0 && descSuggestions.length === 0 && (
            <p className="text-[10px] text-slate-400 mt-1">
              Free-typed descriptions are remembered and shown next time.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input type="number" min="1" className="form-input"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price (₹) *</label>
            <input type="number" min="0" step="0.01" className="form-input"
              value={form.unitPrice}
              onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Total</label>
            <input className="form-input bg-slate-50 font-semibold"
              value={`₹${amount.toLocaleString('en-IN')}`}
              readOnly/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
        </div>
      </div>
    </Modal>
  )
}
