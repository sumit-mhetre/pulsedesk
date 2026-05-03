// Consents tab - track admission, surgery, anesthesia, and other consents.
// Pre-loaded standard text templates per consent type (English).
// User can edit before saving. Optional scan URL for uploaded paper consent.

import { useEffect, useState } from 'react'
import {
  Plus, FileSignature, Save, Pencil, Trash2, Check, User, Calendar,
  ExternalLink,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CONSENT_TYPES = [
  { value: 'ADMISSION',         label: 'Admission Consent',        accent: 'primary' },
  { value: 'SURGERY',           label: 'Surgery Consent',          accent: 'danger'  },
  { value: 'ANESTHESIA',        label: 'Anesthesia Consent',       accent: 'warning' },
  { value: 'BLOOD_TRANSFUSION', label: 'Blood Transfusion',        accent: 'danger'  },
  { value: 'HIGH_RISK',         label: 'High-Risk Consent',        accent: 'danger'  },
  { value: 'HIV_TEST',          label: 'HIV Test Consent',         accent: 'accent'  },
  { value: 'PHOTOGRAPHY',       label: 'Clinical Photography',     accent: 'accent'  },
  { value: 'OTHER',             label: 'Other',                    accent: 'gray'    },
]
const TYPE_BY_VALUE = Object.fromEntries(CONSENT_TYPES.map(t => [t.value, t]))

function dateInput(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

export default function ConsentsTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageConsents')

  const [consents, setConsents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [deleting, setDeleting] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/consents`)
      setConsents(data.data || [])
    } catch {
      toast.error('Failed to load consents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const removeConsent = async (consent) => {
    try {
      await api.delete(`/ipd/consents/${consent.id}`)
      toast.success('Consent deleted')
      setDeleting(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Consents
            {consents.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({consents.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Patient acknowledgements and signed forms</p>
        </div>
        {canWrite && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => { setEditing(null); setShowForm(true) }}>
            Add Consent
          </Button>
        )}
      </div>

      {consents.length === 0 ? (
        <Card className="p-10 text-center">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No consents recorded yet</p>
          {canWrite && (
            <p className="text-xs text-slate-400">Click "Add Consent" to start with admission consent.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {consents.map(c => {
            const typeInfo = TYPE_BY_VALUE[c.consentType] || TYPE_BY_VALUE.OTHER
            // Border color: green = signed by patient, amber = pending
            const borderClass = c.signedByPatient
              ? 'border-l-success'
              : 'border-l-warning'

            return (
              <div key={c.id}
                className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 text-sm">{typeInfo.label}</p>
                  <span className="flex-1 min-w-0"/>
                  {c.signedByPatient && <Badge variant="success">Patient signed</Badge>}
                  {c.signedByWitness && <Badge variant="accent">Witness signed</Badge>}
                  {!c.signedByPatient && !c.signedByWitness && <Badge variant="gray">Pending</Badge>}
                  {canWrite && (
                    <>
                      <button onClick={() => { setEditing(c); setShowForm(true) }}
                        className="text-xs text-primary hover:underline whitespace-nowrap">
                        <Pencil className="w-3 h-3 inline mr-0.5"/>Edit
                      </button>
                      <button onClick={() => setDeleting(c)}
                        className="text-xs text-danger hover:underline whitespace-nowrap">
                        <Trash2 className="w-3 h-3 inline mr-0.5"/>Delete
                      </button>
                    </>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  {c.signedByPatient && c.patientSignDate && (
                    <span>Patient: {format(new Date(c.patientSignDate), 'd MMM, hh:mm a')}</span>
                  )}
                  {c.signedByWitness && c.witnessName && (
                    <>
                      {c.signedByPatient && <span className="text-slate-300">·</span>}
                      <span>Witness: {c.witnessName}{c.witnessSignDate && ` (${format(new Date(c.witnessSignDate), 'd MMM')})`}</span>
                    </>
                  )}
                  {c.documentUrl && (
                    <>
                      <span className="text-slate-300">·</span>
                      <a href={c.documentUrl} target="_blank" rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5">
                        <ExternalLink className="w-3 h-3"/>View document
                      </a>
                    </>
                  )}
                </div>
                {c.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">
                    <span className="text-slate-400">note:</span> {c.notes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ConsentFormModal
          admission={admission}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchData() }}/>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting ? TYPE_BY_VALUE[deleting.consentType]?.label : ''}?`}
        message="This consent record will be permanently removed."
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => removeConsent(deleting)}
        onClose={() => setDeleting(null)}/>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ConsentFormModal({ admission, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    consentType:     initial?.consentType     || 'ADMISSION',
    consentText:     initial?.consentText     || '',
    signedByPatient: initial?.signedByPatient || false,
    patientSignDate: dateInput(initial?.patientSignDate) || dateInput(new Date()),
    signedByWitness: initial?.signedByWitness || false,
    witnessName:     initial?.witnessName     || '',
    witnessSignDate: dateInput(initial?.witnessSignDate),
    documentUrl:     initial?.documentUrl     || '',
    notes:           initial?.notes           || '',
  })
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load template text for the chosen type if no text yet
  const loadTemplate = async (type) => {
    setLoadingTemplate(true)
    try {
      const { data } = await api.get(`/ipd/consents/template?type=${type}`)
      setForm(f => ({ ...f, consentText: data.data.template || '' }))
    } catch {
      // silent
    } finally {
      setLoadingTemplate(false)
    }
  }

  // Auto-load template if type changes and there's no custom text
  useEffect(() => {
    if (!isEdit && form.consentType) loadTemplate(form.consentType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.consentType])

  const submit = async () => {
    setSaving(true)
    try {
      const payload = {
        consentType:     form.consentType,
        consentText:     form.consentText.trim() || undefined,
        signedByPatient: form.signedByPatient,
        patientSignDate: form.signedByPatient ? form.patientSignDate : undefined,
        signedByWitness: form.signedByWitness,
        witnessName:     form.signedByWitness ? form.witnessName.trim() : undefined,
        witnessSignDate: form.signedByWitness ? form.witnessSignDate : undefined,
        documentUrl:     form.documentUrl.trim() || undefined,
        notes:           form.notes.trim() || undefined,
      }
      if (isEdit) {
        await api.put(`/ipd/consents/${initial.id}`, payload)
        toast.success('Consent updated')
      } else {
        await api.post(`/ipd/admissions/${admission.id}/consents`, payload)
        toast.success('Consent recorded')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Consent' : 'Add Consent'} size="lg"
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
          <label className="form-label">Consent Type *</label>
          <select className="form-select" value={form.consentType}
            disabled={isEdit}
            onChange={e => setForm(f => ({ ...f, consentType: e.target.value }))}>
            {CONSENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <div className="flex items-center justify-between mb-1">
            <label className="form-label !mb-0">Consent Text</label>
            {!loadingTemplate && (
              <button type="button"
                onClick={() => loadTemplate(form.consentType)}
                className="text-xs text-primary hover:underline">
                Reload template
              </button>
            )}
            {loadingTemplate && <span className="text-xs text-slate-400">Loading…</span>}
          </div>
          <textarea className="form-input text-xs leading-relaxed"
            rows={6}
            value={form.consentText}
            onChange={e => setForm(f => ({ ...f, consentText: e.target.value }))}
            placeholder="Standard consent text loads automatically. Edit as needed."/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-200 rounded-xl p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={form.signedByPatient}
                onChange={e => setForm(f => ({ ...f, signedByPatient: e.target.checked }))}/>
              <span className="text-sm font-semibold">Patient signed</span>
            </label>
            {form.signedByPatient && (
              <div className="mt-2">
                <label className="form-label text-xs">Sign date & time</label>
                <input type="datetime-local" className="form-input text-sm"
                  value={form.patientSignDate}
                  onChange={e => setForm(f => ({ ...f, patientSignDate: e.target.value }))}/>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={form.signedByWitness}
                onChange={e => setForm(f => ({ ...f, signedByWitness: e.target.checked }))}/>
              <span className="text-sm font-semibold">Witness signed</span>
            </label>
            {form.signedByWitness && (
              <div className="space-y-2 mt-2">
                <input className="form-input text-sm" placeholder="Witness name"
                  value={form.witnessName}
                  onChange={e => setForm(f => ({ ...f, witnessName: e.target.value }))}/>
                <input type="datetime-local" className="form-input text-sm"
                  value={form.witnessSignDate}
                  onChange={e => setForm(f => ({ ...f, witnessSignDate: e.target.value }))}/>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Signed Document URL (optional)</label>
          <input className="form-input" value={form.documentUrl}
            placeholder="https://drive.google.com/... or upload elsewhere and paste link"
            onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))}/>
          <p className="text-xs text-slate-400 mt-1">Upload signed scan to your file storage and paste the public link here.</p>
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
