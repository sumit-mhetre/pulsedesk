// Discharge Summary tab -- structured 15-section editor + summary view.
//
// Layout:
//   - Header: patient + admission status + Save + Print buttons
//   - Allergies banner (if patient has allergies, prominent red alert)
//   - 15 collapsible sections with the structured discharge fields
//   - Each section shows a small "filled / empty" indicator
//
// Sections map directly to the 15-section discharge summary spec:
//   1. Patient Details (read-only, auto-filled)
//   2. Chief Complaints
//   3. History of Present Illness
//   4. Past History (checkboxes + free text)
//   5. General Examination (admission vitals + general exam)
//   6. Systemic Examination (CVS, RS, CNS, PA)
//   7. Investigations (curated key findings + read-only lab results)
//   8. Diagnosis (provisional + final)
//   9. Treatment Given in Hospital (categorized prose + read-only meds list)
//  10. Condition at Discharge (enum + discharge vitals)
//  11. On Discharge Rx (separate medication list with copy-active button)
//  12. Diet Advice
//  13. Activity Advice
//  14. Follow-Up Advice (date + instructions + warning signs)
//  15. Special Instructions
//
// Save button persists fields 2-15 (not section 11 -- discharge medications
// have their own per-row CRUD endpoints, no batch save needed).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Printer, Save, AlertTriangle, AlertCircle, ChevronDown, ChevronRight,
  Plus, Trash2, Pencil, Pill, Copy, CheckCircle2, Circle, FlaskConical,
  Stethoscope, Activity, Heart, Brain, Apple, Clipboard, Calendar,
} from 'lucide-react'
import { Card, Button, Badge, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import DischargeMedicationModal from './DischargeMedicationModal'

// ─── Helpers ─────────────────────────────────────────────────────

// "Filled" check: returns true if the section has at least one non-empty value.
// Used for the small dot indicator in section headers.
const hasContent = (...values) => values.some(v => {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'boolean') return v === true
  if (typeof v === 'object') return Object.values(v).some(x => x !== null && x !== undefined && x !== '')
  return false
})

// ─── Auto-fill helpers ──────────────────────────────────────────────
// Keyword maps for matching Patient.chronicConditions strings to the 5
// structured Past History checkboxes. Matches are case-insensitive substring.
// Anything that DOESN'T match a keyword is appended to pastOther free-text
// so it doesn't get lost.
const PAST_HX_KEYWORDS = {
  pastDM:     ['diabetes', 'diabetic', 'dm', 't1dm', 't2dm', 'iddm', 'niddm'],
  pastHTN:    ['hypertension', 'hypertensive', 'htn', 'high blood pressure', 'high bp'],
  pastTB:     ['tuberculosis', 'tb', 'koch', 'mtb', 'ptb'],
  pastAsthma: ['asthma', 'asthmatic', 'bronchial asthma'],
  pastIHD:    ['ihd', 'ischemic heart', 'ischaemic heart', 'cad', 'coronary',
               'myocardial', 'angina', 'heart disease', 'cardiac', 'mi'],
}

// Match conditions[] (array of strings) against PAST_HX_KEYWORDS.
// Returns { pastDM, pastHTN, pastTB, pastAsthma, pastIHD, pastOther } where
// boolean flags indicate matches and pastOther is a comma-joined list of
// conditions that didn't match any flag.
function matchPastHistory(conditions) {
  const result = { pastDM: false, pastHTN: false, pastTB: false, pastAsthma: false, pastIHD: false, pastOther: '' }
  if (!Array.isArray(conditions) || conditions.length === 0) return result

  const unmatched = []
  for (const cond of conditions) {
    if (!cond || typeof cond !== 'string') continue
    const lower = cond.toLowerCase()
    let matched = false
    for (const [flag, keywords] of Object.entries(PAST_HX_KEYWORDS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        result[flag] = true
        matched = true
        break  // one chronic condition flips one flag; stop checking others
      }
    }
    if (!matched) unmatched.push(cond.trim())
  }
  if (unmatched.length > 0) result.pastOther = unmatched.join(', ')
  return result
}

