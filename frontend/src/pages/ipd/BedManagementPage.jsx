// Bed Management Page - clinic-side admin tool for full bed CRUD.
// Permission gates:
//   - Page access:        manageBeds (admin/doctor/receptionist by default)
//   - Create / edit / deactivate: manageBeds
//   - Edit daily rate:    manageIPDBilling - separate inline gate, since rate is billing config
//
// Layout: header + summary tiles + filter + sortable table with inline rate editor.
// Edit/Add uses a modal. Bulk Add available too. Distinct from Bed Board which is
// the visual occupancy view.

import { useEffect, useState } from 'react'
import {
  BedDouble, Plus, Pencil, Trash2, Save, X, Check,
  Search, IndianRupee, AlertCircle,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'
import toast from 'react-hot-toast'

const BED_TYPES = [
  { value: 'GENERAL',      label: 'General' },
  { value: 'SEMI_PRIVATE', label: 'Semi-Private' },
  { value: 'PRIVATE',      label: 'Private' },
  { value: 'ICU',          label: 'ICU' },
  { value: 'HDU',          label: 'HDU' },
  { value: 'LABOUR',       label: 'Labour Room' },
  { value: 'DAY_CARE',     label: 'Day-Care' },
  { value: 'ISOLATION',    label: 'Isolation' },
  { value: 'OTHER',        label: 'Other' },
]

const STATUS_VARIANTS = {
  VACANT: 'success', OCCUPIED: 'danger', CLEANING: 'warning', BLOCKED: 'gray', RESERVED: 'accent',
}

export default function BedManagementPage() {
  const { user } = useAuthStore()
  const canEditRate = can(user, 'manageIPDBilling')
  const canManage   = can(user, 'manageBeds')

  const [beds, setBeds]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterActive, setFilterActive] = useState('active')  // active | all | inactive

  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [editingBed, setEditingBed]   = useState(null)
  const [editingRateBedId, setEditingRateBedId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterActive === 'all' || filterActive === 'inactive') params.set('includeInactive', 'true')
      const { data } = await api.get(`/ipd/beds?${params}`)
      let list = data.data || []
      if (filterActive === 'inactive') list = list.filter(b => !b.isActive)
      setBeds(list)
    } catch (err) {
      if (!err?.response?.data?.errors?.ipdDisabled) {
        toast.error('Failed to load beds')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filterActive])

  const saveBed = async (bedData, bedId) => {
    try {
      if (bedId) {
        await api.put(`/ipd/beds/${bedId}`, bedData)
        toast.success('Bed updated')
      } else {
        await api.post('/ipd/beds', bedData)
        toast.success('Bed created')
      }
      setEditingBed(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save bed')
    }
  }

  const deleteBed = async (bedId) => {
    try {
      await api.delete(`/ipd/beds/${bedId}`)
      toast.success('Bed deactivated')
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  const saveRate = async (bedId, dailyRate) => {
    try {
      await api.patch(`/ipd/beds/${bedId}/rate`, { dailyRate })
      toast.success('Rate updated')
      setEditingRateBedId(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update rate')
    }
  }

  // Filtering - client side because list is small
  const filteredBeds = beds.filter(bed => {
    if (filterType !== 'all' && bed.bedType !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      const matches = bed.bedNumber.toLowerCase().includes(q) ||
                      (bed.ward || '').toLowerCase().includes(q) ||
                      (bed.floor || '').toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  // Summary tiles
  const activeBeds = beds.filter(b => b.isActive)
  const summary = {
    total:    beds.length,
    active:   activeBeds.length,
    rateless: activeBeds.filter(b => !b.dailyRate || b.dailyRate === 0).length,
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }

  if (!canManage) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Permission required</h3>
        <p className="text-sm text-slate-500">You don't have permission to manage beds.</p>
      </Card>
    )
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="page-title">Bed Management</h1>
          <p className="page-subtitle">
            Manage your clinic's bed inventory{canEditRate ? ' and daily rates' : ''}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setShowBulkAdd(true)}>
            Bulk Add
          </Button>
          <Button variant="primary" size="sm"
            icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setEditingBed('new')}>
            Add Bed
          </Button>
        </div>
      </div>

      {/* Single-row filter strip: search + type + active + warning pill.
          Total/active stats removed (the active filter dropdown does
          essentially the same job, and the count is visible from the
          table anyway). The "rate not set" warning IS preserved as a
          small pill on the right -- it's a useful nag for admins to
          finish bed setup.
          NOTE: form-select has w-full baked in via @apply, so we override
          with explicit w-* classes to keep the dropdowns inline rather
          than each wrapping to its own row. */}
      <Card className="mb-4 p-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input className="form-input pl-9 w-full" placeholder="Search bed number, ward, floor..."
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="form-select !w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {BED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="form-select !w-36" value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <option value="active">Active Only</option>
            <option value="all">All</option>
            <option value="inactive">Inactive Only</option>
          </select>
          {summary.rateless > 0 && (
            <span className="inline-flex items-center gap-1 bg-orange-50 text-warning text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
              title="These beds need a daily rate before they can be billed">
              <AlertCircle className="w-3 h-3"/>
              {summary.rateless} rate not set
            </span>
          )}
        </div>
      </Card>

      {/* Bed table */}
      {beds.length === 0 ? (
        <Card className="p-12 text-center">
          <BedDouble className="w-14 h-14 text-slate-300 mx-auto mb-4"/>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No beds yet</h3>
          <p className="text-sm text-slate-500 mb-4">Use Bulk Add to set up your bed inventory quickly.</p>
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setShowBulkAdd(true)}>
            Bulk Add Beds
          </Button>
        </Card>
      ) : filteredBeds.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">No beds match the current filters.</p>
        </Card>
      ) : (
        <Card>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Bed</th>
                  <th>Type</th>
                  <th>Ward</th>
                  <th>Floor</th>
                  <th>Daily Rate (₹)</th>
                  <th>Status</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredBeds.map(bed => (
                  <tr key={bed.id}>
                    <td className="font-semibold text-slate-800 text-sm">{bed.bedNumber}</td>
                    <td>{BED_TYPES.find(t => t.value === bed.bedType)?.label || bed.bedType}</td>
                    <td className="text-slate-600">{bed.ward || '-'}</td>
                    <td className="text-slate-600">{bed.floor || '-'}</td>
                    <td>
                      <RateCell
                        bed={bed}
                        canEdit={canEditRate}
                        editing={editingRateBedId === bed.id}
                        onStartEdit={() => setEditingRateBedId(bed.id)}
                        onCancel={() => setEditingRateBedId(null)}
                        onSave={(rate) => saveRate(bed.id, rate)}
                      />
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANTS[bed.status]}>{bed.status}</Badge>
                    </td>
                    <td>
                      <Badge variant={bed.isActive ? 'success' : 'gray'}>
                        {bed.isActive ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <button onClick={() => setEditingBed(bed)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3"/> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editingBed && (
        <BedFormModal
          bed={editingBed === 'new' ? null : editingBed}
          onClose={() => setEditingBed(null)}
          onSave={saveBed}
          onDelete={deleteBed}
        />
      )}

      {showBulkAdd && (
        <BulkAddBedsModal
          onClose={() => setShowBulkAdd(false)}
          onCreated={() => { setShowBulkAdd(false); fetchData() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Inline rate editor - read-only badge → click to edit (if permitted)
// ─────────────────────────────────────────────────────────
function RateCell({ bed, canEdit, editing, onStartEdit, onCancel, onSave }) {
  const [value, setValue] = useState(bed.dailyRate || 0)
  useEffect(() => { setValue(bed.dailyRate || 0) }, [bed.dailyRate, editing])

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input type="number" min="0" className="form-input py-1 px-2 text-sm w-24"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(value)
            if (e.key === 'Escape') onCancel()
          }}/>
        <button onClick={() => onSave(value)} className="p-1 rounded hover:bg-green-50 text-success" title="Save">
          <Check className="w-4 h-4"/>
        </button>
        <button onClick={onCancel} className="p-1 rounded hover:bg-red-50 text-danger" title="Cancel">
          <X className="w-4 h-4"/>
        </button>
      </div>
    )
  }

  const rate = bed.dailyRate || 0
  const display = rate === 0
    ? <span className="text-warning italic">Not set</span>
    : <span className="font-semibold text-slate-700">₹{rate.toLocaleString('en-IN')}</span>

  if (!canEdit) {
    return <span>{display}</span>
  }

  return (
    <button onClick={onStartEdit}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors group">
      {display}
      <Pencil className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors"/>
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Bed form modal - Add or Edit (no rate field - that's inline)
// ─────────────────────────────────────────────────────────
function BedFormModal({ bed, onClose, onSave, onDelete }) {
  const isNew = !bed
  const [form, setForm] = useState({
    bedNumber: bed?.bedNumber || '',
    bedType:   bed?.bedType   || 'GENERAL',
    ward:      bed?.ward      || '',
    floor:     bed?.floor     || '',
    notes:     bed?.notes     || '',
    status:    bed?.status    || 'VACANT',
    isActive:  bed?.isActive ?? true,
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.bedNumber.trim()) return toast.error('Bed number is required')
    setSaving(true)
    try {
      await onSave(form, bed?.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add Bed' : `Edit Bed ${bed.bedNumber}`} size="md"
      footer={
        <div className="flex justify-between w-full">
          {!isNew && (
            <Button variant="ghost" size="sm" className="text-danger"
              icon={<Trash2 className="w-3.5 h-3.5"/>}
              onClick={() => setConfirmDelete(true)}>
              Deactivate
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
              Save
            </Button>
          </div>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="form-label">Bed Number *</label>
          <input className="form-input" value={form.bedNumber}
            onChange={e => setForm(f => ({ ...f, bedNumber: e.target.value }))}
            placeholder="B-001"/>
        </div>
        <div className="form-group">
          <label className="form-label">Bed Type *</label>
          <select className="form-select" value={form.bedType}
            onChange={e => setForm(f => ({ ...f, bedType: e.target.value }))}>
            {BED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Ward</label>
          <input className="form-input" value={form.ward}
            onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
            placeholder="General Ward"/>
        </div>
        <div className="form-group">
          <label className="form-label">Floor</label>
          <input className="form-input" value={form.floor}
            onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
            placeholder="Ground"/>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="VACANT">Vacant</option>
            <option value="CLEANING">Cleaning</option>
            <option value="BLOCKED">Blocked</option>
            <option value="RESERVED">Reserved</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Active</label>
          <select className="form-select" value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <div className="form-group col-span-2">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Window bed, near nursing station, etc."/>
        </div>
      </div>

      {!isNew && (
        <p className="text-xs text-slate-400 mt-3 italic">
          Daily rate is edited inline from the bed list (with billing permission).
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Deactivate this bed?"
        message="The bed will be hidden from the bed board and admission flow. Historical admission records remain intact."
        variant="warning"
        confirmLabel="Yes, Deactivate"
        cancelLabel="Cancel"
        onConfirm={() => { setConfirmDelete(false); onDelete(bed.id); onClose() }}
        onClose={() => setConfirmDelete(false)}
      />
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────
// Bulk add modal - clinic admin (no rate)
// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
// Bulk Add Beds modal -- auto-suggests prefix and start number based on
// (bedType, ward, floor). When any of those change the modal calls a
// suggestion endpoint that builds an auto-prefix (e.g. "GA1-") and tells
// us the next sequence number for that prefix.
//
// User can override prefix or startNumber manually -- once they touch
// either field, we stop auto-updating it (a userEdited flag tracks this).
function BulkAddBedsModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    bedType:     'GENERAL',
    ward:        '',
    floor:       '',
    prefix:      '',          // auto-filled on mount
    startNumber: 1,
    count:       10,
    padDigits:   3,
  })
  // Track whether user has manually edited prefix/startNumber.
  // Once true, stop auto-updating that field on (type/ward/floor) change.
  const [userEdited, setUserEdited] = useState({ prefix: false, startNumber: false })

  const [hint, setHint] = useState(null)  // { existingCount, existingMax }
  const [creating, setCreating] = useState(false)

  // Fetch suggested prefix + next number whenever the (type/ward/floor)
  // context changes. Skips auto-update for fields the user has manually edited.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          bedType: form.bedType,
          ward:    form.ward || '',
          floor:   form.floor || '',
        })
        const { data } = await api.get(`/ipd/beds/suggest-next?${params}`)
        if (cancelled) return
        const { prefix, nextNumber, existingCount, existingMax } = data.data
        setHint({ existingCount, existingMax, suggestedPrefix: prefix })
        setForm(f => ({
          ...f,
          prefix:      userEdited.prefix      ? f.prefix      : prefix,
          startNumber: userEdited.startNumber ? f.startNumber : nextNumber,
        }))
      } catch {
        // Silent: hint stays null, user can still type manually
      }
    }, 250)  // debounce ward/floor typing
    return () => { cancelled = true; clearTimeout(t) }
  }, [form.bedType, form.ward, form.floor, userEdited.prefix, userEdited.startNumber])

  const pad = (n) => String(n).padStart(form.padDigits, '0')
  const previewFirst = `${form.prefix}${pad(form.startNumber)}`
  const previewLast  = `${form.prefix}${pad(form.startNumber + form.count - 1)}`

  const submit = async () => {
    if (!form.count || form.count < 1) return toast.error('Count must be at least 1')
    if (!form.prefix) return toast.error('Prefix cannot be empty')
    setCreating(true)
    try {
      await api.post('/ipd/beds/bulk', form)
      toast.success(`${form.count} beds created`)
      onCreated()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create beds')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Bulk Add Beds" size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={creating}
            icon={<Plus className="w-4 h-4"/>} onClick={submit}>
            Create {form.count} bed{form.count !== 1 ? 's' : ''}
          </Button>
        </>
      }>
      <div className="grid grid-cols-2 gap-3">
        <div className="form-group">
          <label className="form-label">Bed Type *</label>
          <select className="form-select" value={form.bedType}
            onChange={e => setForm(f => ({ ...f, bedType: e.target.value }))}>
            {BED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Ward Name</label>
          <input className="form-input" value={form.ward}
            onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
            placeholder="A / General / etc."/>
        </div>
        <div className="form-group">
          <label className="form-label">Floor</label>
          <input className="form-input" value={form.floor}
            onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
            placeholder="1, 2, G..."/>
        </div>
        <div className="form-group">
          <label className="form-label">
            Bed Prefix
            {!userEdited.prefix && <span className="text-[10px] text-primary ml-1 font-normal">(auto)</span>}
          </label>
          <input className="form-input" value={form.prefix}
            onChange={e => {
              setUserEdited(u => ({ ...u, prefix: true }))
              setForm(f => ({ ...f, prefix: e.target.value }))
            }}
            placeholder="GA1-"/>
        </div>
        <div className="form-group">
          <label className="form-label">
            Start Number *
            {!userEdited.startNumber && <span className="text-[10px] text-primary ml-1 font-normal">(auto)</span>}
          </label>
          <input className="form-input" type="number" min="1" value={form.startNumber}
            onChange={e => {
              setUserEdited(u => ({ ...u, startNumber: true }))
              setForm(f => ({ ...f, startNumber: parseInt(e.target.value || 0, 10) }))
            }}/>
        </div>
        <div className="form-group">
          <label className="form-label">Count *</label>
          <input className="form-input" type="number" min="1" max="100" value={form.count}
            onChange={e => setForm(f => ({ ...f, count: parseInt(e.target.value || 0, 10) }))}/>
        </div>
        <div className="form-group col-span-2">
          <label className="form-label">Number Padding</label>
          <select className="form-select" value={form.padDigits}
            onChange={e => setForm(f => ({ ...f, padDigits: parseInt(e.target.value, 10) }))}>
            <option value={2}>2 digits (01)</option>
            <option value={3}>3 digits (001)</option>
            <option value={4}>4 digits (0001)</option>
          </select>
        </div>
      </div>

      {/* Auto-suggestion hint */}
      {hint && (
        <p className="text-xs text-slate-500 mt-2 px-1">
          {hint.existingCount > 0 ? (
            <>
              Existing beds with prefix <span className="font-mono font-semibold text-slate-700">{hint.suggestedPrefix}</span>: {hint.existingCount}
              {hint.existingMax > 0 && <> (highest is <span className="font-mono">{hint.suggestedPrefix}{pad(hint.existingMax)}</span>)</>}.
              Continuing from {hint.existingMax + 1}.
            </>
          ) : (
            <>No existing beds with prefix <span className="font-mono font-semibold text-slate-700">{hint.suggestedPrefix}</span>. Starting fresh.</>
          )}
          {(userEdited.prefix || userEdited.startNumber) && (
            <button type="button"
              onClick={() => {
                setUserEdited({ prefix: false, startNumber: false })
              }}
              className="text-primary hover:underline ml-2">
              Reset to auto
            </button>
          )}
        </p>
      )}

      <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Preview</p>
        <p className="text-sm text-slate-700">
          Will create <strong>{form.count} beds</strong>:
          {' '}<span className="font-mono font-semibold">{previewFirst}</span>
          {form.count > 1 && <> {' '}&hellip;{' '} <span className="font-mono font-semibold">{previewLast}</span></>}
        </p>
        {form.ward && <p className="text-xs text-slate-500 mt-1">All in ward: <strong>{form.ward}</strong>{form.floor && <>, floor <strong>{form.floor}</strong></>}</p>}
        <p className="text-xs text-slate-500 mt-1 italic">
          Daily rate defaults to &#8377;0. Set it inline from the bed list afterward.
        </p>
      </div>
    </Modal>
  )
}
