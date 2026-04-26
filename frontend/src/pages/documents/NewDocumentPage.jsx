import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Printer } from 'lucide-react'
import { Button, Card, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

import PatientPicker from '../../components/documents/PatientPicker'
import TemplatePicker from '../../components/documents/TemplatePicker'
import { FitnessCertSubform, MedicalCertSubform, ReferralSubform } from '../../components/documents/Subforms'

const TYPE_META = {
  FITNESS_CERT: { label: 'Fitness Certificate', short: 'Fitness Cert' },
  MEDICAL_CERT: { label: 'Medical Certificate (Sick Leave)', short: 'Medical Cert' },
  REFERRAL:     { label: 'Referral Letter', short: 'Referral' },
}

export default function NewDocumentPage() {
  const navigate = useNavigate()
  const { id } = useParams()                 // edit mode if present
  const [searchParams] = useSearchParams()
  const isEdit = !!id

  // Type comes from URL ?type= for new, or from loaded doc for edit
  const [type, setType] = useState(searchParams.get('type') || 'FITNESS_CERT')

  const [patient, setPatient]         = useState(null)
  const [examDate, setExamDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [diagnosis, setDiagnosis]     = useState('')
  const [remarks, setRemarks]         = useState('')
  const [data, setData]               = useState({})
  const [templateUsed, setTemplateUsed] = useState(null)

  // Snapshot fields admin/doctor can override at issue time
  const [patientGuardian, setPatientGuardian] = useState('')
  const [patientEmpId,    setPatientEmpId]    = useState('')

  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(isEdit)

  // ── Load existing doc when editing ─────────────────────
  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api.get(`/documents/${id}`)
      .then(({ data: res }) => {
        const d = res?.data
        if (!d) throw new Error('not found')
        setType(d.type)
        setPatient(d.patient)
        setExamDate(d.examDate ? format(new Date(d.examDate), 'yyyy-MM-dd') : '')
        setDiagnosis(d.diagnosis || '')
        setRemarks(d.remarks || '')
        setData(d.data || {})
        setPatientGuardian(d.patientGuardian || '')
        setPatientEmpId(d.patientEmpId || '')
      })
      .catch(() => { toast.error('Certificate not found'); navigate('/documents') })
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  // ── Pre-select patient from ?patient= query param (deep link from patient profile) ─
  useEffect(() => {
    if (isEdit) return
    const pid = searchParams.get('patient')
    if (!pid || patient?.id === pid) return
    api.get(`/patients/${pid}`, { silent: true })
      .then(({ data: res }) => { if (res?.data) setPatient(res.data) })
      .catch(() => {})
  }, [searchParams, isEdit, patient?.id])

  // ── Apply a picked template ────────────────────────────
  const applyTemplate = (tpl) => {
    if (!tpl) return
    if (tpl.diagnosis) setDiagnosis(tpl.diagnosis)
    if (tpl.remarks)   setRemarks(tpl.remarks)
    if (tpl.data && typeof tpl.data === 'object') {
      setData(prev => ({ ...prev, ...tpl.data }))
    }
    setTemplateUsed(tpl.id)
    toast.success(`Template "${tpl.name}" applied`)
  }

  // ── Auto-fill referral from last prescription ──────────
  const autofillFromLastRx = async () => {
    if (!patient?.id) return
    try {
      const { data: res } = await api.get(`/prescriptions/patient/${patient.id}/last`, { silent: true })
      const rx = res?.data
      if (!rx) { toast('No previous prescription found'); return }
      setData(prev => ({
        ...prev,
        chiefComplaint:  rx.complaint || prev.chiefComplaint || '',
        provisionalDx:   rx.diagnosis || prev.provisionalDx  || '',
        currentMeds:     (rx.medicines || []).map(m => `${m.medicineName}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('\n') || prev.currentMeds || '',
        investigations:  (rx.labTests || []).map(lt => lt.labTestName).join('\n') || prev.investigations || '',
        sourceRxId:      rx.id,
      }))
      toast.success(`Pre-filled from Rx ${rx.rxNo || ''}`)
    } catch {
      toast.error('Could not load last prescription')
    }
  }

  // ── Save ───────────────────────────────────────────────
  const validate = () => {
    if (!patient?.id) { toast.error('Please select a patient'); return false }
    if (!examDate)    { toast.error('Exam date is required'); return false }

    if (type === 'MEDICAL_CERT') {
      if (!data.restFromDate || !data.restToDate) {
        toast.error('Rest from & to dates are required'); return false
      }
      if (!diagnosis || !diagnosis.trim()) {
        toast.error('Diagnosis is required for medical certificate'); return false
      }
    }
    if (type === 'REFERRAL') {
      if (!data.referredToName || !data.referredToName.trim()) {
        toast.error('Please enter the doctor you are referring to'); return false
      }
      if (!data.reasonForReferral || !data.reasonForReferral.trim()) {
        toast.error('Reason for referral is required'); return false
      }
    }
    if (type === 'FITNESS_CERT') {
      if (data.verdict === 'FIT_WITH_RESTRICTIONS' && (!data.restrictions || !data.restrictions.trim())) {
        toast.error('Please describe the restrictions'); return false
      }
    }
    return true
  }

  const handleSave = async (alsoPrint = false) => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        type, patientId: patient.id,
        examDate, diagnosis, remarks, data,
        patientGuardian: patientGuardian || null,
        patientEmpId:    patientEmpId    || null,
        templateUsed,
      }
      let savedDoc
      if (isEdit) {
        const { data: res } = await api.put(`/documents/${id}`, payload)
        savedDoc = res?.data
        toast.success('Certificate updated')
      } else {
        const { data: res } = await api.post('/documents', payload)
        savedDoc = res?.data
        toast.success('Certificate created')
      }
      if (alsoPrint && savedDoc?.id) {
        navigate(`/documents/${savedDoc.id}/view?print=1`)
      } else if (savedDoc?.id) {
        navigate(`/documents/${savedDoc.id}/view`)
      } else {
        navigate('/documents')
      }
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>

  const meta = TYPE_META[type] || TYPE_META.FITNESS_CERT

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          title={isEdit ? `Edit ${meta.short}` : `New ${meta.label}`}
          subtitle={format(new Date(), 'EEEE, dd MMMM yyyy')}
          action={<Button variant="ghost" icon={<ArrowLeft className="w-4 h-4"/>} onClick={() => navigate('/documents')}>Back</Button>}
        />
      </div>

      {/* Type switcher (only for new docs — locked when editing) */}
      {!isEdit && (
        <Card>
          <div className="flex gap-2">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setType(k); setData({}); setTemplateUsed(null) }}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition
                  ${type === k
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Patient picker */}
      <Card title="Patient">
        <PatientPicker value={patient} onChange={setPatient} disabled={isEdit}/>

        {patient && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="form-label">S/o, D/o, W/o (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. S/o Ramesh Sharma"
                value={patientGuardian}
                onChange={e => setPatientGuardian(e.target.value)}
              />
            </div>
            {type === 'MEDICAL_CERT' && (
              <div>
                <label className="form-label">Employee / Student ID (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. EMP-1234 or 12-A-23"
                  value={patientEmpId}
                  onChange={e => setPatientEmpId(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Template picker */}
      {patient && (
        <Card>
          <TemplatePicker type={type} onPick={applyTemplate}/>
        </Card>
      )}

      {/* Common: exam date */}
      {patient && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Exam date *</label>
              <input
                type="date"
                className="form-input"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Type-specific fields */}
      {patient && (
        <Card title="Details">
          {type === 'FITNESS_CERT' && (
            <FitnessCertSubform data={data} setData={setData}
              diagnosis={diagnosis} setDiagnosis={setDiagnosis}
              remarks={remarks}     setRemarks={setRemarks}/>
          )}
          {type === 'MEDICAL_CERT' && (
            <MedicalCertSubform data={data} setData={setData}
              diagnosis={diagnosis} setDiagnosis={setDiagnosis}
              remarks={remarks}     setRemarks={setRemarks}/>
          )}
          {type === 'REFERRAL' && (
            <ReferralSubform data={data} setData={setData}
              diagnosis={diagnosis} setDiagnosis={setDiagnosis}
              remarks={remarks}     setRemarks={setRemarks}
              patient={patient}
              onAutofillFromLastRx={autofillFromLastRx}/>
          )}
        </Card>
      )}

      {/* Action bar */}
      {patient && (
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="ghost" onClick={() => navigate('/documents')}>Cancel</Button>
          <Button variant="outline" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={() => handleSave(false)}>
            Save
          </Button>
          <Button variant="primary" loading={saving} icon={<Printer className="w-4 h-4"/>} onClick={() => handleSave(true)}>
            Save &amp; Print
          </Button>
        </div>
      )}
    </div>
  )
}
