// IPD Configuration tab — embedded in the Super Admin's ClinicManageModal.
// Handles: enable/disable IPD per clinic, set facility type, set up bed inventory.
//
// Note: Super Admin only sets up bed STRUCTURE (number, type, ward, floor).
// Daily RATE is set later by clinic admin from the Bed Management page on
// the clinic side. This separates platform setup from billing config.

import { useEffect, useState } from 'react'
import {
  Power, BedDouble, Plus, Pencil, Trash2,
  AlertTriangle, Building2, Save,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const FACILITY_OPTIONS = [
  { value: 'CLINIC_ONLY',  label: 'Clinic Only',  hint: 'OPD only — no IPD' },
  { value: 'NURSING_HOME', label: 'Nursing Home', hint: 'Small inpatient setup' },
  { value: 'HOSPITAL',     label: 'Hospital',     hint: 'Larger inpatient setup' },
]

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

export default function ClinicIPDTab({ clinicId, onChanged }) {
  const [config, setConfig]   = useState(null)
  const [stats, setStats]     = useState(null)
  const [beds, setBeds]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [form, setForm] = useState({
    facilityType: 'CLINIC_ONLY',
    ipdEnabled:   false,
    ipdSettings:  {},
  })
  const [dirty, setDirty] = useState(false)

  const [showBulkAdd, setShowBulkAdd]     = useState(false)
  const [editingBed, setEditingBed]       = useState(null)
  const [confirmToggleOff, setConfirmToggleOff] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [{ data: cfg }, { data: bedsRes }] = await Promise.all([
        api.get(`/super/clinics/${clinicId}/ipd-config`),
        api.get(`/super/clinics/${clinicId}/beds`),
      ])
      setConfig(cfg.data.clinic)
      setStats(cfg.data.stats)
      setBeds(bedsRes.data || [])
      setForm({
        facilityType: cfg.data.clinic.facilityType || 'CLINIC_ONLY',
        ipdEnabled:   !!cfg.data.clinic.ipdEnabled,
        ipdSettings:  cfg.data.clinic.ipdSettings || {},
      })
      setDirty(false)
    } catch {
      toast.error('Failed to load IPD configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [clinicId])

  const saveConfig = async () => {
    if (!form.ipdEnabled && config?.ipdEnabled) {
      setConfirmToggleOff(true)
      return
    }
    await doSaveConfig()
  }

  const doSaveConfig = async () => {
    setConfirmToggleOff(false)
    setSaving(true)
    try {
      await api.put(`/super/clinics/${clinicId}/ipd-config`, form)
      toast.success('IPD configuration saved')
      onChanged?.()
      await loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const saveBed = async (bedData, bedId) => {
    try {
      if (bedId) {
        await api.put(`/super/clinics/${clinicId}/beds/${bedId}`, bedData)
        toast.success('Bed updated')
      } else {
        await api.post(`/super/clinics/${clinicId}/beds`, bedData)
        toast.success('Bed created')
      }
      setEditingBed(null)
      await loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save bed')
    }
  }

  const deleteBed = async (bedId) => {
    try {
      await api.delete(`/super/clinics/${clinicId}/beds/${bedId}`)
      toast.success('Bed deactivated')
      await loadAll()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
  }

  return (
    <div className="space-y-5">
      {/* Status panel */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Power className="w-4 h-4 text-primary"/> Status
        </h3>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">IPD Module</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When enabled, this clinic can use bed management, admissions, and inpatient billing.
              </p>
            </div>
            <button
              onClick={() => { setForm(f => ({ ...f, ipdEnabled: !f.ipdEnabled })); setDirty(true) }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0
                ${form.ipdEnabled ? 'bg-primary' : 'bg-slate-300'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                ${form.ipdEnabled ? 'translate-x-6' : 'translate-x-1'}`}/>
            </button>
          </div>

          <div>
            <label className="form-label">Facility Type</label>
            <select className="form-select"
              value={form.facilityType}
              onChange={e => { setForm(f => ({ ...f, facilityType: e.target.value })); setDirty(true) }}>
              {FACILITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
              ))}
            </select>
          </div>
        </div>

        {dirty && (
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" loading={saving}
              icon={<Save className="w-4 h-4"/>} onClick={saveConfig}>
              Save Configuration
            </Button>
          </div>
        )}
      </Card>

      {/* Stats */}
      {stats && (
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary"/> Statistics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-primary">{stats.bedCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 uppercase">Total Beds</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-success">{stats.activeBedCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 uppercase">Active</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-danger">{stats.occupiedBedCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 uppercase">Occupied</p>
            </div>
            <div className="bg-cyan-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-accent">{stats.admissionCount}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 uppercase">Admissions</p>
            </div>
          </div>
          {stats.lastAdmission && (
            <p className="text-xs text-slate-500 mt-3">
              Last admission: <span className="font-semibold text-slate-700">{stats.lastAdmission.admissionNumber}</span>
              {' '}— {format(new Date(stats.lastAdmission.admittedAt), 'd MMM yyyy, hh:mm a')}
            </p>
          )}
        </Card>
      )}

      {/* Bed Inventory */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary"/> Bed Inventory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set up bed structure here. Daily rates are configured by the clinic admin from their Bed Management page.
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

        {beds.length === 0 ? (
          <div className="text-center py-8">
            <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
            <p className="text-sm text-slate-500 mb-1">No beds configured yet</p>
            <p className="text-xs text-slate-400">Use Bulk Add to set up multiple beds at once</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Bed</th><th>Type</th><th>Ward</th>
                  <th>Floor</th><th>Status</th><th>Active</th><th></th>
                </tr>
              </thead>
              <tbody>
                {beds.map(bed => (
                  <tr key={bed.id}>
                    <td className="font-semibold text-slate-800 text-sm">{bed.bedNumber}</td>
                    <td>{BED_TYPES.find(t => t.value === bed.bedType)?.label || bed.bedType}</td>
                    <td className="text-slate-600">{bed.ward || '—'}</td>
                    <td className="text-slate-600">{bed.floor || '—'}</td>
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
        )}
      </Card>

      {!form.ipdEnabled && stats?.bedCount > 0 && (
        <Card className="border-2 border-orange-100 bg-orange-50/30">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold text-slate-800 text-sm">IPD module disabled</p>
              <p className="text-xs text-slate-600 mt-1">
                Bed management, admissions, and inpatient features are hidden from this clinic.
                Existing data is preserved — re-enabling restores access.
              </p>
            </div>
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
          clinicId={clinicId}
          onClose={() => setShowBulkAdd(false)}
          onCreated={() => { setShowBulkAdd(false); loadAll() }}
        />
      )}

      <ConfirmDialog
        open={confirmToggleOff}
        title="Disable IPD module?"
        message="This will hide IPD features from all users in this clinic and block new admissions. Existing data is preserved. Are you sure?"
        variant="warning"
        confirmLabel="Yes, Disable"
        cancelLabel="Cancel"
        onConfirm={doSaveConfig}
        onClose={() => setConfirmToggleOff(false)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bed form modal — used for both single Add and Edit (no rate field)
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

      <p className="text-xs text-slate-400 mt-3 italic">
        Daily rate is set by the clinic admin from their Bed Management page.
      </p>

      <ConfirmDialog
        open={confirmDelete}
        title="Deactivate this bed?"
        message="The bed will be hidden from the bed board and admission flow. Historical admission records remain intact. You can reactivate from Edit later."
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
// Bulk add beds modal — Super Admin setup tool (no rate)
// ─────────────────────────────────────────────────────────
function BulkAddBedsModal({ clinicId, onClose, onCreated }) {
  const [form, setForm] = useState({
    bedType:     'GENERAL',
    ward:        '',
    floor:       '',
    prefix:      'B-',
    startNumber: 1,
    count:       10,
    padDigits:   3,
  })
  const [creating, setCreating] = useState(false)

  const pad = (n) => String(n).padStart(form.padDigits, '0')
  const previewFirst = `${form.prefix}${pad(form.startNumber)}`
  const previewLast  = `${form.prefix}${pad(form.startNumber + form.count - 1)}`

  const submit = async () => {
    if (!form.count || form.count < 1) return toast.error('Count must be at least 1')
    setCreating(true)
    try {
      await api.post(`/super/clinics/${clinicId}/beds/bulk`, form)
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
            placeholder="General Ward"/>
        </div>
        <div className="form-group">
          <label className="form-label">Floor</label>
          <input className="form-input" value={form.floor}
            onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}/>
        </div>
        <div className="form-group">
          <label className="form-label">Bed Prefix</label>
          <input className="form-input" value={form.prefix}
            onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
            placeholder="B-"/>
        </div>
        <div className="form-group">
          <label className="form-label">Start Number *</label>
          <input className="form-input" type="number" min="0" value={form.startNumber}
            onChange={e => setForm(f => ({ ...f, startNumber: parseInt(e.target.value || 0, 10) }))}/>
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

      <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Preview</p>
        <p className="text-sm text-slate-700">
          Will create <strong>{form.count} beds</strong>:
          {' '}<span className="font-mono font-semibold">{previewFirst}</span>
          {form.count > 1 && <> {' '}…{' '} <span className="font-mono font-semibold">{previewLast}</span></>}
        </p>
        {form.ward && <p className="text-xs text-slate-500 mt-1">All in ward: <strong>{form.ward}</strong></p>}
        <p className="text-xs text-slate-500 mt-1 italic">
          Daily rate will default to ₹0 — clinic admin can update from their Bed Management page.
        </p>
      </div>
    </Modal>
  )
}
