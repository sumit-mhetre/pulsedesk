// Discharge Summary Print page -- printable A4/A5 layout for the structured
// 15-section discharge summary.
//
// URL: /ipd/admissions/:id/discharge-summary/print
//
// Reads PageDesign config of type 'discharge_summary' to control which
// sections appear (matches the existing prescription/bill print pattern).
//
// Section order matches the 15-section spec exactly:
//   1. Patient Details (combined header)
//   2. Chief Complaints
//   3. History of Present Illness
//   4. Past History
//   5. General Examination
//   6. Systemic Examination
//   7. Investigations
//   8. Provisional / Final Diagnosis
//   9. Treatment Given in Hospital
//  10. Condition at Discharge
//  11. On Discharge Rx (medication table)
//  12. Diet Advice
//  13. Activity Advice
//  14. Follow-Up Advice
//  15. Special Instructions
//
// Empty sections are gracefully omitted (no "Diet Advice: --" rows). The
// allergies block is always shown if patient has allergies (red alert).
// Patient/attendant signature line at bottom for NABH compliance.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import usePrintTitle from '../../hooks/usePrintTitle'
import { buildPrintTitle } from '../../lib/slug'

// Map of ConditionAtDischarge enum values to display labels
const CONDITION_LABELS = {
  STABLE:     'Stable',
  IMPROVED:   'Improved',
  STATUS_QUO: 'Status Quo',
  REFERRED:   'Referred',
  DAMA:       'Discharged Against Medical Advice (DAMA)',
  DECEASED:   'Deceased',
}

// Quick check: does this string have any meaningful content?
const has = (s) => s !== null && s !== undefined && String(s).trim().length > 0

// Vitals object -> display string. Used for printing admission/discharge vitals
// snapshot. Skips empty fields. Returns null if all fields are empty.
function formatVitals(v) {
  if (!v || typeof v !== 'object') return null
  const parts = []
  if (has(v.pulse)) parts.push(`Pulse: ${v.pulse}`)
  if (has(v.bp))    parts.push(`BP: ${v.bp}`)
  if (has(v.temp))  parts.push(`Temp: ${v.temp}`)
  if (has(v.spo2))  parts.push(`SpO₂: ${v.spo2}`)
  return parts.length > 0 ? parts.join('   ·   ') : null
}

