// New Admission page — single-page form for admitting a patient to a bed.
//
// Sections (top to bottom):
//   1. Patient (uses PatientPicker)
//   2. Doctor + Bed (dropdowns)
//   3. Clinical (reason, provisional diagnosis, notes)
//   4. Attendant (name, relation, phone, address, ID proof)
//   5. Source / MLC (admission source, MLC checkbox)
//   6. Billing (deposit, payment mode, insurance)
//
// Bed picker shows only VACANT and RESERVED beds, grouped by ward, with
// rate visible. Switching ward filters within the dropdown for usability.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, ArrowLeft, User, Stethoscope, BedDouble, FileText,
  Users as UsersIcon, AlertCircle, IndianRupee, ShieldAlert,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import PatientPicker from '../../components/documents/PatientPicker'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const BED_TYPE_LABELS = {
  GENERAL: 'General', SEMI_PRIVATE: 'Semi-Private', PRIVATE: 'Private',
  ICU: 'ICU', HDU: 'HDU', LABOUR: 'Labour', DAY_CARE: 'Day-Care',
  ISOLATION: 'Isolation', OTHER: 'Other',
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Insurance', 'Other']

const ATTENDANT_RELATIONS = [
  'Father', 'Mother', 'Spouse', 'Son', 'Daughter',
  'Brother', 'Sister', 'Friend', 'Guardian', 'Other',
]

// Convert a JS Date to "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function NewAdmissionPage() {
  const navigate = useNavigate()
  const [doctors, setDoctors]   = useState([])
  const [beds, setBeds]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  const [patient, setPatient] = useState(null)
  const [form, setForm] = useState({
    primaryDoctorId:      '',
    bedId:                '',
    admittedAt:           toLocalInput(new Date()),
    reasonForAdmission:   '',
    provisionalDiagnosis: '',
    admissionNotes:       '',
    attendantName:        '',
    attendantRelation:    '',
    attendantPhone:       '',
    attendantAddress:     '',
    attendantIdProof:     '',
    isMLC:                false,
    mlcNumber:            '',
    admissionSource:      '',
    referredFrom:         '',
    paymentMode:          'Cash',
    insuranceProvider:    '',
    insurancePolicy:      '',
    initialDeposit:       0,
  })

  // Load doctors + available beds
  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      api.get('/users/doctors'),
      api.get('/ipd/beds?status=VACANT'),
      api.get('/ipd/beds?status=RESERVED'),
    ])
      .then(([drsRes, vacRes, resRes]) => {
        if (!alive) return
        setDoctors(drsRes.data?.data || [])
        const vacantBeds   = vacRes.data?.data || []
        const reservedBeds = resRes.data?.data || []
        // Combine, sort by ward+bedNumber
        const all = [...vacantBeds, ...reservedBeds].sort((a, b) =>
          (a.ward || '').localeCompare(b.ward || '') ||
          a.bedNumber.localeCompare(b.bedNumber)
        )
        setBeds(all)
      })
      .catch(() => alive && toast.error('Failed to load form data'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const selectedBed = beds.find(b => b.id === form.bedId)

  const submit = async () => {
    if (!patient)                    return toast.error('Please select a patient')
    if (!form.primaryDoctorId)       return toast.error('Please select a doctor')
    if (!form.bedId)                 return toast.error('Please select a bed')
    if (!form.reasonForAdmission.trim()) return toast.error('Reason for admission is required')

    setSaving(true)
    try {
      const { data } = await api.post('/ipd/admissions', {
        patientId:            patient.id,
        primaryDoctorId:      form.primaryDoctorId,
        bedId:                form.bedId,
        admittedAt:           form.admittedAt,
        reasonForAdmission:   form.reasonForAdmission.trim(),
        provisionalDiagnosis: form.provisionalDiagnosis.trim() || undefined,
        admissionNotes:       form.admissionNotes.trim() || undefined,
        attendantName:        form.attendantName.trim() || undefined,
        attendantRelation:    form.attendantRelation || undefined,
        attendantPhone:       form.attendantPhone.trim() || undefined,
        attendantAddress:     form.attendantAddress.trim() || undefined,
        attendantIdProof:     form.attendantIdProof.trim() || undefined,
        isMLC:                form.isMLC,
        mlcNumber:            form.isMLC ? (form.mlcNumber.trim() || undefined) : undefined,
        admissionSource:      form.admissionSource || undefined,
        referredFrom:         form.referredFrom.trim() || undefined,
        paymentMode:          form.paymentMode,
        insuranceProvider:    form.insuranceProvider.trim() || undefined,
        insurancePolicy:      form.insurancePolicy.trim() || undefined,
        initialDeposit:       parseFloat(form.initialDeposit) || 0,
      })
      toast.success(`${patient.name} admitted as ${data.data.admissionNumber}`)
      navigate(`/ipd/admissions/${data.data.id}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to admit patient')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }

  // Group beds by ward for the picker
  const bedsByWard = {}
  for (const b of beds) {
    const w = b.ward || 'Unspecified'
    if (!bedsByWard[w]) bedsByWard[w] = []
    bedsByWard[w].push(b)
  }

  return (
    <div className="fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="page-title">Admit Patient</h1>
          <p className="page-subtitle">Register a new inpatient admission</p>
        </div>
      </div>

      {/* No vacant beds banner */}
      {beds.length === 0 && (
        <Card className="mb-5 border-2 border-orange-100 bg-orange-50/30">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold text-slate-800 text-sm">No beds available</p>
              <p className="text-xs text-slate-600 mt-1">
                All beds are occupied or under cleaning. Mark a bed clean from the Bed Board, or contact admin to add more beds.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-5">
        {/* ── Patient ─────────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-primary"/> Patient *
          </h3>
          <PatientPicker value={patient} onChange={setPatient}/>
        </Card>

        {/* ── Doctor + Bed ────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary"/> Doctor & Bed *
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Primary Doctor *</label>
              <select className="form-select"
                value={form.primaryDoctorId}
                onChange={e => setForm(f => ({ ...f, primaryDoctorId: e.target.value }))}>
                <option value="">— Select doctor —</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.specialization ? ` (${d.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Admitted At *</label>
              <input type="datetime-local" className="form-input"
                value={form.admittedAt}
                onChange={e => setForm(f => ({ ...f, admittedAt: e.target.value }))}/>
            </div>
            <div className="form-group sm:col-span-2">
              <label className="form-label">Bed *</label>
              {beds.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No beds available — all occupied or under cleaning.</p>
              ) : (
                <select className="form-select"
                  value={form.bedId}
                  onChange={e => setForm(f => ({ ...f, bedId: e.target.value }))}>
                  <option value="">— Select bed —</option>
                  {Object.entries(bedsByWard).sort(([a], [b]) => a.localeCompare(b)).map(([ward, wardBeds]) => (
                    <optgroup key={ward} label={ward}>
                      {wardBeds.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bedNumber} • {BED_TYPE_LABELS[b.bedType]} • ₹{(b.dailyRate || 0).toLocaleString('en-IN')}/day
                          {b.status === 'RESERVED' ? ' (RESERVED)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {selectedBed && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Selected: <strong>{selectedBed.bedNumber}</strong> in {selectedBed.ward || 'Unspecified ward'}
                  {selectedBed.dailyRate > 0
                    ? <>, daily rate <strong>₹{selectedBed.dailyRate.toLocaleString('en-IN')}</strong></>
                    : <span className="text-warning"> — daily rate not set</span>}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Clinical ────────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary"/> Clinical Details
          </h3>
          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Reason for Admission *</label>
              <input className="form-input" value={form.reasonForAdmission}
                onChange={e => setForm(f => ({ ...f, reasonForAdmission: e.target.value }))}
                placeholder="e.g. Severe abdominal pain, suspected appendicitis"/>
            </div>
            <div className="form-group">
              <label className="form-label">Provisional Diagnosis</label>
              <input className="form-input" value={form.provisionalDiagnosis}
                onChange={e => setForm(f => ({ ...f, provisionalDiagnosis: e.target.value }))}
                placeholder="Working diagnosis"/>
            </div>
            <div className="form-group">
              <label className="form-label">Admission Notes</label>
              <textarea className="form-input" rows={3} value={form.admissionNotes}
                onChange={e => setForm(f => ({ ...f, admissionNotes: e.target.value }))}
                placeholder="Initial assessment, history, observations..."/>
            </div>
          </div>
        </Card>

        {/* ── Attendant ───────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-primary"/> Attendant Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.attendantName}
                onChange={e => setForm(f => ({ ...f, attendantName: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Relation</label>
              <select className="form-select" value={form.attendantRelation}
                onChange={e => setForm(f => ({ ...f, attendantRelation: e.target.value }))}>
                <option value="">— Select —</option>
                {ATTENDANT_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.attendantPhone}
                onChange={e => setForm(f => ({ ...f, attendantPhone: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">ID Proof</label>
              <input className="form-input" value={form.attendantIdProof}
                onChange={e => setForm(f => ({ ...f, attendantIdProof: e.target.value }))}
                placeholder="Aadhaar / DL / Passport number"/>
            </div>
            <div className="form-group sm:col-span-2">
              <label className="form-label">Address</label>
              <textarea className="form-input" rows={2} value={form.attendantAddress}
                onChange={e => setForm(f => ({ ...f, attendantAddress: e.target.value }))}/>
            </div>
          </div>
        </Card>

        {/* ── Source / MLC ────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary"/> Source & Legal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Admission Source</label>
              <input className="form-input" value={form.admissionSource}
                onChange={e => setForm(f => ({ ...f, admissionSource: e.target.value }))}
                placeholder="OPD / Emergency / Referral"/>
            </div>
            <div className="form-group">
              <label className="form-label">Referred From</label>
              <input className="form-input" value={form.referredFrom}
                onChange={e => setForm(f => ({ ...f, referredFrom: e.target.value }))}
                placeholder="Referring doctor or facility"/>
            </div>
            <div className="form-group sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="form-checkbox"
                  checked={form.isMLC}
                  onChange={e => setForm(f => ({ ...f, isMLC: e.target.checked }))}/>
                <span className="text-sm font-medium text-slate-700">Medico-Legal Case (MLC)</span>
              </label>
            </div>
            {form.isMLC && (
              <div className="form-group sm:col-span-2">
                <label className="form-label">MLC Number</label>
                <input className="form-input" value={form.mlcNumber}
                  onChange={e => setForm(f => ({ ...f, mlcNumber: e.target.value }))}
                  placeholder="Police / hospital MLC ref"/>
              </div>
            )}
          </div>
        </Card>

        {/* ── Billing ─────────────────────────────────── */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary"/> Billing & Deposit
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Initial Deposit (₹)</label>
              <input type="number" min="0" className="form-input"
                value={form.initialDeposit}
                onChange={e => setForm(f => ({ ...f, initialDeposit: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select className="form-select" value={form.paymentMode}
                onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Insurance Provider</label>
              <input className="form-input" value={form.insuranceProvider}
                onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Policy Number</label>
              <input className="form-input" value={form.insurancePolicy}
                onChange={e => setForm(f => ({ ...f, insurancePolicy: e.target.value }))}/>
            </div>
          </div>
        </Card>

        {/* ── Action bar ──────────────────────────────── */}
        <div className="sticky bottom-0 bg-background py-3 flex justify-end gap-2 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 border-t border-slate-100">
          <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" loading={saving}
            icon={<Save className="w-4 h-4"/>}
            onClick={submit}>
            Admit Patient
          </Button>
        </div>
      </div>
    </div>
  )
}
