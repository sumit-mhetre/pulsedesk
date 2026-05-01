// Admission detail page -- header + summary tiles + 13 tabs in a VERTICAL sidebar.
//
// Step 9 addition: Transfer Bed button next to Discharge in header,
// shows BedTransferModal for moving the patient to another bed mid-stay.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, LogOut, AlertTriangle, ClipboardEdit, Activity, Heart,
  Droplet, FileText, Pill, IndianRupee, ListChecks, ClipboardList,
  FileSignature, MessageSquare, FileCheck, ArrowRightLeft, FlaskConical,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'
import toast from 'react-hot-toast'

import OverviewTab          from './tabs/OverviewTab'
import RoundNotesTab        from './tabs/RoundNotesTab'
import VitalsTab            from './tabs/VitalsTab'
import NursingNotesTab      from './tabs/NursingNotesTab'
import IntakeOutputTab      from './tabs/IntakeOutputTab'
import MedicationsTab       from './tabs/MedicationsTab'
import MARTab               from './tabs/MARTab'
import IPDOrdersTab         from './tabs/IPDOrdersTab'
import LabResultsTab        from './tabs/LabResultsTab'
import ChargesTab           from './tabs/ChargesTab'
import BillingTab           from './tabs/BillingTab'
import ConsentsTab          from './tabs/ConsentsTab'
import ConsultationsTab     from './tabs/ConsultationsTab'
import DischargeSummaryTab  from './tabs/DischargeSummaryTab'
import BedTransferModal     from './BedTransferModal'

const STATUS_VARIANTS = {
  ADMITTED: 'success', DISCHARGED: 'primary', DAMA: 'warning',
  DEATH: 'gray', TRANSFERRED_OUT: 'accent', CANCELLED: 'gray',
}
const STATUS_LABELS = {
  ADMITTED: 'Admitted', DISCHARGED: 'Discharged', DAMA: 'DAMA - Against Medical Advice',
  DEATH: 'Death', TRANSFERRED_OUT: 'Transferred Out', CANCELLED: 'Cancelled',
}

