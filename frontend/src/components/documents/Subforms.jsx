import { differenceInDays, format, parseISO, isValid as isValidDate } from 'date-fns'

// Each subform receives:
//   data       current `data` object (type-specific fields)
//   setData    setter — accepts (newData) or function(prev) => newData
//   diagnosis  current diagnosis string
//   setDiagnosis
//   remarks    current remarks string
//   setRemarks
//   setError   (msg|null) — used for live cross-field validation
//
// Subforms ONLY render the type-specific portion.  Common fields (patient, examDate)
// are rendered by the parent <DocumentForm/>.

// ────────────────────────────────────────────────────────
// FITNESS CERTIFICATE
// ────────────────────────────────────────────────────────
const FITNESS_FOR_OPTIONS = [
  'Employment',
  'Pre-employment',
  'Sports',
  'School / College',
  'Military / Police',
  'Driving',
  'Travel',
  'Custom',
]

export function FitnessCertSubform({ data, setData, diagnosis, setDiagnosis, remarks, setRemarks }) {
  const verdict      = data.verdict || 'FIT'
  const fitnessFor   = data.fitnessFor || 'Employment'
  const customFitnessFor = data.fitnessForCustom || ''
  const restrictions = data.restrictions || ''
  const validityMonths = data.validityMonths ?? ''
  const vitals       = data.vitals || {}

  const setVital = (k, v) => setData(prev => ({ ...prev, vitals: { ...(prev.vitals || {}), [k]: v }}))

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Verdict *</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'FIT',                     label: 'Fit',                      tone: 'border-emerald-300 bg-emerald-50  text-emerald-700' },
            { v: 'FIT_WITH_RESTRICTIONS',   label: 'Fit with restrictions',    tone: 'border-amber-300 bg-amber-50    text-amber-700' },
            { v: 'UNFIT',                   label: 'Not Fit',                  tone: 'border-rose-300 bg-rose-50      text-rose-700' },
          ].map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setData(p => ({ ...p, verdict: opt.v }))}
              className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition
                ${verdict === opt.v ? opt.tone : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Fitness for *</label>
          <select
            className="form-select"
            value={fitnessFor}
            onChange={e => setData(p => ({ ...p, fitnessFor: e.target.value }))}
          >
            {FITNESS_FOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {fitnessFor === 'Custom' && (
            <input
              type="text"
              className="form-input mt-2"
              placeholder="Specify the activity / role"
              value={customFitnessFor}
              onChange={e => setData(p => ({ ...p, fitnessForCustom: e.target.value }))}
            />
          )}
        </div>
        <div>
          <label className="form-label">Validity (months)</label>
          <input
            type="number" min="0" max="60"
            className="form-input"
            placeholder="e.g. 6"
            value={validityMonths}
            onChange={e => setData(p => ({ ...p, validityMonths: e.target.value === '' ? null : Math.max(0, Math.min(60, parseInt(e.target.value) || 0)) }))}
          />
          <p className="text-xs text-slate-400 mt-1">Leave blank for unlimited / one-time</p>
        </div>
      </div>

      {verdict === 'FIT_WITH_RESTRICTIONS' && (
        <div>
          <label className="form-label">Restrictions *</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="e.g. No heavy lifting for 6 weeks"
            value={restrictions}
            onChange={e => setData(p => ({ ...p, restrictions: e.target.value }))}
          />
        </div>
      )}

      {/* Vitals snapshot */}
      <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Vitals (optional)</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <input className="form-input text-sm" placeholder="BP (e.g. 120/80)"   value={vitals.bp     || ''} onChange={e => setVital('bp',     e.target.value)}/>
          <input className="form-input text-sm" placeholder="Pulse (per min)"    value={vitals.pulse  || ''} onChange={e => setVital('pulse',  e.target.value)}/>
          <input className="form-input text-sm" placeholder="Weight (kg)"        value={vitals.weight || ''} onChange={e => setVital('weight', e.target.value)}/>
          <input className="form-input text-sm" placeholder="Height (cm)"        value={vitals.height || ''} onChange={e => setVital('height', e.target.value)}/>
          <input className="form-input text-sm" placeholder="Vision"             value={vitals.vision || ''} onChange={e => setVital('vision', e.target.value)}/>
          <input className="form-input text-sm" placeholder="Other"              value={vitals.other  || ''} onChange={e => setVital('other',  e.target.value)}/>
        </div>
      </div>

      <div>
        <label className="form-label">Diagnosis / observations (optional)</label>
        <textarea className="form-input" rows={2}
          placeholder="e.g. No abnormality detected on physical exam"
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}/>
      </div>

      <div>
        <label className="form-label">Remarks (optional)</label>
        <textarea className="form-input" rows={2}
          placeholder="Any additional notes"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}/>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────────────
