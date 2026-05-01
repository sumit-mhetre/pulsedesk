// Procurement Slip Print -- A4 printable list of medicines to buy outside.
//
// Two modes via query param:
//   ?since=last  -> only meds added since user's last view (uses localStorage timestamp)
//   default      -> all PROCURE-mode active orders
//
// Used by Medications tab "Procurement Slip" button.

import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { usePrintTitle } from '../../hooks/usePrintTitle'
import { buildPrintTitle } from '../../lib/slug'

// Standard frequency -> doses per day (for quantity calc)
const DOSES_PER_DAY = {
  OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1, STAT: 1,
  Q4H: 6, Q6H: 4, Q8H: 3,
}

// Estimate quantity needed for a course
function estimateQty(order) {
  if (order.expectedQty?.trim()) return order.expectedQty.trim()
  if (order.frequency === 'SOS')  return '(as needed)'
  if (order.frequency === 'STAT') return '1 dose'

  const dpd = DOSES_PER_DAY[order.frequency] || 1
  const start = new Date(order.startDate)
  const end = order.stopDate ? new Date(order.stopDate) : null
  if (!end) {
    return `${dpd} per day x duration of stay`
  }
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1)
  const total = dpd * days
  return `${total} units (${dpd}/day x ${days} days)`
}