// Convert an IPDVitalRecord row into the { pulse, bp, temp, spo2 } shape
// used by VitalsGrid. All fields stringified for the form input.
function vitalRowToFormShape(v) {
  if (!v) return null
  return {
    pulse: v.pulse != null ? String(v.pulse) : '',
    bp:    v.bp || '',
    temp:  v.temperature != null ? String(v.temperature) : '',
    spo2:  v.spo2 != null ? String(v.spo2) : '',
  }
}

// ─── Small reusable section accordion ─────────────────────────────
// Controlled by parent: parent passes `open` boolean and `onToggle` callback.
// Parent enforces "only one open at a time" by tracking active section ID.
function Section({ id, title, icon: Icon, filled, open, onToggle, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-2 overflow-hidden">
      <button type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0"/>
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0"/>}
        {Icon && <Icon className="w-4 h-4 text-primary flex-shrink-0"/>}
        <span className="text-sm font-semibold text-slate-700 flex-1">{title}</span>
        {filled
          ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" title="Has content"/>
          : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" title="Empty"/>}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Small reusable vitals 4-field grid ────────────────────────────
function VitalsGrid({ label, value, onChange, disabled }) {
  // value: { pulse, bp, temp, spo2 } -- all strings (free-form, no validation)
  const v = value || {}
  const set = (key, val) => onChange?.({ ...v, [key]: val })
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      {label && <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{label}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[11px] text-slate-500">Pulse</label>
          <input className="form-input" placeholder="80/min" disabled={disabled}
            value={v.pulse || ''} onChange={e => set('pulse', e.target.value)}/>
        </div>
        <div>
          <label className="text-[11px] text-slate-500">BP</label>
          <input className="form-input" placeholder="120/80" disabled={disabled}
            value={v.bp || ''} onChange={e => set('bp', e.target.value)}/>
        </div>
        <div>
          <label className="text-[11px] text-slate-500">Temp</label>
          <input className="form-input" placeholder="98.6 °F" disabled={disabled}
            value={v.temp || ''} onChange={e => set('temp', e.target.value)}/>
        </div>
        <div>
          <label className="text-[11px] text-slate-500">SpO₂</label>
          <input className="form-input" placeholder="98 %" disabled={disabled}
            value={v.spo2 || ''} onChange={e => set('spo2', e.target.value)}/>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

export default function DischargeSummaryTab({ admission }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canEdit = can(user, 'dischargePatient')
  const isClosed = admission.status !== 'ADMITTED'

  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Form state -- all 15-section fields. Initialized from admission/summary on load.
  const [form, setForm] = useState({
    provisionalDiagnosis: '',
    finalDiagnosis:       '',
    chiefComplaints:      '',
    historyOfIllness:     '',
    pastDM:       false,
    pastHTN:      false,
    pastTB:       false,
    pastAsthma:   false,
    pastIHD:      false,
    pastSurgical: '',
    pastOther:    '',
    admissionVitals:  null,
    dischargeVitals:  null,
    generalExam:      '',
    systemicExamCVS:  '',
    systemicExamRS:   '',
    systemicExamCNS:  '',
    systemicExamPA:   '',
    keyInvestigations:    '',
    treatmentSummary:     '',
    conditionAtDischarge: '',
    dietAdvice:           '',
    activityAdvice:       '',
    followUpDate:         '',
    followUpInstructions: '',
    warningSigns:         '',
    specialInstructions:  '',
    dischargeNotes:  '',
    dischargeAdvice: '',
  })

  // Discharge medications (Section 11) -- separate state, separate CRUD
  const [meds, setMeds] = useState([])
  const [showMedModal, setShowMedModal] = useState(false)
  const [editingMed, setEditingMed]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Accordion state -- only ONE section open at a time. Default: section 1
  // (Patient Details) so the doctor sees patient context first. Clicking
  // any section opens that one and closes whatever was previously open.
  // Clicking the open section again closes it (toggle to null).
  const [activeSection, setActiveSection] = useState('s1')
  const toggleSection = (id) => setActiveSection(curr => curr === id ? null : id)

  // ─── Fetch summary ─────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/discharge-summary`)
      setSummary(data.data)
      const a = data.data.admission

      // ── Auto-fill plan ──
      // After hydrating from the saved admission row, fill EMPTY fields
      // from other admission/patient sources. Doctor edits are never
      // overwritten -- only fields that are still empty/null get suggested
      // values. Doctor must click Save to persist; so if they don't want
      // an auto-fill they can clear it before saving.
      const auto = {}

      // 1. Chief Complaints <- Admission.reasonForAdmission
      if (!a.chiefComplaints && a.reasonForAdmission) {
        auto.chiefComplaints = a.reasonForAdmission
      }

      // 2. Past History <- Patient.chronicConditions (keyword match)
      // Only auto-fill if NONE of the past history fields have been touched.
      // (If any of the 5 flags or pastOther is set, doctor has already been here.)
      const pastTouched = a.pastDM || a.pastHTN || a.pastTB || a.pastAsthma || a.pastIHD
                       || (a.pastSurgical && a.pastSurgical.trim())
                       || (a.pastOther && a.pastOther.trim())
      if (!pastTouched && a.patient?.chronicConditions?.length) {
        const matched = matchPastHistory(a.patient.chronicConditions)
        Object.assign(auto, matched)
      }

      // 3. Admission Vitals <- first IPDVitalRecord (oldest)
      if (!a.admissionVitals && data.data.firstVital) {
        auto.admissionVitals = vitalRowToFormShape(data.data.firstVital)
      }

      // 4. Discharge Vitals <- most recent IPDVitalRecord
      // (recentVitals is reverse-chronological, so [0] is the latest)
      if (!a.dischargeVitals && data.data.recentVitals?.[0]) {
        auto.dischargeVitals = vitalRowToFormShape(data.data.recentVitals[0])
      }

      // Hydrate form: saved value first, then auto-fill suggestion
      setForm({
        provisionalDiagnosis: a.provisionalDiagnosis || '',
        finalDiagnosis:       a.finalDiagnosis       || '',
        chiefComplaints:      a.chiefComplaints      || auto.chiefComplaints || '',
        historyOfIllness:     a.historyOfIllness     || '',
        pastDM:       a.pastDM      || auto.pastDM      || false,
        pastHTN:      a.pastHTN     || auto.pastHTN     || false,
        pastTB:       a.pastTB      || auto.pastTB      || false,
        pastAsthma:   a.pastAsthma  || auto.pastAsthma  || false,
        pastIHD:      a.pastIHD     || auto.pastIHD     || false,
        pastSurgical: a.pastSurgical || '',
        pastOther:    a.pastOther    || auto.pastOther || '',
        admissionVitals:  a.admissionVitals || auto.admissionVitals || null,
        dischargeVitals:  a.dischargeVitals || auto.dischargeVitals || null,
        generalExam:      a.generalExam      || '',
        systemicExamCVS:  a.systemicExamCVS  || '',
        systemicExamRS:   a.systemicExamRS   || '',
        systemicExamCNS:  a.systemicExamCNS  || '',
        systemicExamPA:   a.systemicExamPA   || '',
        keyInvestigations:    a.keyInvestigations    || '',
        treatmentSummary:     a.treatmentSummary     || '',
        conditionAtDischarge: a.conditionAtDischarge || '',
        dietAdvice:           a.dietAdvice           || '',
        activityAdvice:       a.activityAdvice       || '',
        followUpDate:         a.followUpDate ? format(new Date(a.followUpDate), 'yyyy-MM-dd') : '',
        followUpInstructions: a.followUpInstructions || '',
        warningSigns:         a.warningSigns         || '',
        specialInstructions:  a.specialInstructions  || '',
        dischargeNotes:       a.dischargeNotes       || '',
        dischargeAdvice:      a.dischargeAdvice      || '',
      })
      setMeds(a.dischargeMedications || [])

      // 5. Auto-trigger discharge meds copy from active orders -- only if
      // NO discharge meds exist AND there ARE active in-stay orders.
      // Don't fire if admission is still ADMITTED (premature) or if user
      // already saved at least one discharge med.
      const isClosedNow = a.status !== 'ADMITTED'
      const hasActiveOrders = (data.data.medicationsInStay || [])
        .some(m => m.status === 'ACTIVE')
      if (isClosedNow && hasActiveOrders && (a.dischargeMedications?.length ?? 0) === 0) {
        try {
          const resp = await api.post(`/ipd/admissions/${admission.id}/discharge-medications/copy-active`)
          const created = resp.data.data || []
          if (created.length > 0) {
            setMeds(created)
            // Silent: no toast. Doctor sees the meds appear in section 11
            // and the "set duration" warnings in the table act as the cue.
          }
        } catch {
          // Silent: user can still click "Copy from Active Orders" manually
        }
      }

      // If any auto-fill was applied, the form now shows suggestions in
      // empty fields. Doctor must click Save to persist them. We deliberately
      // do NOT toast here -- silent auto-fill matches user preference.
    } catch (err) {
      toast.error('Failed to load discharge summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() /* eslint-disable-next-line */ }, [admission.id])

  // ─── Save form ─────────────────────────────────────────────
  const onSave = async () => {
    if (!isClosed) return toast.error('Discharge the patient first to edit the summary')
    setSaving(true)
    try {
      const payload = { ...form }
      // Empty followUpDate -> null
      if (!payload.followUpDate) payload.followUpDate = null
      // Empty conditionAtDischarge -> null (so DB stores NULL not '')
      if (!payload.conditionAtDischarge) payload.conditionAtDischarge = null

      await api.put(`/ipd/admissions/${admission.id}/discharge-summary`, payload)
      setLastSaved(new Date())
      toast.success('Saved')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ─── Discharge medications CRUD handlers ──────────────────
  const onMedAdded   = (med) => setMeds(prev => [...prev, med])
  const onMedUpdated = (med) => setMeds(prev => prev.map(m => m.id === med.id ? med : m))
  const onMedDelete = async (id) => {
    try {
      await api.delete(`/ipd/discharge-medications/${id}`)
      setMeds(prev => prev.filter(m => m.id !== id))
      toast.success('Medication removed')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setConfirmDelete(null)
    }
  }
  const onCopyActive = async () => {
    try {
      const { data } = await api.post(`/ipd/admissions/${admission.id}/discharge-medications/copy-active`)
      const created = data.data || []
      if (created.length === 0) {
        toast('No active medications to copy', { icon: 'ℹ️' })
      } else {
        setMeds(prev => [...prev, ...created])
        toast.success(`${created.length} medication(s) copied. Set durations before printing.`)
      }
    } catch {
      toast.error('Failed to copy active medications')
    }
  }

  // ─── Print ─────────────────────────────────────────────────
  const handlePrint = () => {
    navigate(`/ipd/admissions/${admission.id}/discharge-summary/print`)
  }

  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>
  }
  if (!summary) {
    return <div className="text-center py-12 text-slate-500">Failed to load.</div>
  }

  const adm = summary.admission
  const allergies = adm.patient?.allergies || []
  const editable = isClosed && canEdit

  return (
    <div className="space-y-3">

      {/* ── HEADER ── */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Discharge Summary</div>
            <div className="text-lg font-semibold text-slate-800">
              {adm.patient?.name} &middot; {adm.admissionNumber}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Admitted {format(new Date(adm.admittedAt), 'd MMM yyyy')}</span>
              {adm.dischargedAt && <><span>&middot;</span><span>Discharged {format(new Date(adm.dischargedAt), 'd MMM yyyy')}</span></>}
              <span>&middot;</span>
              <span>{summary.lengthOfStay} day{summary.lengthOfStay === 1 ? '' : 's'}</span>
              <Badge variant={isClosed ? 'success' : 'warning'} size="xs">{adm.status}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-slate-400">
                Saved {format(lastSaved, 'HH:mm:ss')}
              </span>
            )}
            {editable && (
              <Button variant="primary" loading={saving}
                icon={<Save className="w-4 h-4"/>} onClick={onSave}>
                Save
              </Button>
            )}
            <Button variant="outline" disabled={!isClosed}
              icon={<Printer className="w-4 h-4"/>} onClick={handlePrint}>
              Print
            </Button>
          </div>
        </div>

        {!isClosed && (
          <div className="mt-3 flex items-start gap-2 text-xs text-warning bg-orange-50 border border-orange-100 rounded-lg p-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
            <span>
              This admission is still active. Discharge the patient first to edit and print the summary.
              Fields below are read-only until discharge.
            </span>
          </div>
        )}
      </Card>

      {/* ── ALLERGIES BANNER (only if any) ── */}
      {allergies.length > 0 && (
        <div className="bg-red-50 border-2 border-danger rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5"/>
          <div>
            <div className="text-xs font-bold text-danger uppercase tracking-wide">ALLERGIES</div>
            <div className="text-sm text-slate-800 font-medium mt-0.5">
              {allergies.join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* ── 1. PATIENT DETAILS (read-only) ── */}
      <Section id="s1" title="1. Patient Details" icon={Clipboard} filled={true}
        open={activeSection === 's1'} onToggle={toggleSection}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><span className="text-slate-500">Name:</span> <span className="font-medium">{adm.patient?.name}</span></div>
          <div><span className="text-slate-500">Age / Sex:</span> <span className="font-medium">{adm.patient?.age || '--'} / {adm.patient?.gender || '--'}</span></div>
          <div><span className="text-slate-500">IPD No:</span> <span className="font-medium">{adm.admissionNumber}</span></div>
          <div><span className="text-slate-500">Bed:</span> <span className="font-medium">{adm.bed?.bedNumber || '--'} ({adm.bed?.ward || '--'})</span></div>
          <div><span className="text-slate-500">Admitted:</span> <span className="font-medium">{format(new Date(adm.admittedAt), 'd MMM yyyy, hh:mm a')}</span></div>
          <div><span className="text-slate-500">Discharged:</span> <span className="font-medium">{adm.dischargedAt ? format(new Date(adm.dischargedAt), 'd MMM yyyy, hh:mm a') : '--'}</span></div>
        </div>
      </Section>

      {/* ── 2. CHIEF COMPLAINTS ── */}
      <Section id="s2" title="2. Chief Complaints" icon={Clipboard}
        filled={hasContent(form.chiefComplaints)}
        open={activeSection === 's2'} onToggle={toggleSection}>
        <textarea className="form-input min-h-[80px]" disabled={!editable}
          placeholder="One per line, with duration. e.g. Cough x 5 days, Fever x 2 days"
          value={form.chiefComplaints}
          onChange={e => setForm(f => ({ ...f, chiefComplaints: e.target.value }))}/>
      </Section>

      {/* ── 3. HISTORY OF PRESENT ILLNESS ── */}
      <Section id="s3" title="3. History of Present Illness" icon={Clipboard}
        filled={hasContent(form.historyOfIllness)}
        open={activeSection === 's3'} onToggle={toggleSection}>
        <textarea className="form-input min-h-[80px]" disabled={!editable}
          placeholder="Brief chronological history of how the illness developed."
          value={form.historyOfIllness}
          onChange={e => setForm(f => ({ ...f, historyOfIllness: e.target.value }))}/>
      </Section>

      {/* ── 4. PAST HISTORY ── */}
      <Section id="s4" title="4. Past History" icon={Clipboard}
        filled={hasContent(form.pastDM, form.pastHTN, form.pastTB, form.pastAsthma, form.pastIHD, form.pastSurgical, form.pastOther)}
        open={activeSection === 's4'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            {[
              { key: 'pastDM',     label: 'Diabetes (DM)' },
              { key: 'pastHTN',    label: 'Hypertension (HTN)' },
              { key: 'pastTB',     label: 'Tuberculosis (TB)' },
              { key: 'pastAsthma', label: 'Asthma' },
              { key: 'pastIHD',    label: 'IHD / Cardiac' },
            ].map(({ key, label }) => (
              <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" disabled={!editable}
                  checked={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-primary focus:ring-primary/30"/>
                <span className={form[key] ? 'font-medium text-slate-800' : 'text-slate-600'}>{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="form-label">Past Surgical History</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Appendectomy 2018, Knee replacement 2020, ..."
              value={form.pastSurgical}
              onChange={e => setForm(f => ({ ...f, pastSurgical: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label">Other Past History / Drug Reactions</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Other significant past illnesses, drug reactions, family history if relevant..."
              value={form.pastOther}
              onChange={e => setForm(f => ({ ...f, pastOther: e.target.value }))}/>
          </div>
        </div>
      </Section>

      {/* ── 5. GENERAL EXAMINATION ── */}
      <Section id="s5" title="5. General Examination (at Admission)" icon={Activity}
        filled={hasContent(form.admissionVitals, form.generalExam)}
        open={activeSection === 's5'} onToggle={toggleSection}>
        <div className="space-y-3">
          <VitalsGrid label="Vitals at admission" value={form.admissionVitals}
            onChange={v => setForm(f => ({ ...f, admissionVitals: v }))}
            disabled={!editable}/>
          <div>
            <label className="form-label">General Examination Findings</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Patient conscious, oriented, build, pallor, icterus, edema, lymphadenopathy..."
              value={form.generalExam}
              onChange={e => setForm(f => ({ ...f, generalExam: e.target.value }))}/>
          </div>
        </div>
      </Section>

      {/* ── 6. SYSTEMIC EXAMINATION ── */}
      <Section id="s6" title="6. Systemic Examination" icon={Stethoscope}
        filled={hasContent(form.systemicExamCVS, form.systemicExamRS, form.systemicExamCNS, form.systemicExamPA)}
        open={activeSection === 's6'} onToggle={toggleSection}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="form-label flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500"/> CVS (Cardiovascular)</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="S1 S2 normal, no murmurs..."
              value={form.systemicExamCVS}
              onChange={e => setForm(f => ({ ...f, systemicExamCVS: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-sky-500"/> RS (Respiratory)</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Air entry bilateral equal, no added sounds..."
              value={form.systemicExamRS}
              onChange={e => setForm(f => ({ ...f, systemicExamRS: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label flex items-center gap-1"><Brain className="w-3.5 h-3.5 text-purple-500"/> CNS (Central Nervous)</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="GCS 15/15, no neuro deficit..."
              value={form.systemicExamCNS}
              onChange={e => setForm(f => ({ ...f, systemicExamCNS: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label">P/A (Per Abdomen)</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Soft, non-tender, no organomegaly..."
              value={form.systemicExamPA}
              onChange={e => setForm(f => ({ ...f, systemicExamPA: e.target.value }))}/>
          </div>
        </div>
      </Section>

      {/* ── 7. INVESTIGATIONS ── */}
      <Section id="s7" title="7. Investigations" icon={FlaskConical}
        filled={hasContent(form.keyInvestigations) || (summary.labResults || []).length > 0}
        open={activeSection === 's7'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div>
            <label className="form-label">Key Investigation Findings</label>
            <textarea className="form-input min-h-[80px]" disabled={!editable}
              placeholder="Important lab/radiology findings only. e.g. Hb 8.2 (low), CT chest: B/L lower lobe consolidation..."
              value={form.keyInvestigations}
              onChange={e => setForm(f => ({ ...f, keyInvestigations: e.target.value }))}/>
          </div>
          {(summary.labResults || []).length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Lab Results During Stay (read-only)</p>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {summary.labResults.map(r => (
                  <div key={r.id} className="text-xs text-slate-700 border-b border-slate-200 last:border-0 py-1">
                    <span className="font-medium">{r.testName}</span>
                    {r.resultDate && <span className="text-slate-500 ml-2">({format(new Date(r.resultDate), 'd MMM')})</span>}
                    {r.freeTextResult && <span className="text-slate-600 ml-2">- {r.freeTextResult}</span>}
                    {r.values?.length > 0 && (
                      <span className="text-slate-600 ml-2">
                        {r.values.map(v => `${v.fieldLabel}: ${v.value}${v.fieldUnit ? ' ' + v.fieldUnit : ''}`).join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── 8. DIAGNOSIS ── */}
      <Section id="s8" title="8. Provisional / Final Diagnosis" icon={Clipboard}
        filled={hasContent(form.provisionalDiagnosis, form.finalDiagnosis)}
        open={activeSection === 's8'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div>
            <label className="form-label">Provisional Diagnosis</label>
            <input className="form-input" disabled={!editable}
              placeholder="Initial working diagnosis at admission"
              value={form.provisionalDiagnosis}
              onChange={e => setForm(f => ({ ...f, provisionalDiagnosis: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label">Final Diagnosis</label>
            <input className="form-input" disabled={!editable}
              placeholder="Confirmed diagnosis at discharge"
              value={form.finalDiagnosis}
              onChange={e => setForm(f => ({ ...f, finalDiagnosis: e.target.value }))}/>
          </div>
        </div>
      </Section>

      {/* ── 9. TREATMENT GIVEN IN HOSPITAL ── */}
      <Section id="s9" title="9. Treatment Given in Hospital" icon={Pill}
        filled={hasContent(form.treatmentSummary) || (summary.medicationsInStay || []).length > 0}
        open={activeSection === 's9'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div>
            <label className="form-label">Treatment Summary</label>
            <textarea className="form-input min-h-[80px]" disabled={!editable}
              placeholder="Categorized prose: IV fluids (NS, RL), antibiotics (Inj. Augmentin BD x 5d), supportive care, oxygen, transfusions, etc."
              value={form.treatmentSummary}
              onChange={e => setForm(f => ({ ...f, treatmentSummary: e.target.value }))}/>
          </div>
          {(summary.medicationsInStay || []).length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Medications During Stay (read-only)</p>
              <div className="space-y-1 max-h-44 overflow-y-auto text-xs">
                {summary.medicationsInStay.map(m => (
                  <div key={m.id} className="text-slate-700 border-b border-slate-200 last:border-0 py-1 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{m.medicineName}</span>
                      <span className="text-slate-500 ml-2">{m.dose} &middot; {m.route} &middot; {m.frequency}</span>
                    </div>
                    <Badge variant={m.status === 'ACTIVE' ? 'success' : 'gray'} size="xs">{m.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── 10. CONDITION AT DISCHARGE ── */}
      <Section id="s10" title="10. Condition at Discharge" icon={Activity}
        filled={hasContent(form.conditionAtDischarge, form.dischargeVitals)}
        open={activeSection === 's10'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div>
            <label className="form-label">Condition</label>
            <select className="form-select" disabled={!editable}
              value={form.conditionAtDischarge}
              onChange={e => setForm(f => ({ ...f, conditionAtDischarge: e.target.value }))}>
              <option value="">- Select -</option>
              <option value="STABLE">Stable</option>
              <option value="IMPROVED">Improved</option>
              <option value="STATUS_QUO">Status Quo</option>
              <option value="REFERRED">Referred</option>
              <option value="DAMA">Discharged Against Medical Advice (DAMA)</option>
              <option value="DECEASED">Deceased</option>
            </select>
          </div>
          <VitalsGrid label="Vitals at discharge" value={form.dischargeVitals}
            onChange={v => setForm(f => ({ ...f, dischargeVitals: v }))}
            disabled={!editable}/>
        </div>
      </Section>

      {/* ── 11. ON DISCHARGE Rx ── */}
      <Section id="s11" title="11. On Discharge Rx (Medications)" icon={Pill}
        filled={meds.length > 0}
        open={activeSection === 's11'} onToggle={toggleSection}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" size="sm" disabled={!editable}
              icon={<Plus className="w-4 h-4"/>}
              onClick={() => { setEditingMed(null); setShowMedModal(true) }}>
              Add Medication
            </Button>
            <Button variant="outline" size="sm" disabled={!editable}
              icon={<Copy className="w-4 h-4"/>}
              onClick={onCopyActive}>
              Copy from Active Orders
            </Button>
            <span className="text-xs text-slate-500 ml-auto">{meds.length} item{meds.length === 1 ? '' : 's'}</span>
          </div>

          {meds.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No discharge medications added yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-3 py-1.5">Medication</th>
                    <th className="text-left px-2 py-1.5">Dose</th>
                    <th className="text-left px-2 py-1.5">Frequency</th>
                    <th className="text-left px-2 py-1.5">Duration</th>
                    <th className="text-left px-2 py-1.5">Instructions</th>
                    <th className="px-2 py-1.5 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map(m => {
                    const noDuration = !m.duration || m.duration.trim() === ''
                    return (
                      <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{m.brandName}</div>
                          {m.genericName && <div className="text-slate-500 text-[11px]">{m.genericName}</div>}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{m.dose}</td>
                        <td className="px-2 py-2 text-slate-700">{m.frequency}</td>
                        <td className={`px-2 py-2 ${noDuration ? 'text-warning font-semibold' : 'text-slate-700'}`}>
                          {noDuration ? '⚠ set duration' : m.duration}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{m.instructions || '-'}</td>
                        <td className="px-2 py-2">
                          {editable && (
                            <div className="flex items-center gap-1 justify-end">
                              <button type="button"
                                onClick={() => { setEditingMed(m); setShowMedModal(true) }}
                                className="p-1 text-slate-400 hover:text-primary"
                                title="Edit">
                                <Pencil className="w-3.5 h-3.5"/>
                              </button>
                              <button type="button"
                                onClick={() => setConfirmDelete(m)}
                                className="p-1 text-slate-400 hover:text-danger"
                                title="Delete">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* ── 12. DIET ADVICE ── */}
      <Section id="s12" title="12. Diet Advice" icon={Apple}
        filled={hasContent(form.dietAdvice)}
        open={activeSection === 's12'} onToggle={toggleSection}>
        <textarea className="form-input min-h-[60px]" disabled={!editable}
          placeholder="Low-salt diet, diabetic diet, plenty of fluids, avoid oily/spicy food, etc."
          value={form.dietAdvice}
          onChange={e => setForm(f => ({ ...f, dietAdvice: e.target.value }))}/>
      </Section>

      {/* ── 13. ACTIVITY ADVICE ── */}
      <Section id="s13" title="13. Activity Advice" icon={Activity}
        filled={hasContent(form.activityAdvice)}
        open={activeSection === 's13'} onToggle={toggleSection}>
        <textarea className="form-input min-h-[60px]" disabled={!editable}
          placeholder="Bed rest 3 days, gradually increase activity, avoid heavy lifting for 2 weeks, etc."
          value={form.activityAdvice}
          onChange={e => setForm(f => ({ ...f, activityAdvice: e.target.value }))}/>
      </Section>

      {/* ── 14. FOLLOW-UP ── */}
      <Section id="s14" title="14. Follow-Up Advice" icon={Calendar}
        filled={hasContent(form.followUpDate, form.followUpInstructions, form.warningSigns)}
        open={activeSection === 's14'} onToggle={toggleSection}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Follow-Up Date</label>
              <input type="date" className="form-input" disabled={!editable}
                value={form.followUpDate}
                onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}/>
            </div>
          </div>
          <div>
            <label className="form-label">Follow-Up Instructions</label>
            <textarea className="form-input min-h-[60px]" disabled={!editable}
              placeholder="Review with reports, continue medications, OPD on Monday morning..."
              value={form.followUpInstructions}
              onChange={e => setForm(f => ({ ...f, followUpInstructions: e.target.value }))}/>
          </div>
          <div>
            <label className="form-label flex items-center gap-1 text-danger">
              <AlertTriangle className="w-3.5 h-3.5"/> Warning Signs (return immediately if...)
            </label>
            <textarea className="form-input min-h-[60px] border-rose-200" disabled={!editable}
              placeholder="High fever > 102°F, breathing difficulty, severe abdominal pain, vomiting blood, altered consciousness..."
              value={form.warningSigns}
              onChange={e => setForm(f => ({ ...f, warningSigns: e.target.value }))}/>
          </div>
        </div>
      </Section>

      {/* ── 15. SPECIAL INSTRUCTIONS ── */}
      <Section id="s15" title="15. Special Instructions" icon={Clipboard}
        filled={hasContent(form.specialInstructions)}
        open={activeSection === 's15'} onToggle={toggleSection}>
        <textarea className="form-input min-h-[60px]" disabled={!editable}
          placeholder="Any other instructions specific to this patient..."
          value={form.specialInstructions}
          onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}/>
      </Section>

      {/* Sticky save bar at bottom for long forms */}
      {editable && (
        <div className="sticky bottom-2 z-10 bg-white border border-primary/20 shadow-lg rounded-xl p-2 flex items-center gap-2">
          <span className="text-xs text-slate-500 px-2">
            {lastSaved
              ? <>Last saved at {format(lastSaved, 'HH:mm:ss')}</>
              : <>Not saved yet</>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" loading={saving}
              icon={<Save className="w-4 h-4"/>} onClick={onSave}>
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showMedModal && (
        <DischargeMedicationModal
          admissionId={admission.id}
          medication={editingMed}
          onClose={() => { setShowMedModal(false); setEditingMed(null) }}
          onSaved={(med) => {
            if (editingMed) onMedUpdated(med)
            else            onMedAdded(med)
          }}/>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete medication?"
          message={`Remove ${confirmDelete.brandName} from discharge prescription?`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => onMedDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}/>
      )}
    </div>
  )
}