// MEDICAL CERTIFICATE (sick leave)
// ────────────────────────────────────────────────────────
export function MedicalCertSubform({ data, setData, diagnosis, setDiagnosis, remarks, setRemarks }) {
  const restFromDate  = data.restFromDate  || ''
  const restToDate    = data.restToDate    || ''
  const resumeFromDate = data.resumeFromDate || ''

  // Compute total days (inclusive) when both dates are set
  let totalDays = 0
  if (restFromDate && restToDate) {
    const a = parseISO(restFromDate), b = parseISO(restToDate)
    if (isValidDate(a) && isValidDate(b)) {
      totalDays = differenceInDays(b, a) + 1   // inclusive
      if (totalDays < 0) totalDays = 0
    }
  }

  // When restToDate changes, default resume to next day
  const onRestToChange = (val) => {
    setData(prev => {
      const next = { ...prev, restToDate: val, totalDays: 0 }
      if (val) {
        const d = parseISO(val)
        if (isValidDate(d)) {
          d.setDate(d.getDate() + 1)
          next.resumeFromDate = format(d, 'yyyy-MM-dd')
        }
      }
      // Recompute totalDays
      if (prev.restFromDate && val) {
        const a = parseISO(prev.restFromDate), b = parseISO(val)
        if (isValidDate(a) && isValidDate(b)) {
          next.totalDays = Math.max(0, differenceInDays(b, a) + 1)
        }
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="form-label">Rest from *</label>
          <input
            type="date"
            className="form-input"
            value={restFromDate}
            onChange={e => setData(p => ({ ...p, restFromDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="form-label">Rest to *</label>
          <input
            type="date"
            className="form-input"
            value={restToDate}
            min={restFromDate || undefined}
            onChange={e => onRestToChange(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Total days</label>
          <input
            type="text" readOnly
            className="form-input bg-slate-50 font-semibold"
            value={totalDays > 0 ? `${totalDays} day${totalDays > 1 ? 's' : ''}` : '—'}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Fit to resume from</label>
        <input
          type="date"
          className="form-input md:w-1/3"
          value={resumeFromDate}
          min={restToDate || undefined}
          onChange={e => setData(p => ({ ...p, resumeFromDate: e.target.value }))}
        />
        <p className="text-xs text-slate-400 mt-1">Date patient can return to office/school</p>
      </div>

      <div>
        <label className="form-label">Diagnosis *</label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="e.g. Viral fever with body ache"
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">This is what appears on the certificate as reason for absence</p>
      </div>

      <div>
        <label className="form-label">Remarks (optional)</label>
        <textarea className="form-input" rows={2}
          placeholder="Any additional notes for employer/school"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}/>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────────────
// REFERRAL
// ────────────────────────────────────────────────────────
const SPECIALTIES = [
  'Cardiologist', 'Dermatologist', 'ENT Specialist', 'Endocrinologist',
  'Gastroenterologist', 'General Surgeon', 'Gynecologist', 'Nephrologist',
  'Neurologist', 'Oncologist', 'Ophthalmologist', 'Orthopedic Surgeon',
  'Pediatrician', 'Psychiatrist', 'Pulmonologist', 'Radiologist',
  'Rheumatologist', 'Urologist', 'Other',
]

export function ReferralSubform({ data, setData, diagnosis, setDiagnosis, remarks, setRemarks, patient, onAutofillFromLastRx }) {
  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-4">
      {/* Recipient details */}
      <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Refer to</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="form-label">Doctor's name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Anil Kumar"
              value={data.referredToName || ''}
              onChange={e => set('referredToName', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Specialty</label>
            <select
              className="form-select"
              value={data.referredToSpecialty || ''}
              onChange={e => set('referredToSpecialty', e.target.value)}
            >
              <option value="">— Select —</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Hospital / Clinic</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Apollo Hospitals"
              value={data.referredToClinic || ''}
              onChange={e => set('referredToClinic', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional"
              value={data.referredToPhone || ''}
              onChange={e => set('referredToPhone', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional"
              value={data.referredToAddress || ''}
              onChange={e => set('referredToAddress', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Clinical context */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Clinical context</p>
        {patient?.id && onAutofillFromLastRx && (
          <button
            type="button"
            onClick={onAutofillFromLastRx}
            className="text-xs font-semibold text-primary hover:underline"
          >
            ⚡ Auto-fill from last prescription
          </button>
        )}
      </div>

      <div>
        <label className="form-label">Chief complaint</label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="Patient's main complaint"
          value={data.chiefComplaint || ''}
          onChange={e => set('chiefComplaint', e.target.value)}
        />
      </div>

      <div>
        <label className="form-label">Clinical history</label>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Onset, duration, progression, relevant past history"
          value={data.clinicalHistory || ''}
          onChange={e => set('clinicalHistory', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="form-label">Current medications</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="One per line"
            value={data.currentMeds || ''}
            onChange={e => set('currentMeds', e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Investigations done</label>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Tests + results, one per line"
            value={data.investigations || ''}
            onChange={e => set('investigations', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Provisional diagnosis</label>
        <input
          type="text"
          className="form-input"
          placeholder="Working diagnosis"
          value={data.provisionalDx || ''}
          onChange={e => set('provisionalDx', e.target.value)}
        />
      </div>

      <div>
        <label className="form-label">Reason for referral *</label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="What you want the specialist to do"
          value={data.reasonForReferral || ''}
          onChange={e => set('reasonForReferral', e.target.value)}
        />
      </div>

      {/* Hidden — diagnosis + remarks repurposed for referral */}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Additional notes (optional)</summary>
        <div className="mt-2 space-y-2">
          <textarea
            className="form-input"
            rows={2}
            placeholder="Diagnosis (free text)"
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
          />
          <textarea
            className="form-input"
            rows={2}
            placeholder="Closing remarks for the receiving doctor"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
          />
        </div>
      </details>
    </div>
  )
}