export default function ProcurementSlipPrint() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const sinceLast    = searchParams.get('since') === 'last'
  const [admission,  setAdmission]  = useState(null)
  const [orders,     setOrders]     = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [admR, medR] = await Promise.all([
          api.get(`/ipd/admissions/${id}`),
          api.get(`/ipd/admissions/${id}/medications`),
        ])
        setAdmission(admR.data.data)

        let allOrders = (medR.data.data || [])
          .filter(o => o.status === 'ACTIVE')
          .filter(o => o.procurementMode === 'PROCURE')

        if (sinceLast) {
          const lastKey = `procslip:${id}:last`
          const lastTime = localStorage.getItem(lastKey)
          if (lastTime) {
            const cutoff = new Date(lastTime)
            allOrders = allOrders.filter(o => new Date(o.createdAt) > cutoff)
          }
        }
        setOrders(allOrders)

        // Mark as viewed
        try { localStorage.setItem(`procslip:${id}:last`, new Date().toISOString()) } catch {}
      } catch (err) {
        toast.error('Failed to load procurement slip')
        navigate(`/ipd/admissions/${id}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, sinceLast])

  // PDF/print filename: Procurement_IPD-0001_SHA0001_Sumit-Mhetre
  usePrintTitle(admission ? buildPrintTitle('Procurement', {
    id:   admission.admissionNumber,
    code: admission.patient?.patientCode,
    name: admission.patient?.name,
  }) : null)

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }
  if (!admission) return null

  const a = admission
  const clinic = a.clinic
  const doctor = a.primaryDoctor

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; padding: 0 !important; }
        }
        .print-page {
          font-family: system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          color: #1a1a1a;
        }
        .print-page table { border-collapse: collapse; width: 100%; }
        .print-page th, .print-page td { padding: 6px 8px; vertical-align: top; }
        .print-page th { background: #f5f5f5; font-weight: 600; text-align: left; font-size: 11px; }
        .print-page tr { border-bottom: 0.5px solid #eee; }
      `}</style>

      <div className="no-print bg-white border-b border-slate-200 py-3 px-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4"/>}
            onClick={() => navigate(`/ipd/admissions/${id}`)}>
            Back
          </Button>
          <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4"/>}
            onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <div className="print-page max-w-4xl mx-auto bg-white shadow-md p-10 my-6">
        {/* Compact clinic header -- 2 lines instead of 4 */}
        <div style={{ borderBottom: '2px solid #1565C0', paddingBottom: 10, marginBottom: 12 }}>
          <div className="flex items-start justify-between">
            <div style={{ flex: 1 }}>
              {clinic?.name ? (
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#1565C0', letterSpacing: 0.3, lineHeight: 1.2 }}>
                  {clinic.name}
                  {clinic.tagline && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#777', fontStyle: 'italic', marginLeft: 8 }}>
                      {clinic.tagline}
                    </span>
                  )}
                </h1>
              ) : (
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#999', fontStyle: 'italic' }}>
                  (Clinic name not set)
                </h1>
              )}
              {(clinic?.address || clinic?.phone || clinic?.mobile || clinic?.email) && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#666' }}>
                  {[
                    clinic.address,
                    clinic.phone && `Tel: ${clinic.phone}`,
                    clinic.mobile && `Mob: ${clinic.mobile}`,
                    clinic.email,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {clinic?.logo && (
              <img src={clinic.logo} alt="logo" style={{ height: 50, width: 'auto', marginLeft: 16 }}/>
            )}
          </div>
        </div>

        {/* Slip type -- compact centered subtitle */}
        <div style={{ textAlign: 'center', margin: '2px 0 10px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
            Medicine Procurement Slip
          </p>
          <p style={{ fontSize: 10, color: '#888', margin: '1px 0 0' }}>
            Items to be purchased from outside chemist
          </p>
        </div>

        {/* Patient block -- 2 lines, matches prescription style */}
        <div style={{ marginBottom: 12, fontSize: 12, borderBottom: '0.5px solid #e5e7eb', paddingBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 13 }}>{a.patient?.patientCode || '--'}</strong>
              <span style={{ margin: '0 8px' }}>&nbsp;</span>
              <strong style={{ fontSize: 13 }}>{a.patient?.name}</strong>
              <span style={{ color: '#666', marginLeft: 6 }}>
                ({a.patient?.age} {a.patient?.ageUnit || 'yrs'}, {a.patient?.gender})
              </span>
              {a.patient?.phone && (
                <span style={{ color: '#666', marginLeft: 6 }}>- {a.patient.phone}</span>
              )}
            </div>
            <div style={{ color: '#666' }}>
              <strong>Date:</strong> {format(new Date(), 'd MMM yyyy, hh:mm a')}
            </div>
          </div>
          <div style={{ marginTop: 4, color: '#666' }}>
            <strong>{a.admissionNumber}</strong>
            <span style={{ margin: '0 6px' }}>&middot;</span>
            Bed {a.bed?.bedNumber || '--'}
            <span style={{ margin: '0 6px' }}>&middot;</span>
            {doctor?.name}
          </div>
        </div>

        {/* Items */}
        {orders.length === 0 ? (
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: 16, textAlign: 'center', margin: '20px 0' }}>
            <p style={{ margin: 0, color: '#854F0B', fontSize: 13 }}>
              {sinceLast
                ? 'No new medication orders since your last viewing.'
                : 'No medications marked for outside procurement.'}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th>Medicine</th>
                <th style={{ width: '15%' }}>Dose</th>
                <th style={{ width: '12%' }}>Route</th>
                <th style={{ width: '12%' }}>Frequency</th>
                <th style={{ width: '20%' }}>Quantity Needed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id}>
                  <td>{i + 1}.</td>
                  <td><strong>{o.medicineName}</strong></td>
                  <td>{o.dose}</td>
                  <td>{o.route}</td>
                  <td>{o.frequency}{o.duration ? ' x ' + o.duration : ''}</td>
                  <td>{estimateQty(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div style={{ marginTop: 30, fontSize: 11, color: '#666' }}>
          <p style={{ margin: '4px 0' }}>
            <strong>Instructions:</strong> Please purchase the items above and bring them to {a.bed?.bedNumber ? 'Bed ' + a.bed.bedNumber : 'the ward'}.
            Quantity is an estimate -- pharmacist may suggest equivalent strip/box sizes.
          </p>
          <p style={{ margin: '4px 0' }}>
            For any clarification, contact {clinic?.phone ? 'the clinic at ' + clinic.phone : 'the receptionist'}.
          </p>
        </div>

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 11, color: '#666' }}>
            <p style={{ margin: 0 }}>Generated: {format(new Date(), 'd MMM yyyy, hh:mm a')}</p>
            <p style={{ margin: 0 }}>SimpleRx EMR</p>
          </div>
          {doctor && (
            <div style={{ textAlign: 'right' }}>
              {doctor.signature && (
                <img src={doctor.signature} alt="signature" style={{ height: 50, width: 'auto' }}/>
              )}
              <p style={{ margin: '4px 0 0', fontWeight: 500, fontSize: 12 }}>{doctor.name}</p>
              {doctor.qualification && <p style={{ margin: 0, fontSize: 10, color: '#666' }}>{doctor.qualification}</p>}
              {doctor.regNo && <p style={{ margin: 0, fontSize: 10, color: '#888' }}>Reg No: {doctor.regNo}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