const TAB_GROUPS = [
  {
    label: null,
    tabs: [
      { key: 'overview', label: 'Overview', icon: FileText, requires: 'manageIPD' },
    ],
  },
  {
    label: 'Clinical',
    tabs: [
      { key: 'roundNotes',  label: 'Round Notes',  icon: ClipboardEdit, requires: 'manageIPD' },
      { key: 'vitals',      label: 'Vitals',       icon: Activity,      requires: 'manageIPD' },
      { key: 'medications', label: 'Medications',  icon: Pill,          requires: 'manageIPD' },
      { key: 'ipdOrders',   label: 'IPD Orders',   icon: ClipboardList, requires: 'manageIPD' },
      { key: 'labResults',  label: 'Lab Results',  icon: FlaskConical,  requires: 'manageIPD' },
    ],
  },
  {
    label: 'Nursing',
    tabs: [
      { key: 'nursing', label: 'Nursing Notes', icon: Heart,      requires: 'manageIPD' },
      { key: 'io',      label: 'I / O',         icon: Droplet,    requires: 'manageIPD' },
      { key: 'mar',     label: 'MAR',           icon: ListChecks, requires: 'manageIPD' },
    ],
  },
  {
    label: 'Billing',
    tabs: [
      { key: 'charges', label: 'Charges', icon: IndianRupee, requires: 'manageIPD' },
      { key: 'billing', label: 'Billing', icon: FileText,    requires: 'manageIPD' },
    ],
  },
  {
    label: 'Records',
    tabs: [
      { key: 'consents',      label: 'Consents',          icon: FileSignature, requires: 'manageIPD' },
      { key: 'consultations', label: 'Consultations',     icon: MessageSquare, requires: 'manageIPD' },
      { key: 'discharge',     label: 'Discharge Summary', icon: FileCheck,     requires: 'manageIPD' },
    ],
  },
]

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function AdmissionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canDischarge = can(user, 'dischargePatient')
  const canTransfer  = can(user, 'manageAdmissions')

  const [admission, setAdmission] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [showDischarge, setShowDischarge] = useState(false)
  const [showTransfer,  setShowTransfer]  = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${id}`)
      setAdmission(data.data)
    } catch {
      toast.error('Failed to load admission')
      navigate('/ipd/admissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }
  if (!admission) return null

  const isOpen = admission.status === 'ADMITTED'

  const visibleGroups = TAB_GROUPS
    .map(g => ({ ...g, tabs: g.tabs.filter(t => can(user, t.requires)) }))
    .filter(g => g.tabs.length > 0)

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':      return <OverviewTab          admission={admission}/>
      case 'roundNotes':    return <RoundNotesTab        admission={admission}/>
      case 'vitals':        return <VitalsTab            admission={admission}/>
      case 'nursing':       return <NursingNotesTab      admission={admission}/>
      case 'io':            return <IntakeOutputTab      admission={admission}/>
      case 'medications':   return <MedicationsTab       admission={admission}/>
      case 'mar':           return <MARTab               admission={admission}/>
      case 'ipdOrders':     return <IPDOrdersTab         admission={admission}/>
      case 'labResults':    return <LabResultsTab        admission={admission}/>
      case 'charges':       return <ChargesTab           admission={admission}/>
      case 'billing':       return <BillingTab           admission={admission}/>
      case 'consents':      return <ConsentsTab          admission={admission}/>
      case 'consultations': return <ConsultationsTab     admission={admission}/>
      case 'discharge':     return <DischargeSummaryTab  admission={admission}/>
      default:              return null
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ipd/admissions')} className="btn-ghost btn-icon">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="page-title">{admission.admissionNumber}</h1>
              <Badge variant={STATUS_VARIANTS[admission.status]}>
                {STATUS_LABELS[admission.status]}
              </Badge>
            </div>
            <p className="page-subtitle">
              {admission.patient?.name}
              {admission.patient?.patientCode && <> &bull; <span className="font-mono">{admission.patient.patientCode}</span></>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isOpen && canTransfer && (
            <Button variant="ghost" size="sm"
              icon={<ArrowRightLeft className="w-3.5 h-3.5"/>}
              onClick={() => setShowTransfer(true)}>
              Transfer Bed
            </Button>
          )}
          {isOpen && canDischarge && (
            <Button variant="primary" size="sm"
              icon={<LogOut className="w-3.5 h-3.5"/>}
              onClick={() => setShowDischarge(true)}>
              Discharge
            </Button>
          )}
        </div>
      </div>

      {/* Compact info bar -- shrinks to content width, centered on the page */}
      <div className="flex justify-center mb-4">
        <Card className="px-5 py-2 inline-block">
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-semibold text-primary">{admission.daysAdmitted}</span>
              <span className="text-slate-500">day{admission.daysAdmitted === 1 ? '' : 's'}</span>
            </span>
            <span className="text-slate-300">&middot;</span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-slate-500">Bed</span>
              <span className="font-semibold text-slate-700">{admission.bed?.bedNumber || '--'}</span>
              {admission.bed?.ward && <span className="text-slate-400 text-xs">({admission.bed.ward})</span>}
            </span>
            <span className="text-slate-300">&middot;</span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-slate-500">Bed Rent</span>
              <span className="font-semibold text-slate-700">&#8377;{(admission.bedRentTotal || 0).toLocaleString('en-IN')}</span>
            </span>
            <span className="text-slate-300">&middot;</span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-slate-500">Deposit</span>
              <span className="font-semibold text-slate-700">&#8377;{(admission.initialDeposit || 0).toLocaleString('en-IN')}</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Pill tabs - all visible, wrap to multiple rows as needed */}
      <Card className="mb-4 p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {visibleGroups.flatMap(g => g.tabs).map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary'}`}>
                <Icon className="w-3.5 h-3.5"/>
                {t.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Tab content uses full width */}
      <div className="min-w-0">
        {renderTab()}
      </div>

      {/* Modals */}
      {showDischarge && (
        <DischargeModal
          admission={admission}
          onClose={() => setShowDischarge(false)}
          onSuccess={() => { setShowDischarge(false); fetchData() }}
        />
      )}

      {showTransfer && (
        <BedTransferModal
          admission={admission}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => { setShowTransfer(false); fetchData() }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
function DischargeModal({ admission, onClose, onSuccess }) {
  const [form, setForm] = useState({
    status:           'DISCHARGED',
    dischargedAt:     toLocalInput(new Date()),
    finalDiagnosis:   admission.provisionalDiagnosis || '',
    dischargeNotes:   '',
    dischargeAdvice:  '',
    causeOfDeath:     '',
    damaReason:       '',
  })
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const submit = async () => {
    if (form.status === 'DEATH' && !form.causeOfDeath.trim()) {
      return toast.error('Cause of death is required')
    }
    if (form.status === 'DAMA' && !form.damaReason.trim()) {
      return toast.error('DAMA reason is required')
    }
    setSaving(true)
    try {
      await api.post(`/ipd/admissions/${admission.id}/discharge`, {
        status:           form.status,
        dischargedAt:     form.dischargedAt,
        finalDiagnosis:   form.finalDiagnosis.trim() || undefined,
        dischargeNotes:   form.dischargeNotes.trim() || undefined,
        dischargeAdvice:  form.dischargeAdvice.trim() || undefined,
        causeOfDeath:     form.causeOfDeath.trim() || undefined,
        damaReason:       form.damaReason.trim() || undefined,
      })
      toast.success('Patient discharged. Bed marked for cleaning.')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to discharge')
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Discharge Patient" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving}
            icon={<LogOut className="w-4 h-4"/>}
            onClick={() => setConfirming(true)}>
            Confirm Discharge
          </Button>
        </>
      }>
      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Discharge Type *</label>
          <select className="form-select" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="DISCHARGED">Normal Discharge</option>
            <option value="DAMA">DAMA - Against Medical Advice</option>
            <option value="DEATH">Death</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Discharge Date and Time *</label>
          <input type="datetime-local" className="form-input"
            value={form.dischargedAt}
            onChange={e => setForm(f => ({ ...f, dischargedAt: e.target.value }))}/>
        </div>

        {form.status === 'DEATH' && (
          <div className="form-group">
            <label className="form-label">Cause of Death *</label>
            <textarea className="form-input" rows={2} value={form.causeOfDeath}
              onChange={e => setForm(f => ({ ...f, causeOfDeath: e.target.value }))}/>
          </div>
        )}

        {form.status === 'DAMA' && (
          <div className="form-group">
            <label className="form-label">DAMA Reason *</label>
            <textarea className="form-input" rows={2} value={form.damaReason}
              onChange={e => setForm(f => ({ ...f, damaReason: e.target.value }))}/>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Final Diagnosis</label>
          <input className="form-input" value={form.finalDiagnosis}
            onChange={e => setForm(f => ({ ...f, finalDiagnosis: e.target.value }))}/>
        </div>

        <div className="form-group">
          <label className="form-label">Discharge Notes (Hospital Course)</label>
          <textarea className="form-input" rows={3} value={form.dischargeNotes}
            onChange={e => setForm(f => ({ ...f, dischargeNotes: e.target.value }))}
            placeholder="Course of treatment, response, complications..."/>
        </div>

        {form.status !== 'DEATH' && (
          <div className="form-group">
            <label className="form-label">Discharge Advice</label>
            <textarea className="form-input" rows={3} value={form.dischargeAdvice}
              onChange={e => setForm(f => ({ ...f, dischargeAdvice: e.target.value }))}
              placeholder="Medications to continue, follow-up, lifestyle..."/>
          </div>
        )}

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mt-3">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5"/>
            <div className="text-xs text-slate-700">
              <p className="font-semibold mb-1">After confirming:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li>Admission status will change to <strong>{form.status}</strong></li>
                <li>Bed <strong>{admission.bed?.bedNumber}</strong> will be marked <strong>CLEANING</strong></li>
                <li>You can then print the Discharge Summary and generate the Final Bill</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Confirm discharge?"
        message={`Discharge ${admission.patient?.name} (${admission.admissionNumber}) - type: ${form.status}. This action cannot be undone.`}
        variant={form.status === 'DEATH' ? 'danger' : 'warning'}
        confirmLabel={`Yes, ${form.status === 'DEATH' ? 'Record Death' : form.status === 'DAMA' ? 'Discharge DAMA' : 'Discharge'}`}
        cancelLabel="Cancel"
        onConfirm={submit}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  )
}
