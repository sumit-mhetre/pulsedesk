import { useEffect, useState, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer, Edit, Receipt } from 'lucide-react'
import { Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'
import { usePrintTitle } from '../../hooks/usePrintTitle'
import { buildPrintTitle } from '../../lib/slug'

// Only timing translates — everything else stays English
// Notes translation for liquids/drops (Marathi)
const LIQUID_NOTES_EN = ['5ml twice daily','5ml thrice daily','2.5ml twice daily','10ml twice daily','2 drops twice daily','2 drops thrice daily','1 teaspoon thrice daily','2 teaspoons twice daily','As directed','Apply thin layer twice daily']
const LIQUID_NOTES_MR = ['दिवसातून 2 वेळा 5ml','दिवसातून 3 वेळा 5ml','दिवसातून 2 वेळा 2.5ml','दिवसातून 2 वेळा 10ml','दिवसातून 2 वेळा 2 थेंब','दिवसातून 3 वेळा 2 थेंब','दिवसातून 3 वेळा 1 चमचा','दिवसातून 2 वेळा 2 चमचे','सांगितल्याप्रमाणे','दिवसातून 2 वेळा पातळ थर लावा']
const LIQUID_NOTES_HI = ['दिन में 2 बार 5ml','दिन में 3 बार 5ml','दिन में 2 बार 2.5ml','दिन में 2 बार 10ml','दिन में 2 बार 2 बूंद','दिन में 3 बार 2 बूंद','दिन में 3 बार 1 चम्मच','दिन में 2 बार 2 चम्मच','निर्देशानुसार','दिन में 2 बार पतली परत लगाएं']

// Pretty-print a dosage string for the printed Rx.
// Returns a React node so fractions (½, ¾, ¼) can be rendered larger - they
// otherwise look much smaller than the surrounding digits in most fonts.
//
// Doctors type free-form values like "1-0-1", "0.5-0-0.5", "1/2-0-1/2",
// "1-1/2-1" (mixed). On print we want them to look polished:
//   1-0-1            -> 1 — 0 — 1
//   0.5-0-0.5        -> ½ — 0 — ½  (fractions rendered larger)
//   1/2-0-1/2        -> ½ — 0 — ½
//   3/4-0-1/4        -> ¾ — 0 — ¼
//   1.5-0-1.5        -> 1½ — 0 — 1½
//   3/8-0-3/8        -> 3/8 — 0 — 3/8  (no Unicode glyph available, leave as text)
//   OD / BD / SOS    -> OD / BD / SOS  (codes left untouched)
function formatDosageForPrint(raw) {
  if (!raw) return raw
  const s = String(raw).trim()
  if (!s) return raw
  // Frequency codes - leave alone
  if (/^(OD|BD|TDS|QID|HS|SOS|STAT|PRN)$/i.test(s)) return s.toUpperCase()
  // Only reformat hyphen-separated dose-pieces. Anything else (free text)
  // stays as-typed.
  if (!s.includes('-')) return renderPiece(prettyPiece(s))
  const parts = s.split('-').map(p => prettyPiece(p.trim()))
  // Em-dash separator with spaces, matches the sample print.
  // Use React fragment so each piece can be individually styled.
  const out = []
  parts.forEach((p, i) => {
    if (i > 0) out.push(<span key={`sep-${i}`}>{' \u2014 '}</span>)
    out.push(<span key={`p-${i}`}>{renderPiece(p)}</span>)
  })
  return <>{out}</>
}

// Wrap unicode fraction glyphs in a larger span so they don't look tiny next
// to plain digits. Mixed values like "1½" get the whole-number plain and the
// fraction part bumped.
function renderPiece(p) {
  if (!p) return p
  // Single-glyph fractions
  if (/^[½¼¾⅓⅔⅛⅜⅝⅞]$/.test(p)) {
    return <span style={{ fontSize: '1.4em', lineHeight: '1', verticalAlign: '-0.05em' }}>{p}</span>
  }
  // Mixed like "1½" / "2¼" / "3¾"
  const m = p.match(/^(\d+)([½¼¾⅓⅔⅛⅜⅝⅞])$/)
  if (m) {
    return <>{m[1]}<span style={{ fontSize: '1.4em', lineHeight: '1', verticalAlign: '-0.05em' }}>{m[2]}</span></>
  }
  return p
}

// Pretty-print ONE piece of the hyphenated dosage (e.g. "1", "0.5", "1/2").
function prettyPiece(p) {
  if (!p) return p
  // Already a unicode glyph
  if (/^[½¼¾⅓⅔⅛⅜⅝⅞]$/.test(p)) return p
  // Decimal -> fraction glyph if exact match
  const dec = parseFloat(p)
  if (!isNaN(dec) && p === dec.toString()) {
    if (dec === 0)    return '0'
    if (dec === 0.5)  return '½'
    if (dec === 0.25) return '¼'
    if (dec === 0.75) return '¾'
    // Mixed: 1.5 -> 1½, 2.5 -> 2½, 1.25 -> 1¼, etc.
    const whole = Math.floor(dec)
    const frac  = dec - whole
    if (whole > 0) {
      if (frac === 0.5)  return `${whole}½`
      if (frac === 0.25) return `${whole}¼`
      if (frac === 0.75) return `${whole}¾`
    }
    return p
  }
  // Fraction like "1/2", "3/4", "1/4"
  const m = p.match(/^(\d+)\/(\d+)$/)
  if (m) {
    const num = parseInt(m[1], 10), den = parseInt(m[2], 10)
    if (den === 0) return p
    const FR_GLYPH = { '1/2':'½', '1/4':'¼', '3/4':'¾', '1/3':'⅓', '2/3':'⅔', '1/8':'⅛', '3/8':'⅜', '5/8':'⅝', '7/8':'⅞' }
    return FR_GLYPH[`${num}/${den}`] || p
  }
  return p
}

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

// Line-spacing dropdown → numeric line-height multiplier
function lineHeightFor(mode) {
  switch (mode) {
    case 'tight':       return 1.2
    case 'comfortable': return 1.75
    case 'airy':        return 2.0
    case 'normal':
    default:            return 1.5
  }
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
  // Rx-form config holds custom field definitions (id → name) and the doctor's
  // preferred section order. Loaded alongside the print-only cfg so we can both
  // render custom field labels and apply the same section ordering on the print.
  const [rxFormCfg, setRxFormCfg] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/prescriptions/${id}`),
      api.get('/page-design?type=prescription'),
      api.get('/page-design?type=rx_form').catch(() => ({ data: { data: null } })),
    ]).then(([rxRes, cfgRes, rxFormRes]) => {
      setRx(rxRes.data.data)
      setLang(rxRes.data.data.printLang || 'en')
      if (cfgRes.data.data?.config) setCfg(cfgRes.data.data.config)
      if (rxFormRes.data?.data?.config) setRxFormCfg(rxFormRes.data.data.config)
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

  // PDF/print filename: "Prescription_<rxNo>_<patientCode>_<patient-name>".
  // Replaces the default browser title (which would otherwise be the URL or
  // "SimpleRx EMR") so when the user does Ctrl+P -> Save as PDF, the suggested
  // filename is meaningful instead of a UUID slug.
  usePrintTitle(rx ? buildPrintTitle('Prescription', {
    id:   rx.rxNo || rx.id,
    code: rx.patient?.patientCode,
    name: rx.patient?.name,
  }) : null)

  // Shorthand: show(key) returns true if cfg doesn't explicitly disable it
  const show = (key) => cfg ? (cfg[key] !== false) : true
  // Compact print: combine Timing - Freq. - Duration into one column. Default true.
  const compactPrint = cfg ? (cfg.compactPrint !== false) : true

  // Build section order map from rx_form config. Falls back to default order.
  // Used as inline `order:` CSS on each body section so the printed Rx matches
  // the order the doctor configured for the writing form.
  const __DEFAULT_ORDER = ['complaint', 'diagnosis', 'vitals', 'medicines', 'labTests', 'advice', 'nextVisit']
  const rxOrderMap = (() => {
    const order = (rxFormCfg && Array.isArray(rxFormCfg.fieldOrder) && rxFormCfg.fieldOrder.length > 0)
      ? rxFormCfg.fieldOrder
      : __DEFAULT_ORDER
    const map = {}
    order.forEach((k, i) => { map[k] = i + 1 })
    return map
  })()
  // Custom fields (configured by clinic) — array of { id, name, type }
  const rxCustomFields = (rxFormCfg && Array.isArray(rxFormCfg.customFields))
    ? rxFormCfg.customFields.filter(cf => cf && cf.id && (cf.name || '').trim())
    : []
  // Per-row values entered on this prescription
  const rxCustomData = (rx && rx.customData && typeof rx.customData === 'object') ? rx.customData : {}

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

  // Day-of-week names per print language. Index 0 = Sunday (matches Date.getDay()).
  // We surface the day name on the printed Next Visit so doctors can call it out
  // verbally when handing the Rx to the patient. Months stay English for now.
  const DAY_NAMES = {
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  }
  const dayNameFor = (date, lng) => {
    const names = DAY_NAMES[lng] || DAY_NAMES.en
    return names[date.getDay()]
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
      <div className={`relative bg-white rounded-2xl shadow-card border border-blue-50 p-6 max-w-3xl mx-auto print-area ${cfg?.baseFontSize==='sm'?'text-sm':cfg?.baseFontSize==='lg'?'text-lg':''}`} style={{
        fontFamily: cfg?.fontFamily==='serif'?'Georgia,serif':cfg?.fontFamily==='mono'?'monospace':'inherit',
        lineHeight: lineHeightFor(cfg?.lineSpacing),
      }}>

        {/* Letterhead background — covers the entire print area */}
        {clinic?.letterheadMode && clinic?.letterheadUrl && (
          <img
            src={clinic.letterheadUrl}
            alt="letterhead"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-2xl"
            style={{ zIndex: 0 }}
          />
        )}

        <div className="relative" style={{ zIndex: 1 }}>

        {/* Header banner — full-width image. Replaces the text header below if uploaded.
            When letterhead mode is ON, the entire letterhead image already serves as the page bg,
            so we skip BOTH the banner and the text header. */}
        {!clinic?.letterheadMode && clinic?.headerImageUrl && (
          <div className={`mb-3 ${show('headerBorder')?'border-b-2 border-slate-400 pb-2':''}`}>
            <img
              src={clinic.headerImageUrl}
              alt="header"
              className="w-full object-contain"
              style={{ maxHeight: 140 }}
            />
          </div>
        )}

        {/* Text-based clinic header — shown when:
            - letterhead mode is OFF, AND
            - header banner is missing OR hideTextOnHeader is OFF (user wants both image + text) */}
        {!clinic?.letterheadMode && (!clinic?.headerImageUrl || !clinic?.hideTextOnHeader) && (
        <div className={`pb-2 mb-3 ${show('headerBorder')?'border-b-2 border-slate-400':''}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Clinic logo (only when no header banner is taking its place) */}
              {show('showLogo') && clinic?.logo && !clinic?.headerImageUrl && (
                <img src={clinic.logo} alt="logo" className="w-16 h-16 object-contain flex-shrink-0"/>
              )}
              <div className="min-w-0">
                {show('showClinicName')    && <h1 className="text-xl font-bold text-slate-900 print:text-black" style={{color:cfg?.primaryColor||undefined}}>{clinic?.name||'SimpleRx EMR'}</h1>}
                {show('showClinicTagline') && clinic?.tagline && <p className="text-xs text-slate-600 italic">{clinic.tagline}</p>}
                {show('showClinicAddress') && clinic?.address && <p className="text-xs text-slate-600">{clinic.address}</p>}
                {show('showClinicPhone')   && (clinic?.phone||clinic?.mobile) && <p className="text-xs text-slate-600">Phone: {clinic?.mobile||clinic?.phone}</p>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {show('showDoctorName')  && <p className="font-bold text-slate-900">{doctor?.name}</p>}
              {show('showDoctorQual')  && doctor?.qualification  && <p className="text-xs text-slate-700">{doctor.qualification}</p>}
              {show('showDoctorSpec')  && doctor?.specialization && <p className="text-xs text-slate-700">{doctor.specialization}</p>}
              {show('showDoctorRegNo') && doctor?.regNo          && <p className="text-xs text-slate-600">Reg. No: {doctor.regNo}</p>}
            </div>
          </div>
        </div>
        )}

        {/* Spacer — paddingTop after header (custom mm-to-px conversion: 1mm ≈ 3.78px) */}
        <div style={{ height: `${(cfg?.paddingTop ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Patient info + date — inline, no background */}
        {/*
            Layout (per client's prescription pad):
              [BOLD OPD code]   Name (age, gender) - phone                        Date: 25-Apr-2026
            All parts honor toggles in Settings → Layout Designer → Patient Details.
        */}
        <div className="mb-3 border-b border-slate-300 pb-3 text-sm flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {/* OPD / patient code — bold, leads the line */}
          {show('showOPD') && patient?.patientCode && (
            <span className="font-bold text-slate-900 print:text-black tracking-wide">
              {patient.patientCode}
            </span>
          )}
          {/* Single combined patient line — name + (age, gender) + phone */}
          {show('showPatient') && (
            <span className="font-semibold text-slate-900">
              {patient?.name}
              {(show('showAge') || show('showGender')) && (patient?.age != null || patient?.gender) && (
                <span className="font-normal text-slate-700">
                  {' '}({[
                    show('showAge')    && patient?.age    != null ? `${patient.age} yrs` : null,
                    show('showGender') && patient?.gender ? patient.gender : null,
                  ].filter(Boolean).join(', ')})
                </span>
              )}
              {show('showPhone') && patient?.phone && (
                <span className="text-slate-700"> - {patient.phone}</span>
              )}
            </span>
          )}
          {/* Date right-aligned */}
          <span className="ml-auto text-right">
            <span className="text-slate-500">{t.dateLabel}: </span>
            <span className="font-semibold text-slate-900">{format(new Date(rx.date),'dd-MMM-yyyy')}</span>
          </span>
        </div>

        {/* Optional contact / medical info row — only renders if any toggle is ON and field has data */}
        {(() => {
          const bits = []
          if (cfg?.showEmail       && patient?.email)      bits.push(<><span className="text-slate-500">Email:</span> {patient.email}</>)
          if (cfg?.showAddress     && patient?.address)    bits.push(<><span className="text-slate-500">Address:</span> {patient.address}</>)
          if (cfg?.showBloodGroup  && patient?.bloodGroup) bits.push(<><span className="text-slate-500">Blood Group:</span> <span className="font-semibold">{patient.bloodGroup}</span></>)
          if (!bits.length) return null
          return (
            <div className="mb-3 -mt-1 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-0.5">
              {bits.map((b, i) => <span key={i}>{b}</span>)}
            </div>
          )
        })()}

        {/* Chronic conditions */}
        {cfg?.showChronicConditions && patient?.chronicConditions?.length > 0 && (
          <p className="mb-3 text-sm">
            <span className="font-bold">Chronic Conditions:</span>{' '}
            <span className="text-slate-800">{patient.chronicConditions.join(', ')}</span>
          </p>
        )}

        {show('showAllergy') && patient?.allergies?.length>0 && (
          <p className="mb-3 text-sm"><span className="font-bold">⚠ Allergy:</span> {patient.allergies.join(', ')}</p>
        )}

        {/* Body sections — wrapped in a flex-col so the doctor's saved fieldOrder
            (from the rx_form config) drives the printed sequence. */}
        <div className="flex flex-col">
        {/* Complaint — inline */}
        {show('showComplaint') && complaints.length > 0 && (
          <p className="mb-1.5 text-sm" style={{ order: rxOrderMap.complaint }}><span className="font-bold text-slate-900">Chief Complaint:</span> <span className="text-slate-800">{complaints.join(', ')}</span></p>
        )}

        {/* Diagnosis — inline */}
        {show('showDiagnosis') && diagnoses.length > 0 && (
          <p className="mb-1.5 text-sm" style={{ order: rxOrderMap.diagnosis }}><span className="font-bold text-slate-900">Diagnosis:</span> <span className="text-slate-800">{diagnoses.join(', ')}</span></p>
        )}

        {/* Vitals — snapshot stored on the Rx itself (rx.vitals). Only renders if the
            doctor entered any values AND the print toggle is on. Format is compact:
            "BP 120/80 • Sugar 110 • Weight 72 kg" — semicolon-style for one-liner.
            The order key matches the form's `vitals` slot. */}
        {show('showVitals') && rx.vitals && typeof rx.vitals === 'object' && (() => {
          const v = rx.vitals
          const parts = []
          // BP can be in two forms: combined "120/80" or split systolicBP/diastolicBP
          const sys = String(v.systolicBP || '').trim()
          const dia = String(v.diastolicBP || '').trim()
          const bpCombined = String(v.bp || '').trim()
          if (sys && dia)        parts.push(`BP ${sys}/${dia}`)
          else if (bpCombined)   parts.push(`BP ${bpCombined}`)
          if (String(v.pulse  || '').trim()) parts.push(`Pulse ${v.pulse} bpm`)
          if (String(v.temp   || '').trim()) parts.push(`Temp ${v.temp}°F`)
          if (String(v.spo2   || '').trim()) parts.push(`SpO₂ ${v.spo2}%`)
          if (String(v.sugar  || '').trim()) parts.push(`Sugar ${v.sugar} mg/dL`)
          if (String(v.weight || '').trim()) parts.push(`Weight ${v.weight} kg`)
          if (String(v.height || '').trim()) {
            const unit = v.heightUnit || 'cm'
            parts.push(`Height ${v.height} ${unit}`)
          }
          if (String(v.bmi    || '').trim()) parts.push(`BMI ${v.bmi}`)
          if (parts.length === 0) return null
          return (
            <p className="mb-1.5 text-sm" style={{ order: rxOrderMap.vitals }}>
              <span className="font-bold text-slate-900">Vitals:</span>{' '}
              <span className="text-slate-800">{parts.join(' • ')}</span>
            </p>
          )
        })()}

        {/* Medicines */}
        {/* Medicines section — always rendered if any medicines exist (locked-on in PageDesigner). */}
        {rx.medicines?.length > 0 && (
          <div className="mb-4" style={{ order: rxOrderMap.medicines }}>
            <div className="flex items-center gap-2 mb-1.5">
              {show('showRxSymbol') && <span className="text-xl font-bold italic" style={{color:cfg?.primaryColor||'#000'}}>℞</span>}
              <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">Medicines</span>
            </div>
            <table className="rx-medicines-table w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300 w-8">#</th>
                  <th className="text-left py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Medicine</th>
                  {show('showDosage') && <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Dosage</th>}
                  {compactPrint ? (
                    (show('showWhen') || show('showFrequency') || show('showDays')) && (
                      <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">
                        {[show('showWhen') && 'Timing', show('showFrequency') && 'Freq.', show('showDays') && 'Duration'].filter(Boolean).join(' - ')}
                      </th>
                    )
                  ) : (
                    <>
                      {show('showWhen')      && <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Timing</th>}
                      {show('showFrequency') && <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Freq.</th>}
                      {show('showDays')      && <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Duration</th>}
                    </>
                  )}
                  {show('showQty') && <th className="text-center py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300 w-14">Qty</th>}
                  {cfg?.notesAsColumn && show('showNotes') && (
                    <th className="text-left py-1.5 px-2 text-xs text-slate-700 font-bold uppercase border-b-2 border-slate-300">Notes</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rx.medicines.map((med, idx) => {
                  const parts = []
                  if (show('showWhen'))      parts.push(med.timing ? getTimingLabel(med.timing, lang) : '—')
                  if (show('showFrequency')) parts.push(getFrequencyLabel(med.frequency, lang))
                  if (show('showDays'))      parts.push(translateDays(med.days, lang))
                  const combinedCell = parts.join(' - ')

                  // ── HealthPlix-style two-row layout. The brand name + dosage + timing
                  // sit on the first row. Below it, a SECOND row spans across the
                  // remaining columns (everything except #) so long generic names like
                  // "Ambroxol (30mg/5ml) + Levosalbutamol (1mg/5ml) + Guaifenesin..."
                  // fit on a single line without wrapping awkwardly inside a narrow
                  // Medicine cell.
                  const hasGeneric     = show('showGeneric') && med.genericName
                  const hasNotesBelow  = show('showNotes')   && med.notesEn && !cfg?.notesAsColumn
                  const hasSecondRow   = hasGeneric || hasNotesBelow

                  // Count visible columns to compute colSpan for the second row.
                  // Row separator (border-b) goes on the LAST row of each medicine.
                  let visibleCols = 2 // # + Medicine
                  if (show('showDosage')) visibleCols++
                  if (compactPrint) {
                    if (show('showWhen') || show('showFrequency') || show('showDays')) visibleCols++
                  } else {
                    if (show('showWhen'))      visibleCols++
                    if (show('showFrequency')) visibleCols++
                    if (show('showDays'))      visibleCols++
                  }
                  if (show('showQty')) visibleCols++
                  if (cfg?.notesAsColumn && show('showNotes')) visibleCols++
                  const genericColSpan = visibleCols - 1 // skip # column

                  // Brand-row cells get the bottom border ONLY when there's no second row.
                  // When there IS a second row, the second row carries the separator.
                  const brandBorder = hasSecondRow ? '' : 'border-b border-slate-100'

                  return (
                    <Fragment key={med.id}>
                      <tr>
                        <td className={`py-1.5 px-2 text-slate-700 text-xs align-top ${brandBorder}`}>{idx+1}</td>
                        <td className={`pt-1.5 ${hasSecondRow ? 'pb-0.5' : 'pb-1.5'} px-2 align-top ${brandBorder}`}>
                          <p className={show('medicineNameBold')?'font-bold text-slate-900':'text-slate-900'}>{med.medicineName}</p>
                        </td>
                        {show('showDosage') && <td className={`py-1.5 px-2 text-center font-mono text-slate-800 align-top ${brandBorder}`}>{med.dosage ? formatDosageForPrint(med.dosage) : '—'}</td>}
                        {compactPrint ? (
                          (show('showWhen') || show('showFrequency') || show('showDays')) && (
                            <td className={`py-1.5 px-2 text-center text-xs text-slate-800 align-top ${brandBorder}`}>{combinedCell}</td>
                          )
                        ) : (
                          <>
                            {show('showWhen')      && <td className={`py-1.5 px-2 text-center text-xs text-slate-800 align-top ${brandBorder}`}>{med.timing ? getTimingLabel(med.timing, lang) : '—'}</td>}
                            {show('showFrequency') && <td className={`py-1.5 px-2 text-center text-xs text-slate-800 align-top ${brandBorder}`}>{getFrequencyLabel(med.frequency, lang)}</td>}
                            {show('showDays')      && <td className={`py-1.5 px-2 text-center text-slate-800 align-top ${brandBorder}`}>{translateDays(med.days, lang)}</td>}
                          </>
                        )}
                        {show('showQty') && <td className={`py-1.5 px-2 text-center font-bold text-slate-900 align-top ${brandBorder}`}>{med.qty||'—'}</td>}
                        {cfg?.notesAsColumn && show('showNotes') && (
                          <td className={`py-1.5 px-2 text-xs text-slate-700 align-top ${brandBorder}`}>{med.notesEn ? translateNote(med.notesEn, lang) : '—'}</td>
                        )}
                      </tr>
                      {hasSecondRow && (
                        <tr>
                          <td className="border-b border-slate-100"></td>
                          <td colSpan={genericColSpan} className="pt-0 pb-2 px-2 align-top border-b border-slate-100">
                            {hasGeneric && (
                              <p className="text-xs text-slate-700 italic">{med.genericName}</p>
                            )}
                            {hasNotesBelow && (
                              <p className={`text-xs text-slate-600 italic ${hasGeneric ? 'mt-0.5' : ''}`}>{translateNote(med.notesEn, lang)}</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {show('showLabTests') && rx.labTests?.length > 0 && (
          <p className="mb-1.5 text-sm" style={{ order: rxOrderMap.labTests }}><span className="font-bold text-slate-900">Lab Tests:</span> <span className="text-slate-800">{rx.labTests.map(lt => lt.labTestName).join(', ')}</span></p>
        )}

        {/* Test Outcomes — recorded lab values rendered as a table with date columns.
            Each (testName × resultDate) is one stored row; values may be a structured
            list (CBC sub-fields) or a single freeTextResult (Peripheral Smear, etc.).
            Out-of-range values are bolded so paper prints stay readable in B/W.
            Hidden when no results recorded — gating flag won't show an empty section. */}
        {show('showLabResults') && rx.labResults?.length > 0 && (() => {
          // Unique result dates, newest-first (matches the entry modal's column order)
          const dates = Array.from(new Set(rx.labResults.map(r => r.resultDate)))
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

          // Group results by category → labTest. Use labTestId when present,
          // otherwise fall back to testName so free-text outcomes still group cleanly.
          const groups = new Map()
          for (const r of rx.labResults) {
            const cat = r.testCategory || 'Other'
            const testKey = r.labTestId || `name:${r.testName}`
            if (!groups.has(cat)) groups.set(cat, new Map())
            const testsInCat = groups.get(cat)
            if (!testsInCat.has(testKey)) {
              testsInCat.set(testKey, { testName: r.testName, rowsByDate: {} })
            }
            testsInCat.get(testKey).rowsByDate[r.resultDate] = r
          }

          // For a single test, collect the unique field metadata across all its dates.
          // (Different visits may record different sub-fields — union them all.)
          const collectFields = (test) => {
            const fieldMap = new Map()
            let hasFreeText = false
            for (const date of Object.keys(test.rowsByDate)) {
              const row = test.rowsByDate[date]
              if (row.freeTextResult && String(row.freeTextResult).trim()) hasFreeText = true
              for (const v of (row.values || [])) {
                if (!fieldMap.has(v.fieldKey)) {
                  fieldMap.set(v.fieldKey, {
                    label: v.fieldLabel,
                    unit:  v.fieldUnit,
                    normalLow:  v.normalLow,
                    normalHigh: v.normalHigh,
                  })
                }
              }
            }
            return { fields: Array.from(fieldMap.entries()), hasFreeText }
          }

          // Treat numeric values outside [normalLow, normalHigh] as out of range. Non-numeric
          // values (e.g. "Negative", "Reactive") are skipped — no false-positive bolding.
          const isOutOfRange = (value, low, high) => {
            if (value == null || value === '') return false
            const n = parseFloat(value)
            if (Number.isNaN(n)) return false
            if (typeof low  === 'number' && n < low)  return true
            if (typeof high === 'number' && n > high) return true
            return false
          }

          return (
            <div className="mb-3 text-sm" style={{ order: rxOrderMap.labTests }}>
              <p className="font-bold text-slate-900 mb-1.5">{t.labTests === 'LAB TESTS' ? 'TEST OUTCOMES' : 'Test Outcomes'}</p>
              <table className="w-full border-collapse text-xs" style={{ pageBreakInside: 'auto' }}>
                <thead>
                  <tr className="border-b-2 border-slate-400">
                    <th className="text-left py-1 px-2 font-semibold text-slate-700"></th>
                    {dates.map(d => (
                      <th key={d} className="text-center py-1 px-2 font-semibold text-slate-700 whitespace-nowrap" style={{ width: `${Math.max(60, Math.floor(180 / dates.length))}px` }}>
                        {format(new Date(d), 'd MMM yyyy')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(groups.entries()).map(([cat, testsMap]) => (
                    <Fragment key={cat}>
                      <tr className="bg-slate-50 print:bg-slate-100">
                        <td colSpan={dates.length + 1} className="py-1 px-2 font-bold text-slate-800 uppercase text-[10px] tracking-wide">
                          {cat}
                        </td>
                      </tr>
                      {Array.from(testsMap.entries()).map(([testKey, test]) => {
                        const { fields, hasFreeText } = collectFields(test)
                        const showTestSubHeader = fields.length > 1
                        return (
                          <Fragment key={testKey}>
                            {showTestSubHeader && (
                              <tr>
                                <td colSpan={dates.length + 1} className="py-0.5 pl-3 pr-2 italic text-slate-600 text-[11px]">
                                  {test.testName}
                                </td>
                              </tr>
                            )}
                            {fields.map(([fieldKey, meta]) => (
                              <tr key={fieldKey} className="border-b border-slate-100">
                                <td className={`py-1 ${showTestSubHeader ? 'pl-5' : 'pl-3'} pr-2 text-slate-800`}>
                                  {meta.label}
                                  {meta.unit && <span className="text-slate-500 ml-1">({meta.unit})</span>}
                                </td>
                                {dates.map(d => {
                                  const row = test.rowsByDate[d]
                                  const v   = row?.values?.find(x => x.fieldKey === fieldKey)?.value
                                  const flag = isOutOfRange(v, meta.normalLow, meta.normalHigh)
                                  return (
                                    <td key={d} className={`py-1 px-2 text-center text-slate-800 ${flag ? 'font-bold' : ''}`}>
                                      {v != null && v !== '' ? v : '—'}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                            {hasFreeText && (
                              <tr className="border-b border-slate-100">
                                <td className={`py-1 ${showTestSubHeader ? 'pl-5' : 'pl-3'} pr-2 text-slate-800`}>
                                  {showTestSubHeader ? 'Result' : test.testName}
                                </td>
                                {dates.map(d => (
                                  <td key={d} className="py-1 px-2 text-center text-slate-800">
                                    {test.rowsByDate[d]?.freeTextResult || '—'}
                                  </td>
                                ))}
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}

        {show('showAdvice') && adviceList.length > 0 && (
          <div className="mb-3 text-sm" style={{ order: rxOrderMap.advice }}>
            <span className="font-bold text-slate-900">Advice:</span>{' '}
            {adviceList.length === 1 ? (
              <span className="text-slate-800">{adviceList[0]}</span>
            ) : (
              <ul className="list-disc pl-6 mt-1 text-slate-800">
                {adviceList.map((a,i) => (<li key={i}>{a}</li>))}
              </ul>
            )}
          </div>
        )}

        {show('showNextVisit') && rx.nextVisit && (() => {
          const d = new Date(rx.nextVisit)
          const dayName = dayNameFor(d, lang)
          const datePart = format(d, 'dd MMMM yyyy')  // e.g. "03 May 2026"
          return (
            <p className="mb-3 text-sm" style={{ order: rxOrderMap.nextVisit }}>
              <span className="font-bold text-slate-900">Next Visit:</span>{' '}
              <span className="text-slate-800">{dayName} {datePart}</span>
            </p>
          )
        })()}

        {/* Custom fields — only those that (a) have a value, (b) are still configured
            by the clinic, AND (c) have their per-field 🖨 print toggle on. The legacy
            master `showCustomFields` toggle still acts as a global kill-switch — if
            it's explicitly false, no custom fields print regardless of per-field flags.
            Per-field flags live in cfg.customFieldPrint = {[cfId]: bool}; default true. */}
        {show('showCustomFields') && rxCustomFields.map(cf => {
          // Per-cf print toggle — defaults to true if not set.
          const cfPrintMap = (cfg && typeof cfg.customFieldPrint === 'object' && cfg.customFieldPrint) || {}
          if (cfPrintMap[cf.id] === false) return null

          const raw = rxCustomData[cf.id]
          // Multi-tag custom fields store arrays. Older Rxs may have a single string
          // from before the upgrade — render either gracefully.
          let display = ''
          if (Array.isArray(raw)) {
            display = raw.map(x => String(x ?? '').trim()).filter(Boolean).join(', ')
          } else if (raw != null && String(raw).trim()) {
            display = String(raw).trim()
          }
          if (!display) return null
          return (
            <p key={cf.id} className="mb-1.5 text-sm" style={{ order: rxOrderMap[cf.id] ?? 999 }}>
              <span className="font-bold text-slate-900">{cf.name}:</span>{' '}
              <span className="text-slate-800">{display}</span>
            </p>
          )
        })}

        </div>{/* end flex-col body sections */}

        {/* Spacer — paddingBottom before footer area */}
        <div style={{ height: `${(cfg?.paddingBottom ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Optional clinic footer image — appears above the signature/watermark row */}
        {show('showFooterImage') && clinic?.footerImageUrl && (
          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-center">
            <img
              src={clinic.footerImageUrl}
              alt="footer"
              className="max-h-16 object-contain"
              style={{ maxWidth: '90%' }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-end mt-6">
          {/* SimpleRx EMR watermark — always shown (locked branding, not user-toggleable) */}
          <div className="text-xs text-slate-400">
            <p>Generated by SimpleRx EMR</p>
            <p>{format(new Date(rx.date),'dd MMM yyyy, hh:mm a')}</p>
          </div>
          <div className="text-right flex items-end gap-3">
            {/* Doctor's stamp/seal — printed beside signature if uploaded */}
            {show('showStampImage') && doctor?.stamp && (
              <img src={doctor.stamp} alt="stamp" className="h-16 w-16 object-contain"/>
            )}
            <div>
              {/* If doctor has uploaded a signature image AND the toggle is on, show it.
                  Otherwise show empty line. */}
              {show('showSignatureImage') && doctor?.signature ? (
                <img src={doctor.signature} alt="signature" className="h-12 ml-auto object-contain mb-1" style={{ maxWidth: 160 }}/>
              ) : (
                <div className="w-32 border-b border-slate-300 mb-1 h-8"></div>
              )}
              {show('showSignature') && <><p className="text-xs font-semibold text-slate-600">{doctor?.name}</p><p className="text-xs text-slate-400">Signature</p></>}
            </div>
          </div>
        </div>
        </div>{/* end relative z-1 layer */}
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
