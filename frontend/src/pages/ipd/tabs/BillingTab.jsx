// IPD Billing tab -- preview and generate interim or final bills.
//
// Workflow:
//   1. List of existing bills at top (voided bills hidden by default)
//   2. "Generate Bill" button -> modal
//   3. Modal: pick type (interim/final), shows preview with line items
//      (bed rent calculated + all charges)
//   4. Edit items, apply discount, set payment, generate
//   5. Bill saved to Bill table -> user can navigate to /billing/:id to print
//
// Final bills auto-deduct initial deposit AND consolidate any earlier interim
// bills (their amountPaid rolls into final, they get marked voided).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, IndianRupee, Eye, Save, X, AlertCircle, ChevronRight,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Insurance', 'Other']

const STATUS_VARIANTS = {
  Paid:    'success',
  Partial: 'warning',
  Pending: 'danger',
}

export default function BillingTab({ admission }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canBill = can(user, 'manageIPDBilling')

  const [bills, setBills]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/ipd/admissions/${admission.id}/bills`)
      setBills(data.data || [])
    } catch {
      toast.error('Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  const finalBillExists = bills.some(b => b.billType === 'IPD_FINAL')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Billing
            {bills.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({bills.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">
            Bed rent + all charges {admission.initialDeposit > 0 && '-- Deposit \u20B9' + admission.initialDeposit.toLocaleString('en-IN') + ' applied to final bill'}
          </p>
        </div>
        {canBill && !finalBillExists && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => setShowGenerate(true)}>
            Generate Bill
          </Button>
        )}
      </div>

      {/* Existing bills */}
      {bills.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No bills generated yet</p>
          {canBill && (
            <p className="text-xs text-slate-400">Click "Generate Bill" to create an interim or final bill.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {bills.map(bill => {
            const borderColors = {
              Paid:    'border-l-success',
              Partial: 'border-l-warning',
              Pending: 'border-l-danger',
            }
            const borderClass = borderColors[bill.paymentStatus] || 'border-l-slate-300'

            return (
              <div key={bill.id}
                onClick={() => navigate(`/billing/${bill.id}`)}
                className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2 hover:border-slate-300 cursor-pointer transition-colors`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono font-semibold text-primary text-sm">{bill.billNo}</p>
                  <Badge variant={bill.billType === 'IPD_FINAL' ? 'success' : 'accent'}>
                    {bill.billType === 'IPD_FINAL' ? 'Final' : 'Interim'}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[bill.paymentStatus] || 'gray'}>
                    {bill.paymentStatus}
                  </Badge>
                  <span className="flex-1 min-w-0"/>
                  <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                    &#8377;{bill.total.toLocaleString('en-IN')}
                  </span>
                  {bill.balance > 0 && (
                    <span className="text-[11px] text-warning whitespace-nowrap">
                      (&#8377;{bill.balance.toLocaleString('en-IN')} pending)
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400"/>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {format(new Date(bill.date), 'd MMM yyyy, hh:mm a')}
                  <span className="text-slate-300"> &middot; </span>
                  {bill.items?.length || 0} items
                </p>
              </div>
            )
          })}
        </div>
      )}

      {showGenerate && (
        <GenerateBillModal
          admission={admission}
          existingBills={bills}
          onClose={() => setShowGenerate(false)}
          onGenerated={(bill) => {
            setShowGenerate(false)
            fetchData()
            toast.success(`Bill ${bill.billNo} generated`)
          }}/>
      )}
    </div>
  )
}

