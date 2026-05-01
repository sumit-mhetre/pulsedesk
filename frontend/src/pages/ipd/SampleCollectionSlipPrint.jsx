// Sample Collection Slip Print -- A4 list of pending lab + imaging orders.
//
// Used by IPD Orders tab "Sample Slip" button. Lab tech uses this when
// drawing samples (or sending patient for imaging).

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { usePrintTitle } from '../../hooks/usePrintTitle'
import { buildPrintTitle } from '../../lib/slug'

export default function SampleCollectionSlipPrint() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [admission, setAdmission] = useState(null)
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [admR, ordR] = await Promise.all([
          api.get(`/ipd/admissions/${id}`),
          api.get(`/ipd/admissions/${id}/ipd-orders`),
        ])
        setAdmission(admR.data.data)
        const filtered = (ordR.data.data || [])
          .filter(o => ['LAB_TEST', 'IMAGING'].includes(o.orderType))
          .filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status))
        setOrders(filtered)
      } catch (err) {
        toast.error('Failed to load slip')
        navigate(`/ipd/admissions/${id}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // PDF/print filename: SampleSlip_IPD-0001_SHA0001_Sumit-Mhetre
  usePrintTitle(admission ? buildPrintTitle('SampleSlip', {
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

  const labOrders = orders.filter(o => o.orderType === 'LAB_TEST')
  const imagingOrders = orders.filter(o => o.orderType === 'IMAGING')

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
            Sample Collection Slip
          </p>
          <p style={{ fontSize: 10, color: '#888', margin: '1px 0 0' }}>
            Lab tests and imaging investigations to perform
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

        {orders.length === 0 ? (
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: 16, textAlign: 'center', margin: '20px 0' }}>
            <p style={{ margin: 0, color: '#854F0B', fontSize: 13 }}>
              No pending lab or imaging orders.
            </p>
          </div>
        ) : (
          <>
            {/* Lab Tests */}
            {labOrders.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1565C0', borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>
                  LABORATORY TESTS ({labOrders.length})
                </p>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th>Test / Description</th>
                      <th style={{ width: '20%' }}>Ordered</th>
                      <th style={{ width: '15%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labOrders.map((o, i) => (
                      <tr key={o.id}>
                        <td>{i + 1}.</td>
                        <td>
                          <strong>{o.description}</strong>
                          {o.notes && <div style={{ fontSize: 11, color: '#666' }}>{o.notes}</div>}
                        </td>
                        <td>{format(new Date(o.orderedAt), 'd MMM, hh:mm a')}</td>
                        <td>{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Imaging */}
            {imagingOrders.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1565C0', borderBottom: '1px solid #ddd', paddingBottom: 4, marginBottom: 8 }}>
                  IMAGING ({imagingOrders.length})
                </p>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th>Test / Description</th>
                      <th style={{ width: '20%' }}>Ordered</th>
                      <th style={{ width: '15%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imagingOrders.map((o, i) => (
                      <tr key={o.id}>
                        <td>{i + 1}.</td>
                        <td>
                          <strong>{o.description}</strong>
                          {o.notes && <div style={{ fontSize: 11, color: '#666' }}>{o.notes}</div>}
                        </td>
                        <td>{format(new Date(o.orderedAt), 'd MMM, hh:mm a')}</td>
                        <td>{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Footer / Signature */}
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
