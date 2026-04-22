import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer, Edit, Calendar, Receipt } from 'lucide-react'
import { Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'

// Only timing translates — everything else stays English
// Notes translation for liquids/drops (Marathi)
const LIQUID_NOTES_EN = ['5ml twice daily','5ml thrice daily','2.5ml twice daily','10ml twice daily','2 drops twice daily','2 drops thrice daily','1 teaspoon thrice daily','2 teaspoons twice daily','As directed','Apply thin layer twice daily']
const LIQUID_NOTES_MR = ['दिवसातून 2 वेळा 5ml','दिवसातून 3 वेळा 5ml','दिवसातून 2 वेळा 2.5ml','दिवसातून 2 वेळा 10ml','दिवसातून 2 वेळा 2 थेंब','दिवसातून 3 वेळा 2 थेंब','दिवसातून 3 वेळा 1 चमचा','दिवसातून 2 वेळा 2 चमचे','सांगितल्याप्रमाणे','दिवसातून 2 वेळा पातळ थर लावा']
const LIQUID_NOTES_HI = ['दिन में 2 बार 5ml','दिन में 3 बार 5ml','दिन में 2 बार 2.5ml','दिन में 2 बार 10ml','दिन में 2 बार 2 बूंद','दिन में 3 बार 2 बूंद','दिन में 3 बार 1 चम्मच','दिन में 2 बार 2 चम्मच','निर्देशानुसार','दिन में 2 बार पतली परत लगाएं']

function translateNote(noteEn, lang) {
  if (!noteEn || lang === 'en') return noteEn
  const idx = LIQUID_NOTES_EN.indexOf(noteEn)
  if (idx === -1) return noteEn  // custom note - show as-is
  if (lang === 'mr') return LIQUID_NOTES_MR[idx] || noteEn
  if (lang === 'hi') return LIQUID_NOTES_HI[idx] || noteEn
  return noteEn
}

const TIMING_LABELS = { AF:'After Food',BF:'Before Food',ES:'Empty Stomach',HS:'At Bedtime',WM:'With Milk',WW:'With Water',MO:'Morning Only',AN:'At Night' }
const TIMING_HI     = { AF:'खाने के बाद',BF:'खाने से पहले',ES:'खाली पेट',HS:'सोते समय',WM:'दूध के साथ',WW:'पानी के साथ',MO:'सुबह',AN:'रात को' }
const TIMING_MR     = { AF:'जेवणानंतर',BF:'जेवणापूर्वी',ES:'रिकाम्या पोटी',HS:'झोपताना',WM:'दुधासोबत',WW:'पाण्यासोबत',MO:'सकाळी',AN:'रात्री' }

function getTimingLabel(code, lang) {
  if (lang==='hi') return TIMING_HI[code]||TIMING_LABELS[code]||code
  if (lang==='mr') return TIMING_MR[code]||TIMING_LABELS[code]||code
  return TIMING_LABELS[code]||code
}

// ── Frequency labels + translations ──
const FREQ_LABELS = { DAILY:'Daily', ALT_DAYS:'Alternate Days', EVERY_3D:'Every 3 Days', WEEKLY:'Weekly', SOS:'As Needed' }
const FREQ_HI     = { DAILY:'रोज़', ALT_DAYS:'एक दिन छोड़कर', EVERY_3D:'हर तीसरे दिन', WEEKLY:'हफ्ते में एक बार', SOS:'ज़रूरत अनुसार' }
const FREQ_MR     = { DAILY:'दररोज', ALT_DAYS:'एका दिवसा आड', EVERY_3D:'दर ३ दिवसांनी', WEEKLY:'आठवड्यातून एकदा', SOS:'गरजेनुसार' }
function getFrequencyLabel(code, lang) {
  if (!code) code = 'DAILY'
  if (lang === 'hi') return FREQ_HI[code] || FREQ_LABELS[code] || code
  if (lang === 'mr') return FREQ_MR[code] || FREQ_LABELS[code] || code
  return FREQ_LABELS[code] || code
}

// ── Duration translation (e.g. "5 days" → "5 दिवस" / "5 दिन") ──
const DAYS_UNIT_HI = { day:'दिन', days:'दिन', week:'हफ्ता', weeks:'हफ्ते', month:'महीना', months:'महीने', year:'साल', years:'साल' }
const DAYS_UNIT_MR = { day:'दिवस', days:'दिवस', week:'आठवडा', weeks:'आठवडे', month:'महिना', months:'महिने', year:'वर्ष', years:'वर्षे' }
function translateDays(days, lang) {
  if (!days) return '—'
  if (lang === 'en') return days
  const m = String(days).match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)\s*$/i)
  if (!m) return days  // unrecognized format → show as-is (don't break custom durations)
  const map = lang === 'hi' ? DAYS_UNIT_HI : lang === 'mr' ? DAYS_UNIT_MR : null
  if (!map) return days
  return `${m[1]} ${map[m[2].toLowerCase()] || m[2]}`
}