// ---------------------------------------------------------
function GenerateBillModal({ admission, existingBills, onClose, onGenerated }) {
  const isOpen = admission.status === 'ADMITTED'
  const defaultType = isOpen ? 'IPD_INTERIM' : 'IPD_FINAL'

  const [type, setType] = useState(defaultType)
  const [preview, setPreview] = useState(null)
  const [items, setItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState('flat')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [amountPaid, setAmountPaid] = useState(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPreview = async (forType) => {
    setLoading(true)
    try {
      const { data } = await api.get(
        `/ipd/admissions/${admission.id}/bills/preview?type=${forType}`
      )
      setPreview(data.data)
      setItems(data.data.items || [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to preview')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPreview(type) }, [type])

  // Compute totals (mirrors backend logic)
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
  let discountAmount = parseFloat(discount) || 0
  if (discountType === 'percent') {
    discountAmount = subtotal * (discountAmount / 100)
  }
  if (discountAmount > subtotal) discountAmount = subtotal

  const depositToApply = type === 'IPD_FINAL' ? (admission.initialDeposit || 0) : 0
  const interimPaid    = type === 'IPD_FINAL' ? (preview?.interimPaid || 0) : 0
  const interimBillNos = type === 'IPD_FINAL' ? (preview?.interimBillNos || []) : []

  const total = Math.max(0, subtotal - discountAmount - depositToApply)
  const newPayment = parseFloat(amountPaid) || 0
  const totalPaidOnFinal = type === 'IPD_FINAL' ? (newPayment + interimPaid) : newPayment
  const balance = Math.max(0, total - totalPaidOnFinal)

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, val) => {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: val }
    if (field === 'qty' || field === 'rate') {
      const q = parseInt(field === 'qty' ? val : next[idx].qty, 10) || 1
      const r = parseFloat(field === 'rate' ? val : next[idx].rate) || 0
      next[idx].amount = q * r
    }
    setItems(next)
  }

  const submit = async () => {
    if (items.length === 0) return toast.error('No items to bill')
    setSaving(true)
    try {
      const { data } = await api.post(`/ipd/admissions/${admission.id}/bills`, {
        type,
        items: items.map(i => ({
          name:   i.name,
          qty:    parseInt(i.qty, 10) || 1,
          rate:   parseFloat(i.rate) || 0,
          amount: parseFloat(i.amount) || 0,
        })),
        discount,
        discountType,
        paymentMode,
        amountPaid: parseFloat(amountPaid) || 0,
        notes: notes.trim() || undefined,
      })
      onGenerated(data.data)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Generate Bill" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Generate
          </Button>
        </>
      }>
      {loading || !preview ? (
        <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
      ) : (
        <div className="space-y-3">
          {/* Bill type */}
          <div className="form-group">
            <label className="form-label">Bill Type *</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('IPD_INTERIM')}
                disabled={!isOpen && type === 'IPD_FINAL'}
                className={`flex-1 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors
                  ${type === 'IPD_INTERIM'
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-primary'}`}>
                Interim Bill
                <p className="text-[10px] font-normal text-slate-500 mt-0.5">Mid-stay billing</p>
              </button>
              <button
                onClick={() => setType('IPD_FINAL')}
                disabled={isOpen}
                title={isOpen ? 'Discharge patient first' : ''}
                className={`flex-1 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors
                  ${type === 'IPD_FINAL'
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-primary'}
                  ${isOpen ? 'opacity-50 cursor-not-allowed' : ''}`}>
                Final Bill
                <p className="text-[10px] font-normal text-slate-500 mt-0.5">After discharge</p>
              </button>
            </div>
          </div>

          {/* Notice when final consolidates interims */}
          {type === 'IPD_FINAL' && interimBillNos.length > 0 && (
            <div className="text-xs bg-blue-50 border border-blue-100 text-primary p-2.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1"/>
              This final bill will consolidate {interimBillNos.length} earlier interim bill
              {interimBillNos.length > 1 ? 's' : ''} ({interimBillNos.join(', ')}).
              Their payments (&#8377;{interimPaid.toLocaleString('en-IN')}) will be applied here,
              and the interim bills will be marked voided.
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">Items ({items.length})</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Description</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-16">Qty</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-24">Rate</th>
                    <th className="text-right px-2 py-2 text-xs font-semibold text-slate-600 w-24">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <input className="form-input py-1 px-2 text-sm" value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}/>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" min="1" className="form-input py-1 px-2 text-sm w-14 text-right"
                          value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)}/>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input type="number" min="0" step="0.01" className="form-input py-1 px-2 text-sm w-24 text-right"
                          value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)}/>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-700">
                        &#8377;{(item.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => removeItem(idx)} className="text-danger hover:text-danger/80">
                          <X className="w-4 h-4"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">&#8377;{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">Discount</span>
              <div className="flex items-center gap-1">
                <input type="number" min="0" className="form-input py-1 px-2 text-sm w-20 text-right"
                  value={discount} onChange={e => setDiscount(e.target.value)}/>
                <select className="form-select py-1 px-2 text-sm"
                  value={discountType} onChange={e => setDiscountType(e.target.value)}>
                  <option value="flat">&#8377;</option>
                  <option value="percent">%</option>
                </select>
                <span className="font-semibold text-warning ml-1">
                  &minus;&#8377;{discountAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {depositToApply > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Deposit applied</span>
                <span className="font-semibold text-success">&minus;&#8377;{depositToApply.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-base font-semibold text-slate-700">Total Payable</span>
              <span className="text-xl font-black text-primary">&#8377;{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>

            {/* For final bills, break down what's already been paid vs what's needed today */}
            {type === 'IPD_FINAL' && interimPaid > 0 && (
              <>
                <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
                  <span className="text-slate-600">Already paid (interim bills)</span>
                  <span className="font-semibold text-success">&#8377;{interimPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">New payment today</span>
                  <span className="font-semibold">&#8377;{newPayment.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Remaining balance</span>
                  <span className={`font-bold ${balance > 0 ? 'text-warning' : 'text-success'}`}>
                    &#8377;{balance.toLocaleString('en-IN')}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Payment Mode</label>
              <select className="form-select" value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                {type === 'IPD_FINAL' ? 'New payment today' : 'Amount Paid'}
              </label>
              <input type="number" min="0" className="form-input" value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}/>
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"/>
            </div>
          </div>

          {balance > 0 && newPayment > 0 && (
            <p className="text-xs text-warning bg-orange-50 p-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1"/>
              Balance &#8377;{balance.toLocaleString('en-IN')} will remain pending.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
