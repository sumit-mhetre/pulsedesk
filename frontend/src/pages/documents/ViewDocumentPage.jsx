import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer, Edit3, Trash2 } from 'lucide-react'
import { Button, PageHeader, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'

// Line-spacing dropdown → numeric line-height multiplier (mirrors Rx)
function lineHeightFor(mode) {
  switch (mode) {
    case 'tight':       return 1.2
    case 'comfortable': return 1.75
    case 'airy':        return 2.0
    case 'normal':
    default:            return 1.5
  }
}

const TYPE_TITLE = {
  FITNESS_CERT: 'FITNESS CERTIFICATE',
  MEDICAL_CERT: 'MEDICAL CERTIFICATE',
  REFERRAL:     'REFERRAL LETTER',
}

export default function ViewDocumentPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [params]  = useSearchParams()
  const { user } = useAuthStore()
  const canEdit = !!user?.permissions?.createDocuments
  const clinic = user?.clinic

  const [doc, setDoc]     = useState(null)
  const [cfg, setCfg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/documents/${id}`),
      api.get('/page-design?type=rx', { silent: true }).catch(() => null),
    ]).then(([{ data }, pd]) => {
      setDoc(data?.data)
      setCfg(pd?.data?.data?.data?.config || null)
    }).catch(() => {
      toast.error('Certificate not found')
      navigate('/documents')
    }).finally(() => setLoading(false))
  }, [id, navigate])

  // Auto-trigger print when ?print=1
  useEffect(() => {
    if (loading) return
    if (params.get('print') === '1' && doc) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [params, loading, doc])

  const handleDelete = async () => {
    try {
      await api.delete(`/documents/${id}`)
      toast.success('Certificate deleted')
      navigate('/documents')
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  if (!doc) return null

  const doctor   = doc.doctor
  const data     = doc.data || {}
  const show     = (key) => cfg ? (cfg[key] !== false) : true   // mirror Rx defaults

  return (
    <div className="space-y-4">
      {/* Action bar - hidden on print */}
      <div className="print:hidden flex items-center justify-between">
        <PageHeader
          title={TYPE_TITLE[doc.type] || 'Certificate'}
          subtitle={doc.docNo}
          action={<Button variant="ghost" icon={<ArrowLeft className="w-4 h-4"/>} onClick={() => navigate('/documents')}>Back</Button>}
        />
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button variant="outline" icon={<Edit3 className="w-4 h-4"/>}  onClick={() => navigate(`/documents/${id}/edit`)}>Edit</Button>
              <Button variant="outline" icon={<Trash2 className="w-4 h-4"/>} onClick={() => setConfirmDel(true)}>Delete</Button>
            </>
          )}
          <Button variant="primary" icon={<Printer className="w-4 h-4"/>} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* Print area - mirrors Rx layout exactly */}
      <div
        className="relative bg-white rounded-2xl shadow-card border border-blue-50 p-6 max-w-3xl mx-auto print-area"
        style={{ lineHeight: lineHeightFor(cfg?.lineSpacing) }}
      >
        {/* Letterhead bg */}
        {clinic?.letterheadMode && clinic?.letterheadUrl && (
          <img src={clinic.letterheadUrl} alt="letterhead"
               className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-2xl"
               style={{ zIndex: 0 }}/>
        )}

        <div className="relative" style={{ zIndex: 1 }}>

        {/* Header banner OR text header */}
        {!clinic?.letterheadMode && clinic?.headerImageUrl && (
          <div className="mb-3 border-b-2 border-slate-400 pb-2">
            <img src={clinic.headerImageUrl} alt="header"
                 className="w-full object-contain" style={{ maxHeight: 140 }}/>
          </div>
        )}

        {!clinic?.letterheadMode && (!clinic?.headerImageUrl || !clinic?.hideTextOnHeader) && (
          <div className="pb-2 mb-3 border-b-2 border-slate-400">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {clinic?.logo && !clinic?.headerImageUrl && (
                  <img src={clinic.logo} alt="logo" className="w-16 h-16 object-contain flex-shrink-0"/>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-slate-900 print:text-black">{clinic?.name || 'SimpleRx EMR'}</h1>
                  {clinic?.address && <p className="text-xs text-slate-600">{clinic.address}</p>}
                  {(clinic?.phone || clinic?.mobile) && <p className="text-xs text-slate-600">Phone: {clinic?.mobile || clinic?.phone}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {doctor?.name && <p className="font-bold text-slate-900">{doctor.name}</p>}
                {doctor?.qualification  && <p className="text-xs text-slate-700">{doctor.qualification}</p>}
                {doctor?.specialization && <p className="text-xs text-slate-700">{doctor.specialization}</p>}
                {doctor?.regNo          && <p className="text-xs text-slate-600">Reg. No: {doctor.regNo}</p>}
              </div>
            </div>
          </div>
        )}

        {/* paddingTop spacer */}
        <div style={{ height: `${(cfg?.paddingTop ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Document title - centered, large */}
        <div className="text-center mb-5">
          <h2 className="text-2xl font-black tracking-wider uppercase text-slate-900 print:text-black border-b-2 border-slate-300 inline-block pb-1 px-6">
            {TYPE_TITLE[doc.type]}
          </h2>
          <p className="text-xs font-mono text-slate-500 mt-1">No: <span className="font-bold text-slate-700">{doc.docNo}</span></p>
        </div>

        {/* ── Body content per type ─────────────────────── */}
        {doc.type === 'FITNESS_CERT' && <FitnessBody doc={doc} data={data}/>}
        {doc.type === 'MEDICAL_CERT' && <MedicalBody doc={doc} data={data}/>}
        {doc.type === 'REFERRAL'     && <ReferralBody doc={doc} data={data} clinic={clinic}/>}

        {/* paddingBottom spacer */}
        <div style={{ height: `${(cfg?.paddingBottom ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Footer image */}
        {clinic?.footerImageUrl && (
          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-center">
            <img src={clinic.footerImageUrl} alt="footer"
                 className="max-h-16 object-contain" style={{ maxWidth: '90%' }}/>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-end mt-6">
          <div className="text-xs text-slate-400">
            <p>Generated by SimpleRx EMR</p>
            <p>{format(new Date(doc.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
          <div className="text-right flex items-end gap-3">
            {doctor?.stamp && (
              <img src={doctor.stamp} alt="stamp" className="h-16 w-16 object-contain"/>
            )}
            <div>
              {doctor?.signature ? (
                <img src={doctor.signature} alt="signature"
                     className="h-12 ml-auto object-contain mb-1" style={{ maxWidth: 160 }}/>
              ) : (
                <div className="w-32 border-b border-slate-300 mb-1 h-8"></div>
              )}
              {doctor?.name && <p className="text-xs font-semibold text-slate-600">{doctor.name}</p>}
              <p className="text-xs text-slate-400">Signature</p>
            </div>
          </div>
        </div>
        </div>{/* end relative z-1 layer */}

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 16px !important; }
          }
        `}</style>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Delete certificate?"
        message={`This will permanently delete ${doc.docNo}. This cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}

// ── FITNESS CERTIFICATE BODY ─────────────────────────────
function FitnessBody({ doc, data }) {
  const verdict = data.verdict || 'FIT'
  const verdictText = {
    FIT: 'medically FIT',
    UNFIT: 'NOT FIT',
    FIT_WITH_RESTRICTIONS: 'FIT with restrictions',
  }[verdict] || 'medically FIT'

  const fitnessFor = data.fitnessFor === 'Custom' ? (data.fitnessForCustom || '____________') : (data.fitnessFor || '____________')
  const vitals = data.vitals || {}

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>This is to certify that:</p>

      <div className="ml-4 space-y-1">
        <p>
          <strong className="text-slate-900">
            {doc.patientName}
            {doc.patientGender ? ` (${doc.patientGender})` : ''}
          </strong>
          {doc.patientAge != null && <>, aged <strong>{doc.patientAge} years</strong></>}
          {doc.patientGuardian && <>, {doc.patientGuardian}</>}
        </p>
        {doc.patientAddress && <p>Resident of: {doc.patientAddress}</p>}
      </div>

      <p>
        Was examined by me on <strong>{format(new Date(doc.examDate), 'dd MMMM yyyy')}</strong> and is found to be{' '}
        <strong className="text-slate-900 uppercase">{verdictText}</strong> for{' '}
        <strong>{fitnessFor}</strong>.
      </p>

      {verdict === 'FIT_WITH_RESTRICTIONS' && data.restrictions && (
        <p><strong>Restrictions:</strong> {data.restrictions}</p>
      )}

      {(vitals.bp || vitals.pulse || vitals.weight || vitals.height || vitals.vision) && (
        <div className="bg-slate-50 rounded-lg p-3 my-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">General observations</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            {vitals.bp     && <p><span className="text-slate-500">BP:</span> <strong>{vitals.bp}</strong></p>}
            {vitals.pulse  && <p><span className="text-slate-500">Pulse:</span> <strong>{vitals.pulse}</strong></p>}
            {vitals.weight && <p><span className="text-slate-500">Weight:</span> <strong>{vitals.weight} kg</strong></p>}
            {vitals.height && <p><span className="text-slate-500">Height:</span> <strong>{vitals.height} cm</strong></p>}
            {vitals.vision && <p><span className="text-slate-500">Vision:</span> <strong>{vitals.vision}</strong></p>}
            {vitals.other  && <p><span className="text-slate-500">Other:</span> <strong>{vitals.other}</strong></p>}
          </div>
        </div>
      )}

      {doc.diagnosis && (
        <p><strong>Observations:</strong> {doc.diagnosis}</p>
      )}

      {doc.remarks && (
        <p><strong>Remarks:</strong> {doc.remarks}</p>
      )}

      {data.validityMonths != null && data.validityMonths > 0 && (
        <p><strong>This certificate is valid for:</strong> {data.validityMonths} month{data.validityMonths > 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

// ── MEDICAL CERTIFICATE (sick leave) BODY ────────────────
function MedicalBody({ doc, data }) {
  const restFrom = data.restFromDate ? format(new Date(data.restFromDate), 'dd MMM yyyy') : '____________'
  const restTo   = data.restToDate   ? format(new Date(data.restToDate),   'dd MMM yyyy') : '____________'
  const resume   = data.resumeFromDate ? format(new Date(data.resumeFromDate), 'dd MMM yyyy') : null

  // Days inclusive
  let totalDays = 0
  if (data.restFromDate && data.restToDate) {
    const a = new Date(data.restFromDate), b = new Date(data.restToDate)
    totalDays = Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1)
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>This is to certify that:</p>

      <div className="ml-4 space-y-1">
        <p>
          <strong className="text-slate-900">
            {doc.patientName}
            {doc.patientGender ? ` (${doc.patientGender})` : ''}
          </strong>
          {doc.patientAge != null && <>, aged <strong>{doc.patientAge} years</strong></>}
          {doc.patientGuardian && <>, {doc.patientGuardian}</>}
        </p>
        {doc.patientEmpId && <p>Employee / Student ID: <strong>{doc.patientEmpId}</strong></p>}
      </div>

      <p>
        Was examined by me on <strong>{format(new Date(doc.examDate), 'dd MMMM yyyy')}</strong>
        {doc.diagnosis && <> and was diagnosed with <strong>{doc.diagnosis}</strong></>}.
      </p>

      <p>
        Was advised rest from <strong>{restFrom}</strong> to <strong>{restTo}</strong>
        {totalDays > 0 && <> (Total: <strong>{totalDays} day{totalDays > 1 ? 's' : ''}</strong>)</>}.
      </p>

      {resume && (
        <p>
          The patient is medically fit to resume duties from <strong>{resume}</strong>.
        </p>
      )}

      {doc.remarks && (
        <p className="mt-3"><strong>Remarks:</strong> {doc.remarks}</p>
      )}
    </div>
  )
}

// ── REFERRAL LETTER BODY ─────────────────────────────────
function ReferralBody({ doc, data, clinic }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {/* To */}
      <div className="space-y-0.5">
        <p>To,</p>
        <p className="ml-4">
          <strong>{data.referredToName || '____________'}</strong>
          {data.referredToSpecialty && <>, <em>{data.referredToSpecialty}</em></>}
        </p>
        {data.referredToClinic  && <p className="ml-4">{data.referredToClinic}</p>}
        {data.referredToAddress && <p className="ml-4 text-slate-600">{data.referredToAddress}</p>}
        {data.referredToPhone   && <p className="ml-4 text-slate-600">Phone: {data.referredToPhone}</p>}
      </div>

      {/* Re */}
      <div className="border-l-4 border-primary pl-3 my-3">
        <p>
          <strong>Re: {doc.patientName}</strong>
          {doc.patientAge != null && <>, {doc.patientAge} yrs</>}
          {doc.patientGender && <>, {doc.patientGender}</>}
          {doc.patient?.patientCode && <> &nbsp;(OPD: <span className="font-mono">{doc.patient.patientCode}</span>)</>}
        </p>
      </div>

      <p>Dear Doctor,</p>
      <p>
        I am referring the above patient for your expert opinion / further management.
      </p>

      {data.chiefComplaint && (
        <div>
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Chief complaint</p>
          <p>{data.chiefComplaint}</p>
        </div>
      )}

      {data.clinicalHistory && (
        <div>
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Clinical history</p>
          <p className="whitespace-pre-wrap">{data.clinicalHistory}</p>
        </div>
      )}

      {data.currentMeds && (
        <div>
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Current medications</p>
          <p className="whitespace-pre-wrap">{data.currentMeds}</p>
        </div>
      )}

      {data.investigations && (
        <div>
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Investigations done</p>
          <p className="whitespace-pre-wrap">{data.investigations}</p>
        </div>
      )}

      {data.provisionalDx && (
        <div>
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Provisional diagnosis</p>
          <p>{data.provisionalDx}</p>
        </div>
      )}

      {data.reasonForReferral && (
        <div className="bg-blue-50/50 rounded-lg p-3 my-3">
          <p className="font-bold text-slate-700 uppercase text-xs tracking-wide mb-0.5">Reason for referral</p>
          <p>{data.reasonForReferral}</p>
        </div>
      )}

      {doc.diagnosis && (
        <p><strong>Notes:</strong> {doc.diagnosis}</p>
      )}

      {doc.remarks && (
        <p className="italic text-slate-600">{doc.remarks}</p>
      )}

      <p className="mt-4">Thanking you,</p>
    </div>
  )
}