export default function DischargeSummaryPrint() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData]       = useState(null)
  const [config, setConfig]   = useState(null)
  const [clinic, setClinic]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/ipd/admissions/${id}/discharge-summary`),
      api.get('/page-design?type=discharge_summary').catch(() => ({ data: { data: { config: {} } } })),
      api.get('/clinics/me').catch(() => ({ data: { data: null } })),
    ]).then(([sumRes, designRes, clinicRes]) => {
      if (cancelled) return
      setData(sumRes.data.data)
      setConfig(designRes.data.data?.config || {})
      setClinic(clinicRes.data.data)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      toast.error('Failed to load summary')
      navigate(-1)
    })
    return () => { cancelled = true }
  }, [id, navigate])

  // PDF filename hook -- relies on data being loaded
  usePrintTitle(data?.admission ? buildPrintTitle('Discharge', {
    id:   data.admission.admissionNumber,
    code: data.admission.patient?.patientCode,
    name: data.admission.patient?.name,
  }) : '')

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }
  if (!data) return null

  // Default config (every flag defaults true so absent PageDesign doesn't hide content)
  const cfg = {
    paperSize: 'A4',
    showClinicName: true, showClinicAddress: true, showClinicPhone: true,
    showClinicTagline: false, showDoctorName: true, showDoctorQual: true,
    showDoctorSpec: true, showDoctorRegNo: true, headerBorder: true,
    headerColor: '#1565C0',
    showPatient: true, showAge: true, showGender: true, showAddress: true,
    showPhone: true, showAllergies: true,
    showAdmissionNumber: true, showAdmittedAt: true, showDischargedAt: true,
    showLengthOfStay: true, showBedDetails: true, showAdmissionSource: true,
    showChiefComplaints: true, showHistoryOfIllness: true, showPastHistory: true,
    showGeneralExam: true, showSystemicExam: true, showInvestigations: true,
    showLabResultsTable: true,
    showDiagnosis: true, showTreatmentSummary: true, showInStayMeds: false,
    showConditionAtDischarge: true, showDischargeMeds: true,
    showDietAdvice: true, showActivityAdvice: true, showFollowUp: true,
    showSpecialInstructions: true,
    showSignatureLine: true,
    baseFontSize: 'md', fontFamily: 'default',
    showDoctorSignature: true, showStamp: false, showGeneratedBy: true,
    primaryColor: '#1565C0',
    ...config,
  }

  const adm = data.admission
  const doctor = adm.primaryDoctor || {}
  const patient = adm.patient || {}
  const meds = adm.dischargeMedications || []
  const allergies = patient.allergies || []

  // Font + paper sizing
  const fontFamilyClass = cfg.fontFamily === 'serif' ? 'font-serif' :
                          cfg.fontFamily === 'mono' ? 'font-mono' : ''
  const baseFontPx = cfg.baseFontSize === 'sm' ? 11 : cfg.baseFontSize === 'lg' ? 14 : 12
  const paperWidth = cfg.paperSize === 'A5' ? '148mm' : '210mm'

  const admissionVitalsStr = formatVitals(adm.admissionVitals)
  const dischargeVitalsStr = formatVitals(adm.dischargeVitals)

  // Has-content checks for sections (used to omit empty sections from print)
  const hasPastHx = adm.pastDM || adm.pastHTN || adm.pastTB || adm.pastAsthma || adm.pastIHD
                 || has(adm.pastSurgical) || has(adm.pastOther)
  const hasGeneralExam = admissionVitalsStr || has(adm.generalExam)
  const hasSystemicExam = has(adm.systemicExamCVS) || has(adm.systemicExamRS)
                       || has(adm.systemicExamCNS) || has(adm.systemicExamPA)
  const hasInvestigations = has(adm.keyInvestigations) || (data.labResults || []).length > 0
  const hasTreatment = has(adm.treatmentSummary) || (cfg.showInStayMeds && (data.medicationsInStay || []).length > 0)
  const hasCondition = has(adm.conditionAtDischarge) || dischargeVitalsStr
  const hasFollowUp = has(adm.followUpDate) || has(adm.followUpInstructions) || has(adm.warningSigns)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* On-screen toolbar (hidden in print) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5"/>
            </button>
            <div>
              <p className="font-bold text-slate-700">Discharge Summary</p>
              <p className="text-xs text-slate-500 font-mono">{adm.admissionNumber}</p>
            </div>
          </div>
          <Button variant="primary" icon={<Printer className="w-4 h-4"/>} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* Print area */}
      <div className="py-6 print:py-0">
        <div
          className={`mx-auto bg-white shadow-lg print:shadow-none p-10 print:p-8 ${fontFamilyClass}`}
          style={{
            width: paperWidth,
            minHeight: cfg.paperSize === 'A5' ? '210mm' : '297mm',
            fontSize: `${baseFontPx}px`,
            color: '#1f2937',
            lineHeight: 1.5,
          }}>

          {/* ── HEADER ── */}
          <header style={{ borderBottom: cfg.headerBorder ? `2px solid ${cfg.primaryColor}` : 'none', paddingBottom: cfg.headerBorder ? 12 : 0, marginBottom: 16 }}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                {cfg.showClinicName && clinic?.name && (
                  <h1 style={{ color: cfg.headerColor, fontSize: baseFontPx * 1.6, fontWeight: 'bold', margin: 0 }}>
                    {clinic.name}
                  </h1>
                )}
                {cfg.showClinicTagline && clinic?.tagline && (
                  <p style={{ color: '#6b7280', fontSize: baseFontPx * 0.85, margin: '2px 0' }}>{clinic.tagline}</p>
                )}
                {cfg.showClinicAddress && clinic?.address && (
                  <p style={{ color: '#4b5563', fontSize: baseFontPx * 0.9, margin: '2px 0' }}>{clinic.address}</p>
                )}
                {cfg.showClinicPhone && clinic?.phone && (
                  <p style={{ color: '#4b5563', fontSize: baseFontPx * 0.9, margin: '2px 0' }}>
                    Tel: {clinic.phone}{clinic.email && ` · ${clinic.email}`}
                  </p>
                )}
              </div>
              {cfg.showDoctorName && doctor.name && (
                <div className="text-right" style={{ fontSize: baseFontPx * 0.9 }}>
                  <p style={{ fontWeight: 'bold', color: cfg.primaryColor, margin: 0 }}>{doctor.name}</p>
                  {cfg.showDoctorQual && doctor.qualification && (
                    <p style={{ color: '#6b7280', margin: '1px 0' }}>{doctor.qualification}</p>
                  )}
                  {cfg.showDoctorSpec && doctor.specialization && (
                    <p style={{ color: '#6b7280', margin: '1px 0' }}>{doctor.specialization}</p>
                  )}
                  {cfg.showDoctorRegNo && doctor.regNo && (
                    <p style={{ color: '#6b7280', margin: '1px 0' }}>Reg. No: {doctor.regNo}</p>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* ── TITLE ── */}
          <h2 style={{
            textAlign: 'center', fontSize: baseFontPx * 1.4, fontWeight: 'bold',
            color: cfg.primaryColor, margin: '8px 0 14px', letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            Discharge Summary
          </h2>

          {/* ── ALLERGIES BANNER (always shown if any) ── */}
          {cfg.showAllergies && allergies.length > 0 && (
            <div style={{
              border: '2px solid #dc2626', background: '#fef2f2',
              padding: '8px 12px', borderRadius: 4, marginBottom: 12,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertTriangle style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0, marginTop: 2 }}/>
              <div>
                <div style={{ fontSize: baseFontPx * 0.75, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ALLERGIES
                </div>
                <div style={{ fontSize: baseFontPx * 0.95, fontWeight: 600, color: '#1f2937', marginTop: 2 }}>
                  {allergies.join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* ── 1. PATIENT DETAILS (two-column) ── */}
          <div className="grid grid-cols-2 gap-x-6 mb-3" style={{ fontSize: baseFontPx * 0.95 }}>
            <div>
              {cfg.showPatient && <Row label="Patient Name" value={patient.name}/>}
              {(cfg.showAge || cfg.showGender) && (
                <Row label="Age / Sex"
                  value={`${cfg.showAge && patient.age ? patient.age + ' yrs' : ''}${cfg.showAge && cfg.showGender ? ' / ' : ''}${cfg.showGender && patient.gender ? patient.gender : ''}`.trim() || '-'}/>
              )}
              {cfg.showPhone && patient.phone && <Row label="Phone" value={patient.phone}/>}
              {cfg.showAddress && patient.address && <Row label="Address" value={patient.address}/>}
            </div>
            <div>
              {cfg.showAdmissionNumber && (
                <Row label="IPD No." value={<span style={{ fontFamily: 'monospace' }}>{adm.admissionNumber}</span>}/>
              )}
              {cfg.showAdmittedAt && (
                <Row label="Admitted On" value={format(new Date(adm.admittedAt), 'd MMM yyyy, hh:mm a')}/>
              )}
              {cfg.showDischargedAt && adm.dischargedAt && (
                <Row label="Discharged On" value={format(new Date(adm.dischargedAt), 'd MMM yyyy, hh:mm a')}/>
              )}
              {cfg.showLengthOfStay && (
                <Row label="Length of Stay" value={`${data.lengthOfStay} day${data.lengthOfStay === 1 ? '' : 's'}`}/>
              )}
              {cfg.showBedDetails && adm.bed && (
                <Row label="Bed / Ward"
                  value={`${adm.bed.bedNumber}${adm.bed.ward ? ' · ' + adm.bed.ward : ''}`}/>
              )}
              {cfg.showAdmissionSource && adm.admissionSource && (
                <Row label="Source" value={adm.admissionSource}/>
              )}
            </div>
          </div>

          {/* ── 2. CHIEF COMPLAINTS ── */}
          {cfg.showChiefComplaints && has(adm.chiefComplaints) && (
            <Section title="Chief Complaints" cfg={cfg} fontPx={baseFontPx}>
              <Para text={adm.chiefComplaints}/>
            </Section>
          )}

          {/* ── 3. HISTORY OF PRESENT ILLNESS ── */}
          {cfg.showHistoryOfIllness && has(adm.historyOfIllness) && (
            <Section title="History of Present Illness" cfg={cfg} fontPx={baseFontPx}>
              <Para text={adm.historyOfIllness}/>
            </Section>
          )}

          {/* ── 4. PAST HISTORY ── */}
          {cfg.showPastHistory && hasPastHx && (
            <Section title="Past History" cfg={cfg} fontPx={baseFontPx}>
              <div style={{ fontSize: baseFontPx * 0.95 }}>
                {(adm.pastDM || adm.pastHTN || adm.pastTB || adm.pastAsthma || adm.pastIHD) && (
                  <p style={{ margin: '0 0 4px' }}>
                    {[
                      adm.pastDM     && 'Diabetes (DM)',
                      adm.pastHTN    && 'Hypertension (HTN)',
                      adm.pastTB     && 'Tuberculosis (TB)',
                      adm.pastAsthma && 'Asthma',
                      adm.pastIHD    && 'IHD / Cardiac',
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                {has(adm.pastSurgical) && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Past Surgical:</strong> {adm.pastSurgical}
                  </p>
                )}
                {has(adm.pastOther) && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Other:</strong> {adm.pastOther}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── 5. GENERAL EXAMINATION ── */}
          {cfg.showGeneralExam && hasGeneralExam && (
            <Section title="General Examination (at Admission)" cfg={cfg} fontPx={baseFontPx}>
              {admissionVitalsStr && (
                <p style={{ fontSize: baseFontPx * 0.92, margin: '0 0 4px', color: '#374151' }}>
                  {admissionVitalsStr}
                </p>
              )}
              {has(adm.generalExam) && <Para text={adm.generalExam}/>}
            </Section>
          )}

          {/* ── 6. SYSTEMIC EXAMINATION ── */}
          {cfg.showSystemicExam && hasSystemicExam && (
            <Section title="Systemic Examination" cfg={cfg} fontPx={baseFontPx}>
              <div style={{ fontSize: baseFontPx * 0.95 }}>
                {has(adm.systemicExamCVS) && <p style={{ margin: '2px 0' }}><strong>CVS:</strong> {adm.systemicExamCVS}</p>}
                {has(adm.systemicExamRS)  && <p style={{ margin: '2px 0' }}><strong>RS:</strong> {adm.systemicExamRS}</p>}
                {has(adm.systemicExamCNS) && <p style={{ margin: '2px 0' }}><strong>CNS:</strong> {adm.systemicExamCNS}</p>}
                {has(adm.systemicExamPA)  && <p style={{ margin: '2px 0' }}><strong>P/A:</strong> {adm.systemicExamPA}</p>}
              </div>
            </Section>
          )}

          {/* ── 7. INVESTIGATIONS ── */}
          {cfg.showInvestigations && hasInvestigations && (
            <Section title="Investigations" cfg={cfg} fontPx={baseFontPx}>
              {has(adm.keyInvestigations) && <Para text={adm.keyInvestigations}/>}
              {cfg.showLabResultsTable && (data.labResults || []).length > 0 && (
                <div style={{ marginTop: 6, fontSize: baseFontPx * 0.85 }}>
                  {data.labResults.map(r => (
                    <div key={r.id} style={{ borderTop: '1px dotted #e5e7eb', padding: '3px 0' }}>
                      <strong>{r.testName}</strong>
                      {r.resultDate && <span style={{ color: '#6b7280' }}> ({format(new Date(r.resultDate), 'd MMM')})</span>}
                      {r.freeTextResult && <span> - {r.freeTextResult}</span>}
                      {r.values?.length > 0 && (
                        <span style={{ color: '#374151' }}>
                          {' '}
                          {r.values.map(v => `${v.fieldLabel}: ${v.value}${v.fieldUnit ? ' ' + v.fieldUnit : ''}`).join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── 8. DIAGNOSIS ── */}
          {cfg.showDiagnosis && (has(adm.provisionalDiagnosis) || has(adm.finalDiagnosis)) && (
            <Section title="Diagnosis" cfg={cfg} fontPx={baseFontPx}>
              <div style={{ fontSize: baseFontPx * 0.95 }}>
                {has(adm.provisionalDiagnosis) && (
                  <p style={{ margin: '2px 0' }}><strong>Provisional:</strong> {adm.provisionalDiagnosis}</p>
                )}
                {has(adm.finalDiagnosis) && (
                  <p style={{ margin: '2px 0' }}><strong>Final:</strong> {adm.finalDiagnosis}</p>
                )}
              </div>
            </Section>
          )}

          {/* ── 9. TREATMENT GIVEN IN HOSPITAL ── */}
          {cfg.showTreatmentSummary && hasTreatment && (
            <Section title="Treatment Given in Hospital" cfg={cfg} fontPx={baseFontPx}>
              {has(adm.treatmentSummary) && <Para text={adm.treatmentSummary}/>}
              {cfg.showInStayMeds && (data.medicationsInStay || []).length > 0 && (
                <div style={{ marginTop: 6, fontSize: baseFontPx * 0.85 }}>
                  {data.medicationsInStay.map(m => (
                    <div key={m.id} style={{ borderTop: '1px dotted #e5e7eb', padding: '2px 0' }}>
                      <strong>{m.medicineName}</strong>
                      {' '}- {m.dose} · {m.route} · {m.frequency}
                      {m.status !== 'ACTIVE' && <span style={{ color: '#6b7280' }}> ({m.status})</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── 10. CONDITION AT DISCHARGE ── */}
          {cfg.showConditionAtDischarge && hasCondition && (
            <Section title="Condition at Discharge" cfg={cfg} fontPx={baseFontPx}>
              <div style={{ fontSize: baseFontPx * 0.95 }}>
                {has(adm.conditionAtDischarge) && (
                  <p style={{ margin: '2px 0' }}>
                    <strong>{CONDITION_LABELS[adm.conditionAtDischarge] || adm.conditionAtDischarge}</strong>
                  </p>
                )}
                {dischargeVitalsStr && (
                  <p style={{ margin: '2px 0', color: '#374151', fontSize: baseFontPx * 0.92 }}>
                    {dischargeVitalsStr}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── 11. ON DISCHARGE Rx (medication table) ── */}
          {cfg.showDischargeMeds && meds.length > 0 && (
            <Section title="On Discharge Rx (Medications)" cfg={cfg} fontPx={baseFontPx}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: baseFontPx * 0.9 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${cfg.primaryColor}40` }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '4%' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '34%' }}>Medication</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '12%' }}>Dose</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '14%' }}>Frequency</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '14%' }}>Duration</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', width: '22%' }}>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>{i + 1}.</td>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>{m.brandName}</div>
                        {m.genericName && (
                          <div style={{ color: '#6b7280', fontSize: baseFontPx * 0.78 }}>({m.genericName})</div>
                        )}
                      </td>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>{m.dose}</td>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>{m.frequency}</td>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>{m.duration || '-'}</td>
                      <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>{m.instructions || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── 12. DIET ADVICE ── */}
          {cfg.showDietAdvice && has(adm.dietAdvice) && (
            <Section title="Diet Advice" cfg={cfg} fontPx={baseFontPx}>
              <Para text={adm.dietAdvice}/>
            </Section>
          )}

          {/* ── 13. ACTIVITY ADVICE ── */}
          {cfg.showActivityAdvice && has(adm.activityAdvice) && (
            <Section title="Activity Advice" cfg={cfg} fontPx={baseFontPx}>
              <Para text={adm.activityAdvice}/>
            </Section>
          )}

          {/* ── 14. FOLLOW-UP ── */}
          {cfg.showFollowUp && hasFollowUp && (
            <Section title="Follow-Up Advice" cfg={cfg} fontPx={baseFontPx}>
              <div style={{ fontSize: baseFontPx * 0.95 }}>
                {has(adm.followUpDate) && (
                  <p style={{ margin: '2px 0' }}>
                    <strong>Review on:</strong> {format(new Date(adm.followUpDate), 'd MMM yyyy')}
                  </p>
                )}
                {has(adm.followUpInstructions) && <Para text={adm.followUpInstructions}/>}
                {has(adm.warningSigns) && (
                  <div style={{
                    marginTop: 6, padding: '6px 10px',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 4,
                  }}>
                    <p style={{ margin: 0, fontSize: baseFontPx * 0.78, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Return immediately if you experience:
                    </p>
                    <p style={{ margin: '3px 0 0', color: '#7f1d1d', fontSize: baseFontPx * 0.92, whiteSpace: 'pre-wrap' }}>
                      {adm.warningSigns}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ── 15. SPECIAL INSTRUCTIONS ── */}
          {cfg.showSpecialInstructions && has(adm.specialInstructions) && (
            <Section title="Special Instructions" cfg={cfg} fontPx={baseFontPx}>
              <Para text={adm.specialInstructions}/>
            </Section>
          )}

          {/* ── SIGNATURE BLOCK ── */}
          {cfg.showSignatureLine && (
            <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: baseFontPx * 0.9 }}>
                {/* Patient/attendant signature */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 38 }}/>
                  <div style={{ borderTop: '1px solid #6b7280', paddingTop: 3, color: '#374151' }}>
                    Patient / Attendant Signature
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: baseFontPx * 0.78, marginTop: 1 }}>
                    I acknowledge receipt of the discharge summary
                  </div>
                </div>

                {/* Doctor signature */}
                {cfg.showDoctorSignature && doctor.name && (
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    {doctor.signature ? (
                      <img src={doctor.signature}
                        alt="signature"
                        style={{ height: 38, maxWidth: 140, margin: '0 auto', objectFit: 'contain' }}/>
                    ) : (
                      <div style={{ height: 38 }}/>
                    )}
                    <div style={{ borderTop: '1px solid #6b7280', paddingTop: 3, color: cfg.primaryColor, fontWeight: 600 }}>
                      {doctor.name}
                    </div>
                    {doctor.qualification && (
                      <div style={{ color: '#6b7280', fontSize: baseFontPx * 0.78, marginTop: 1 }}>
                        {doctor.qualification}
                      </div>
                    )}
                    {doctor.regNo && (
                      <div style={{ color: '#6b7280', fontSize: baseFontPx * 0.78 }}>
                        Reg. No: {doctor.regNo}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FOOTER ── */}
          {cfg.showGeneratedBy && (
            <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px dotted #e5e7eb', textAlign: 'center', color: '#9ca3af', fontSize: baseFontPx * 0.75 }}>
              Generated on {format(new Date(), 'd MMM yyyy, hh:mm a')} · SimpleRx EMR
            </div>
          )}
        </div>
      </div>

      {/* Print-only CSS */}
      <style>{`
        @media print {
          @page { size: ${cfg.paperSize}; margin: 0; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Helpers (small components) ────────────────────────────────────

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
      <div style={{ width: 110, color: '#6b7280', flexShrink: 0 }}>{label}:</div>
      <div style={{ color: '#1f2937', flex: 1 }}>{value || '-'}</div>
    </div>
  )
}

function Section({ title, cfg, fontPx, children }) {
  return (
    <div style={{ marginTop: 10, marginBottom: 6 }}>
      <h3 style={{
        fontSize: fontPx * 1.0, fontWeight: 'bold', color: cfg.primaryColor,
        borderBottom: `1px solid ${cfg.primaryColor}40`,
        paddingBottom: 2, marginBottom: 5, marginTop: 0,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {title}
      </h3>
      <div>{children}</div>
    </div>
  )
}

function Para({ text }) {
  // whiteSpace: pre-wrap preserves line breaks the doctor typed in textareas.
  return (
    <p style={{ margin: '2px 0', whiteSpace: 'pre-wrap', fontSize: 'inherit', color: '#1f2937' }}>
      {text}
    </p>
  )
}
