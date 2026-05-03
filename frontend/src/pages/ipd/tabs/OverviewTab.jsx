// Overview tab - admission summary + clinical details + attendant + billing.
// This is the original content of the AdmissionDetailPage, now extracted
// into a tab component so the page can host other tabs alongside it.

import { Card, Badge } from '../../../components/ui'
import {
  Stethoscope, Calendar, Phone, FileText, IndianRupee, ShieldAlert,
} from 'lucide-react'
import { format } from 'date-fns'

const BED_TYPE_LABELS = {
  GENERAL: 'General', SEMI_PRIVATE: 'Semi-Private', PRIVATE: 'Private',
  ICU: 'ICU', HDU: 'HDU', LABOUR: 'Labour', DAY_CARE: 'Day-Care',
  ISOLATION: 'Isolation', OTHER: 'Other',
}

export default function OverviewTab({ admission }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Patient & Doctor */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary"/> Patient & Doctor
        </h3>
        <div className="space-y-2 text-sm">
          <Detail label="Patient" value={admission.patient?.name}/>
          <Detail label="Code" value={admission.patient?.patientCode} mono/>
          <Detail label="Age / Gender"
            value={[admission.patient?.age != null ? `${admission.patient.age} yrs` : null, admission.patient?.gender].filter(Boolean).join(' • ')}/>
          <Detail label="Phone" value={admission.patient?.phone}/>
          <hr className="my-2 border-slate-100"/>
          <Detail label="Primary Doctor" value={admission.primaryDoctor?.name}/>
          <Detail label="Specialization" value={admission.primaryDoctor?.specialization}/>
          <hr className="my-2 border-slate-100"/>
          <Detail label="Bed"
            value={admission.bed
              ? `${admission.bed.bedNumber} • ${BED_TYPE_LABELS[admission.bed.bedType] || admission.bed.bedType} • ${admission.bed.ward || 'Unspecified'}`
              : 'Released'}/>
          <Detail label="Daily Rate"
            value={admission.bed && admission.bed.dailyRate
              ? `₹${admission.bed.dailyRate.toLocaleString('en-IN')}/day`
              : <span className="text-warning">Not set</span>}/>
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary"/> Timeline
        </h3>
        <div className="space-y-2 text-sm">
          <Detail label="Admitted At"
            value={format(new Date(admission.admittedAt), 'd MMM yyyy, hh:mm a')}/>
          {admission.dischargedAt && (
            <Detail label="Discharged At"
              value={format(new Date(admission.dischargedAt), 'd MMM yyyy, hh:mm a')}/>
          )}
          <Detail label="Source" value={admission.admissionSource}/>
          <Detail label="Referred From" value={admission.referredFrom}/>
          {admission.isMLC && (
            <>
              <hr className="my-2 border-slate-100"/>
              <div className="flex items-center gap-2 text-warning text-sm font-semibold">
                <ShieldAlert className="w-4 h-4"/> Medico-Legal Case
              </div>
              <Detail label="MLC Number" value={admission.mlcNumber}/>
            </>
          )}
        </div>
      </Card>

      {/* Clinical */}
      <Card className="lg:col-span-2">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary"/> Clinical
        </h3>
        <div className="space-y-2 text-sm">
          <Detail label="Reason for Admission" value={admission.reasonForAdmission}/>
          <Detail label="Provisional Diagnosis" value={admission.provisionalDiagnosis}/>
          {admission.finalDiagnosis && (
            <Detail label="Final Diagnosis" value={admission.finalDiagnosis}/>
          )}
          {admission.admissionNotes && (
            <div>
              <p className="text-xs uppercase text-slate-400 font-semibold mb-1">Admission Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{admission.admissionNotes}</p>
            </div>
          )}
          {admission.dischargeNotes && (
            <div>
              <p className="text-xs uppercase text-slate-400 font-semibold mb-1">Discharge Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{admission.dischargeNotes}</p>
            </div>
          )}
          {admission.dischargeAdvice && (
            <div>
              <p className="text-xs uppercase text-slate-400 font-semibold mb-1">Discharge Advice</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{admission.dischargeAdvice}</p>
            </div>
          )}
          {admission.causeOfDeath && (
            <Detail label="Cause of Death" value={admission.causeOfDeath}/>
          )}
          {admission.damaReason && (
            <Detail label="DAMA Reason" value={admission.damaReason}/>
          )}
        </div>
      </Card>

      {/* Attendant */}
      {(admission.attendantName || admission.attendantPhone) && (
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary"/> Attendant
          </h3>
          <div className="space-y-2 text-sm">
            <Detail label="Name" value={admission.attendantName}/>
            <Detail label="Relation" value={admission.attendantRelation}/>
            <Detail label="Phone" value={admission.attendantPhone}/>
            <Detail label="Address" value={admission.attendantAddress}/>
            <Detail label="ID Proof" value={admission.attendantIdProof}/>
          </div>
        </Card>
      )}

      {/* Billing */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-primary"/> Billing
        </h3>
        <div className="space-y-2 text-sm">
          <Detail label="Initial Deposit"
            value={`₹${(admission.initialDeposit || 0).toLocaleString('en-IN')}`}/>
          <Detail label="Payment Mode" value={admission.paymentMode}/>
          <Detail label="Insurance Provider" value={admission.insuranceProvider}/>
          <Detail label="Policy Number" value={admission.insurancePolicy} mono/>
          <hr className="my-2 border-slate-100"/>
          <Detail label="Days Stayed" value={`${admission.daysAdmitted} day${admission.daysAdmitted === 1 ? '' : 's'}`}/>
          <Detail label="Bed Rent (calculated)"
            value={<span className="font-semibold">₹{(admission.bedRentTotal || 0).toLocaleString('en-IN')}</span>}/>
          <p className="text-xs text-slate-400 italic mt-2">
            Other charges (medicines, lab tests, procedures) will appear here in future releases.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function Detail({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs uppercase text-slate-400 font-semibold w-32 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
