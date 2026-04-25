import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Edit2, CheckCircle, Clock, IndianRupee } from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

const STATUS = {
  Paid:    { color: 'text-success', bg: 'bg-green-50', border: 'border-success' },
  Partial: { color: 'text-warning', bg: 'bg-orange-50', border: 'border-warning' },
  Pending: { color: 'text-danger',  bg: 'bg-red-50',   border: 'border-danger' },
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

export default function ViewBillPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const [bill,     setBill]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [paid,     setPaid]     = useState(0)
  const [mode,     setMode]     = useState('Cash')
  const [saving,   setSaving]   = useState(false)
  const [cfg,      setCfg]      = useState(null)

  // show(key) returns true unless cfg explicitly disables it. Backward-compat for old configs.
  const show = (key) => cfg ? (cfg[key] !== false) : true

  useEffect(() => {
    api.get('/page-design?type=bill').then(r=>{ if(r.data.data?.config) setCfg(r.data.data.config) }).catch(()=>{})
    api.get(`/billing/${id}`)
      .then(({ data }) => { setBill(data.data); setPaid(data.data.amountPaid); setMode(data.data.paymentMode) })
      .catch(() => navigate('/billing'))
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdatePayment = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/billing/${id}`, { amountPaid: parseFloat(paid), paymentMode: mode })
      setBill(data.data)
      setEditing(false)
      toast.success('Payment updated!')
    } catch {} finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  if (!bill)   return null

  const clinic = user?.clinic
  const st     = STATUS[bill.paymentStatus] || STATUS.Pending

  return (
    <div className="fade-in">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/billing')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
          <div>
            <h1 className="page-title">{bill.billNo}</h1>
            <p className="page-subtitle">{bill.patient?.name} • {format(new Date(bill.date), 'dd MMM yyyy')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Edit2 className="w-4 h-4"/>} onClick={() => setEditing(e => !e)}>
            Update Payment
          </Button>
          <Button variant="primary" icon={<Printer className="w-4 h-4"/>} onClick={() => window.print()}>
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Update payment panel */}
      {editing && (
        <Card className="mb-4 no-print border-2 border-primary/20">
          <h3 className="font-bold text-slate-700 mb-3">Update Payment</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="form-group">
              <label className="form-label">Amount Paid (₹)</label>
              <input type="number" className="form-input w-36 text-lg font-bold"
                value={paid} onChange={e => setPaid(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select className="form-select w-36" value={mode} onChange={e => setMode(e.target.value)}>
                {['Cash','UPI','Card','Cheque','Online','Other'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mb-1">
              <button type="button" onClick={() => setPaid(bill.total)}
                className="text-xs px-3 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 font-medium">
                Full ₹{bill.total.toLocaleString('en-IN')}
              </button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleUpdatePayment}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Receipt Print Layout ── */}
      <div className="relative bg-white rounded-2xl shadow-card border border-blue-50 p-8 max-w-2xl mx-auto print-area" style={{ lineHeight: lineHeightFor(cfg?.lineSpacing) }}>

        {/* Letterhead background — covers full receipt */}
        {clinic?.letterheadMode && clinic?.letterheadUrl && (
          <img
            src={clinic.letterheadUrl}
            alt="letterhead"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-2xl"
            style={{ zIndex: 0 }}
          />
        )}

        <div className="relative" style={{ zIndex: 1 }}>

        {/* Header banner — full-width image. Replaces text header below if uploaded.
            Skipped when letterhead mode is on. */}
        {!clinic?.letterheadMode && clinic?.headerImageUrl && (
          <div className="mb-3 border-b-2 border-primary pb-2">
            <img
              src={clinic.headerImageUrl}
              alt="header"
              className="w-full object-contain"
              style={{ maxHeight: 120 }}
            />
            <p className="text-right mt-2">
              <span className="text-xl font-black text-primary">RECEIPT</span>{' '}
              <span className="font-mono font-bold text-slate-600 ml-2">{bill.billNo}</span>{' '}
              <span className="text-sm text-slate-400 ml-2">{format(new Date(bill.date), 'dd/MM/yyyy')}</span>
            </p>
          </div>
        )}

        {/* Text-based header — shown when no banner OR hideTextOnHeader is OFF */}
        {!clinic?.letterheadMode && (!clinic?.headerImageUrl || !clinic?.hideTextOnHeader) && (
        <div className="border-b-2 border-primary pb-4 mb-5">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {show('showLogo') && clinic?.logo && !clinic?.headerImageUrl && (
                <img src={clinic.logo} alt="logo" className="w-14 h-14 object-contain flex-shrink-0"/>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-primary">{clinic?.name || 'SimpleRx EMR'}</h1>
                {clinic?.address && <p className="text-xs text-slate-400 mt-0.5">{clinic.address}</p>}
                {clinic?.mobile  && <p className="text-xs text-slate-400">📞 {clinic.mobile}</p>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-primary">RECEIPT</p>
              <p className="font-mono font-bold text-slate-600">{bill.billNo}</p>
              <p className="text-sm text-slate-400">{format(new Date(bill.date), 'dd/MM/yyyy')}</p>
            </div>
          </div>
        </div>
        )}

        {/* Spacer — paddingTop after header */}
        <div style={{ height: `${(cfg?.paddingTop ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Patient + status */}
        <div className="flex justify-between items-start mb-5">
          <div className="bg-background rounded-xl p-3 flex-1 mr-4">
            <p className="text-xs text-slate-400 mb-1">Billed To</p>
            <p className="font-bold text-slate-800">
              {show('showOPD') && bill.patient?.patientCode && (
                <span className="font-bold tracking-wide mr-2">{bill.patient.patientCode}</span>
              )}
              {show('showPatient') && bill.patient?.name}
            </p>
            <p className="text-sm text-slate-500">
              {[
                show('showAge')    && bill.patient?.age    != null ? `${bill.patient.age}y` : null,
                show('showGender') && bill.patient?.gender,
                show('showPhone')  && bill.patient?.phone,
              ].filter(Boolean).join(' • ')}
            </p>
            {(show('showEmail') && bill.patient?.email) && (
              <p className="text-xs text-slate-500 mt-0.5">{bill.patient.email}</p>
            )}
            {(show('showAddress') && bill.patient?.address) && (
              <p className="text-xs text-slate-500 mt-0.5">{bill.patient.address}</p>
            )}
            {bill.prescription && (
              <p className="text-xs text-primary mt-1">Rx: {bill.prescription.rxNo}</p>
            )}
          </div>
          <div className={`px-4 py-3 rounded-xl border-2 ${st.border} ${st.bg} text-right`}>
            <p className={`font-bold text-sm ${st.color}`}>{bill.paymentStatus}</p>
            <p className="text-xs text-slate-500 mt-0.5">{bill.paymentMode}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-5">
          <thead>
            <tr className="border-b-2 border-primary/20">
              <th className="text-left py-2 text-xs text-slate-400 font-semibold uppercase">#</th>
              <th className="text-left py-2 text-xs text-slate-400 font-semibold uppercase">Description</th>
              <th className="text-center py-2 text-xs text-slate-400 font-semibold uppercase">Qty</th>
              <th className="text-right py-2 text-xs text-slate-400 font-semibold uppercase">Rate</th>
              <th className="text-right py-2 text-xs text-slate-400 font-semibold uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, i) => (
              <tr key={item.id} className={`border-b border-slate-50 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                <td className="py-2.5 text-slate-400 text-xs">{i+1}</td>
                <td className="py-2.5 font-medium text-slate-800">{item.name}</td>
                <td className="py-2.5 text-center text-slate-600">{item.qty}</td>
                <td className="py-2.5 text-right text-slate-600">₹{item.rate.toLocaleString('en-IN')}</td>
                <td className="py-2.5 text-right font-bold text-slate-800">₹{item.amount.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-5">
          <div className="w-60 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>₹{bill.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Discount</span>
                <span>- ₹{bill.discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-800 pt-1.5 border-t border-slate-200">
              <span>Total</span>
              <span>₹{bill.total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm text-success font-semibold">
              <span>Paid ({bill.paymentMode})</span>
              <span>₹{bill.amountPaid.toLocaleString('en-IN')}</span>
            </div>
            {bill.balance > 0 && (
              <div className="flex justify-between text-sm text-danger font-bold pt-1 border-t border-slate-200">
                <span>Balance Due</span>
                <span>₹{bill.balance.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {bill.notes && (
          <p className="text-xs text-slate-400 mb-4 italic">{bill.notes}</p>
        )}

        {/* Spacer — paddingBottom before footer area */}
        <div style={{ height: `${(cfg?.paddingBottom ?? 8) * 3.78}px` }} aria-hidden/>

        {/* Optional clinic footer image */}
        {show('showFooterImage') && clinic?.footerImageUrl && (
          <div className="border-t border-slate-100 pt-3 mt-4 flex justify-center">
            <img src={clinic.footerImageUrl} alt="footer" className="max-h-14 object-contain" style={{ maxWidth: '90%' }}/>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-end text-xs text-slate-400">
          <div>
            <p>Generated by SimpleRx EMR</p>
            <p>{format(new Date(bill.date), 'dd MMM yyyy, hh:mm a')}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-600">Thank you!</p>
          </div>
        </div>
        </div>{/* end relative wrapper */}
      </div>

      <style>{`
        @media print {
          body { margin: 0 !important; }
          .no-print { display: none !important; }
          nav, aside, header, .sidebar { display: none !important; }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}