export default function ViewPrescriptionPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user }  = useAuthStore()
  const [rx, setRx]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang]   = useState('en')
  const [cfg, setCfg]     = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/prescriptions/${id}`),
      api.get('/page-design?type=prescription'),
    ]).then(([rxRes, cfgRes]) => {
      setRx(rxRes.data.data)
      setLang(rxRes.data.data.printLang || 'en')
      if (cfgRes.data.data?.config) setCfg(cfgRes.data.data.config)
    }).catch(() => navigate('/prescriptions'))
    .finally(() => setLoading(false))
  }, [id])

  // If URL has ?print=1, open the print dialog once the page has rendered.
  // Then strip the param so refreshing doesn't re-open the dialog.
  useEffect(() => {
    if (loading || !rx) return
    if (searchParams.get('print') !== '1') return
    const t = setTimeout(() => {
      window.print()
      searchParams.delete('print')
      setSearchParams(searchParams, { replace: true })
    }, 400)  // let fonts/images render first
    return () => clearTimeout(t)
  }, [loading, rx])

  // Shorthand: show(key) returns true if cfg doesn't explicitly disable it
  const show = (key) => cfg ? (cfg[key] !== false) : true

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  if (!rx) return null

  const clinic  = user?.clinic
  const doctor  = rx.doctor
  const patient = rx.patient
  const canEdit = ['DOCTOR','ADMIN'].includes(user?.role)

  // Complaint & Diagnosis — stored as "tag1 || tag2"
  const complaints = rx.complaint ? rx.complaint.split('||').map(s=>s.trim()).filter(Boolean) : []
  const diagnoses  = rx.diagnosis ? rx.diagnosis.split('||').map(s=>s.trim()).filter(Boolean) : []
  const adviceList = rx.advice    ? rx.advice.split('\n').filter(Boolean) : []

  // ── Language labels — ONLY timing translates, rest stays English ──
  // Labels for headings/fields stay English regardless of lang
  const t = {
    date:'Date', patient:'Patient', age:'Age', gender:'Gender',
    complaint:'CHIEF COMPLAINT', diagnosis:'DIAGNOSIS',
    medicine:'MEDICINE', dosage:'DOSAGE', days:'DURATION', timing:'TIMING', qty:'QTY',
    labTests:'LAB TESTS', advice:'ADVICE & PRECAUTIONS', nextVisit:'Next Visit',
    sign:'Signature', medicines:'MEDICINES',
    // Only Patient label row changes for Hindi/Marathi
    patientLabel: 'Patient:',
    ageLabel:     'Age:',
    genderLabel:  'Gender:',
    dateLabel:    'Date',
    nextVisitLabel: 'Next Visit:',
  }

  return (
    <div className="fade-in">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/prescriptions')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="page-title">{rx.rxNo}</h1>
            <p className="page-subtitle">{patient?.name} • {format(new Date(rx.date),'dd MMM yyyy')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Print in:</label>
            <select className="form-select w-32 text-sm" value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
            </select>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" icon={<Edit className="w-4 h-4"/>}
              onClick={()=>navigate(`/prescriptions/${id}/edit`)}>
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<Receipt className="w-4 h-4"/>}
            onClick={()=>navigate(`/billing/new?patientId=${patient?.id}&prescriptionId=${rx.id}`)}>
            Create Bill
          </Button>
          <Button variant="primary" icon={<Printer className="w-4 h-4"/>} onClick={()=>window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* ── Print area ── */}
      <div className={`bg-white rounded-2xl shadow-card border border-blue-50 p-8 max-w-3xl mx-auto print-area ${cfg?.baseFontSize==='sm'?'text-sm':cfg?.baseFontSize==='lg'?'text-lg':''}`} style={{fontFamily:cfg?.fontFamily==='serif'?'Georgia,serif':cfg?.fontFamily==='mono'?'monospace':'inherit'}}>

        {/* Clinic header */}
        <div className={`pb-4 mb-5 ${show('headerBorder')?'border-b-2':''}`}
          style={{borderColor: cfg?.primaryColor||'#1565C0'}}>
          <div className="flex items-start justify-between">
            <div>
              {show('showClinicName')    && <h1 className="text-2xl font-bold" style={{color:cfg?.primaryColor||'#1565C0'}}>{clinic?.name||'PulseDesk Clinic'}</h1>}
              {show('showClinicTagline') && clinic?.tagline && <p className="text-sm text-slate-500 italic">{clinic.tagline}</p>}
              {show('showClinicAddress') && clinic?.address && <p className="text-xs text-slate-400 mt-1">{clinic.address}</p>}
              {show('showClinicPhone')   && (clinic?.phone||clinic?.mobile) && <p className="text-xs text-slate-400">📞 {clinic?.mobile||clinic?.phone}</p>}
            </div>
            <div className="text-right">
              {show('showDoctorName')  && <p className="font-bold text-slate-700">{doctor?.name}</p>}
              {show('showDoctorQual')  && doctor?.qualification  && <p className="text-sm text-slate-500">{doctor.qualification}</p>}
              {show('showDoctorSpec')  && doctor?.specialization && <p className="text-sm text-slate-500">{doctor.specialization}</p>}
              {show('showDoctorRegNo') && doctor?.regNo          && <p className="text-xs text-slate-400">Reg. No: {doctor.regNo}</p>}
            </div>
          </div>
        </div>

        {/* Patient info + date */}
        <div className="flex justify-between items-start mb-5 gap-4">
          <div className="flex-1 bg-background rounded-xl p-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              {show('showPatient') && <><span className="text-slate-400">{t.patientLabel}</span><span className="font-semibold text-slate-800">{patient?.name}</span></>}
              {show('showAge')     && <><span className="text-slate-400">{t.ageLabel}</span><span className="font-medium">{patient?.age} yrs</span></>}
              {show('showGender')  && <><span className="text-slate-400">{t.genderLabel}</span><span className="font-medium">{patient?.gender}</span></>}
              {show('showAllergy') && patient?.allergies?.length>0 && <>
                <span className="text-danger font-semibold text-xs">⚠ Allergy:</span>
                <span className="text-danger text-xs">{patient.allergies.join(', ')}</span>
              </>}
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-400">{t.dateLabel}</p>
            <p className="font-bold text-slate-700">{format(new Date(rx.date),'dd / MM / yyyy')}</p>
            {show('showRxNo') && <p className="text-xs text-slate-400 mt-1 font-mono">{rx.rxNo}</p>}
          </div>
        </div>

        {/* Complaint */}
        {show('showComplaint') && complaints.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">CHIEF COMPLAINT</p>
            <div className="flex flex-wrap gap-1.5">
              {complaints.map((c,i) => (
                <span key={i} className="text-sm font-medium text-slate-700 bg-blue-50/60 px-2.5 py-0.5 rounded-lg">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Diagnosis */}
        {show('showDiagnosis') && diagnoses.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">DIAGNOSIS</p>
            <div className="flex flex-wrap gap-1.5">
              {diagnoses.map((d,i) => (
                <span key={i} className="text-sm font-medium text-slate-700 bg-orange-50 px-2.5 py-0.5 rounded-lg">{d}</span>
              ))}
            </div>
          </div>
        )}

        {/* Medicines */}
        {show('showMedicines') && rx.medicines?.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl font-bold text-primary italic">℞</span>
              <span className="font-semibold text-slate-600 uppercase text-xs tracking-wider">MEDICINES</span>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-left py-2 px-2 text-xs text-slate-400 font-semibold uppercase">#</th>
                  <th className="text-left py-2 px-2 text-xs text-slate-400 font-semibold uppercase">MEDICINE</th>
                  {show('showDosage')    && <th className="text-center py-2 px-2 text-xs text-slate-400 font-semibold uppercase">DOSAGE</th>}
                  {show('showWhen')      && <th className="text-center py-2 px-2 text-xs text-slate-400 font-semibold uppercase">TIMING</th>}
                  {show('showFrequency') && <th className="text-center py-2 px-2 text-xs text-slate-400 font-semibold uppercase">FREQ.</th>}
                  {show('showDays')      && <th className="text-center py-2 px-2 text-xs text-slate-400 font-semibold uppercase">DURATION</th>}
                  {show('showQty')       && <th className="text-center py-2 px-2 text-xs text-slate-400 font-semibold uppercase">QTY</th>}
                </tr>
              </thead>
              <tbody>
                {rx.medicines.map((med, idx) => (
                  <tr key={med.id} className={`border-b border-slate-50 ${idx%2===0?'':'bg-slate-50/50'}`}>
                    <td className="py-2.5 px-2 text-slate-400 text-xs">{idx+1}</td>
                    <td className="py-2.5 px-2">
                      <p className={show('medicineNameBold')?'font-semibold text-slate-800':'text-slate-800'}>{med.medicineName}</p>
                      {show('showNotes') && med.notesEn && (
                        <p className="text-xs text-slate-400 mt-0.5">{translateNote(med.notesEn, lang)}</p>
                      )}
                    </td>
                    {show('showDosage')    && <td className="py-2.5 px-2 text-center font-mono text-slate-700">{med.dosage||'—'}</td>}
                    {show('showWhen')      && <td className="py-2.5 px-2 text-center text-xs text-slate-600">{med.timing ? getTimingLabel(med.timing, lang) : '—'}</td>}
                    {show('showFrequency') && <td className="py-2.5 px-2 text-center text-xs text-slate-600">{getFrequencyLabel(med.frequency, lang)}</td>}
                    {show('showDays')      && <td className="py-2.5 px-2 text-center text-slate-700">{translateDays(med.days, lang)}</td>}
                    {show('showQty')       && <td className="py-2.5 px-2 text-center font-bold" style={{color:cfg?.primaryColor||'#1565C0'}}>{med.qty||'—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {show('showLabTests') && rx.labTests?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">LAB TESTS</p>
            <div className="flex flex-wrap gap-2">
              {rx.labTests.map(lt => (
                <span key={lt.id} className="bg-blue-50 border border-blue-100 text-primary text-sm px-3 py-1 rounded-lg font-medium">{lt.labTestName}</span>
              ))}
            </div>
          </div>
        )}

        {show('showAdvice') && adviceList.length > 0 && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">ADVICE & PRECAUTIONS</p>
            <ul className="space-y-1">
              {adviceList.map((a,i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">•</span>{a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {show('showNextVisit') && rx.nextVisit && (
          <div className="mb-5 flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary"/>
            <span className="text-slate-500">{t.nextVisitLabel}</span>
            <span className="font-bold text-primary">{format(new Date(rx.nextVisit),'dd MMMM yyyy')}</span>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-end mt-6">
{show('showGeneratedBy') && <div className="text-xs text-slate-400"><p>Generated by PulseDesk</p><p>{format(new Date(rx.date),'dd MMM yyyy, hh:mm a')}</p></div>}
          <div className="text-right">
            <div className="w-32 border-b border-slate-300 mb-1 h-8"></div>
{show('showSignature') && <><p className="text-xs font-semibold text-slate-600">{doctor?.name}</p><p className="text-xs text-slate-400">Signature</p></>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}

const NON_TABLET_TYPES = ['liquid','drops','cream','inhaler','injection','powder']
