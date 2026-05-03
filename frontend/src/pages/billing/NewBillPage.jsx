import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2, ArrowLeft, Save, Zap, Plus } from 'lucide-react'
import { Button, Badge, Card } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Cheque', 'Online', 'Other']

// ── Item search with autocomplete ────────────────────────
function ItemSearch({ value, billingItems, onChange, onSelect, onEnter, idx }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState(value || '')

  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = billingItems.filter(b =>
    query.length === 0 || b.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10)

  return (
    <div className="relative">
      <input
        id={`item-input-${idx}`}
        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white transition-all"
        placeholder="Search item or type custom..."
        value={query}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (filtered.length > 0 && query.length > 0) {
              onSelect(filtered[0]); setQuery(filtered[0].name); setOpen(false)
              onEnter && onEnter(idx)
            } else if (query.length > 0) {
              // Custom item - just move to next
              onEnter && onEnter(idx)
              setOpen(false)
            }
          }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-blue-100 max-h-52 overflow-y-auto">
          {filtered.map(b => (
            <button key={b.id} type="button"
              onMouseDown={() => { onSelect(b); setQuery(b.name); setOpen(false); onEnter && onEnter(idx) }}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0 flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-700">{b.name}</span>
                {b.category && <span className="text-xs text-slate-400 ml-2">• {b.category}</span>}
              </div>
              <span className="text-success font-bold text-sm">₹{b.defaultPrice}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewBillPage() {
  const navigate  = useNavigate()
  const [params]  = useSearchParams()

  const [billingItems, setBillingItems] = useState([])
  const [patient,    setPatient]    = useState(null)
  const [ptSearch,   setPtSearch]   = useState('')
  const [ptResults,  setPtResults]  = useState([])
  const [showPtDrop, setShowPtDrop] = useState(false)
  const [prescription, setPrescription] = useState(null)
  const [rxSearch,   setRxSearch]   = useState('')
  const [rxResults,  setRxResults]  = useState([])

  const emptyItem = { billingItemId: '', name: '', qty: 1, rate: '' }
  const [items,       setItems]       = useState([{ ...emptyItem }])
  const [discount,    setDiscount]    = useState(0)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [amountPaid,  setAmountPaid]  = useState('')
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)

  // Computed totals
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.rate) || 0) * (parseInt(i.qty) || 1), 0)
  const total    = Math.max(subtotal - (parseFloat(discount) || 0), 0)
  const paid     = parseFloat(amountPaid) || 0
  const balance  = Math.max(total - paid, 0)
  const payStatus = paid >= total && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'

  // Auto-update amountPaid when total changes
  useEffect(() => {
    setAmountPaid(total > 0 ? String(total) : '')
  }, [total])

  // Load billing items
  useEffect(() => {
    api.get('/master/billing-items').then(({ data }) => setBillingItems(data.data)).catch(() => {})
  }, [])

  // Load from URL params
  useEffect(() => {
    const pid  = params.get('patientId')
    const rxId = params.get('prescriptionId')
    if (pid) api.get(`/patients/${pid}`).then(({ data }) => setPatient(data.data)).catch(() => {})
    if (rxId) {
      api.get(`/prescriptions/${rxId}`).then(({ data }) => {
        setPrescription(data.data)
        if (data.data.patient) setPatient(data.data.patient)
        loadSuggestions(rxId)
      }).catch(() => {})
    }
  }, [])

  // Patient search - load all on focus
  const fetchPatients = async (q = '') => {
    try {
      const { data } = await api.get(`/patients/search?q=${q}`)
      setPtResults(data.data)
      setShowPtDrop(true)
    } catch {}
  }

  useEffect(() => {
    if (ptSearch.length === 0) return
    const t = setTimeout(() => fetchPatients(ptSearch), 250)
    return () => clearTimeout(t)
  }, [ptSearch])

  // Rx search
  useEffect(() => {
    if (!patient || rxSearch.length < 2) { setRxResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await api.get(`/prescriptions/patient/${patient.id}`)
      setRxResults((data.data || []).filter(r => r.rxNo.toLowerCase().includes(rxSearch.toLowerCase())).slice(0, 5))
    }, 300)
    return () => clearTimeout(t)
  }, [rxSearch, patient])

  // Auto-suggest from prescription
  const loadSuggestions = async (rxId) => {
    try {
      const { data } = await api.get(`/billing/suggest/${rxId}`)
      if (data.data?.length > 0) {
        setItems(data.data.map(s => ({ billingItemId: s.billingItemId, name: s.name, qty: s.qty, rate: s.rate })))
        toast.success('Items auto-filled from prescription!')
      }
    } catch {}
  }

  // ── Item handlers ─────────────────────────────────────
  const addItem = () => {
    setItems(p => {
      const next = [...p, { ...emptyItem }]
      setTimeout(() => {
        const el = document.getElementById(`item-input-${next.length - 1}`)
        if (el) el.focus()
      }, 50)
      return next
    })
  }

  const removeItem = i => setItems(p => p.filter((_, idx) => idx !== i))

  const updateItem = (i, field, val) => {
    setItems(prev => {
      const u = [...prev]
      u[i] = { ...u[i], [field]: val }
      return u
    })
  }

  const selectBillingItem = (i, item) => {
    setItems(prev => {
      const u = [...prev]
      u[i] = { billingItemId: item.id, name: item.name, qty: 1, rate: item.defaultPrice }
      return u
    })
  }

  // After selecting item → move to next row or create new
  const handleItemEnter = (rowIdx) => {
    if (rowIdx === items.length - 1) {
      // Last row → add new
      setItems(prev => {
        const next = [...prev, { ...emptyItem }]
        setTimeout(() => {
          const el = document.getElementById(`item-input-${rowIdx + 1}`)
          if (el) el.focus()
        }, 60)
        return next
      })
    } else {
      setTimeout(() => {
        const el = document.getElementById(`item-input-${rowIdx + 1}`)
        if (el) el.focus()
      }, 60)
    }
  }

  // ── Save ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!patient) { toast.error('Please select a patient'); return }
    const validItems = items.filter(i => i.name && parseFloat(i.rate) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with rate'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/billing', {
        patientId:      patient.id,
        prescriptionId: prescription?.id || null,
        items:          validItems,
        discount:       parseFloat(discount) || 0,
        paymentMode,
        amountPaid:     parseFloat(amountPaid) || 0,
        notes,
      })
      toast.success(`Bill ${data.data.billNo} created!`)
      navigate(`/billing/${data.data.id}`)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/billing')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
        <div className="flex-1">
          <h1 className="page-title">New Bill</h1>
          <p className="page-subtitle">{format(new Date(), 'dd MMMM yyyy')}</p>
        </div>
        <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={handleSave}>Save Bill</Button>
      </div>

      <div className="space-y-5">
        {/* ① Patient */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
            Patient
          </h3>
          {!patient ? (
            <div className="relative">
              <input autoFocus className="form-input" placeholder="Click to see all patients or search by name / phone..."
                value={ptSearch}
                onChange={e => { setPtSearch(e.target.value); setShowPtDrop(true) }}
                onFocus={() => fetchPatients('')}
                onBlur={() => setTimeout(() => setShowPtDrop(false), 250)} />
              {showPtDrop && ptResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {ptResults.map(p => (
                    <button key={p.id} type="button"
                      onMouseDown={() => { setPatient(p); setPtSearch(''); setPtResults([]); setShowPtDrop(false) }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-slate-50 last:border-0 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-primary text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">{p.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.patientCode} • {p.age}y {p.gender} • {p.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-3 bg-background rounded-xl">
              <div className="w-11 h-11 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center flex-shrink-0">{patient.name[0]}</div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{patient.name}</p>
                <p className="text-sm text-slate-400">{patient.patientCode} • {patient.age}y {patient.gender} • {patient.phone}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setPatient(null); setPrescription(null) }}>Change</Button>
            </div>
          )}
        </Card>

        {/* ② Link Prescription (optional) */}
        {patient && (
          <Card>
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
              Link Prescription
              <Badge variant="gray">Optional</Badge>
            </h3>
            {!prescription ? (
              <div>
                <input className="form-input" placeholder="Search by Rx number (e.g. RX/2026/0001)..."
                  value={rxSearch} onChange={e => setRxSearch(e.target.value)} />
                {rxResults.length > 0 && (
                  <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden">
                    {rxResults.map(rx => (
                      <button key={rx.id} type="button"
                        onMouseDown={() => { setPrescription(rx); setRxSearch(''); setRxResults([]); loadSuggestions(rx.id) }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between border-b border-slate-50 last:border-0">
                        <span className="font-medium text-sm text-primary">{rx.rxNo}</span>
                        <span className="text-xs text-slate-400">{format(new Date(rx.date), 'dd MMM yyyy')}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-2">Linking a prescription auto-fills billing items</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-background rounded-xl">
                <Badge variant="primary">{prescription.rxNo}</Badge>
                <span className="text-sm text-slate-500">{format(new Date(prescription.date), 'dd MMM yyyy')}</span>
                {prescription.diagnosis && <span className="text-sm text-slate-500">• {prescription.diagnosis}</span>}
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" icon={<Zap className="w-3.5 h-3.5"/>} onClick={() => loadSuggestions(prescription.id)}>Re-suggest</Button>
                  <Button variant="ghost" size="sm" onClick={() => setPrescription(null)}>Unlink</Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ③ Bill Items - inline table like medicines */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{patient ? '3' : '2'}</span>
              Bill Items
              <span className="text-xs text-slate-400 font-normal ml-1">- press Enter to jump to next row</span>
            </h3>
            <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5"/>} onClick={addItem}>Add Row</Button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 mb-2 px-1">
            <div className="col-span-6 text-xs font-semibold text-slate-400 uppercase tracking-wide">Item Name</div>
            <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Qty</div>
            <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Rate (₹)</div>
            <div className="col-span-1 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right">Amount</div>
            <div className="col-span-1"></div>
          </div>

          {/* Item rows */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-1 rounded-xl transition-colors ${item.name ? 'bg-blue-50/30' : ''}`}>
                {/* Item name */}
                <div className="col-span-6">
                  <ItemSearch
                    idx={idx}
                    value={item.name}
                    billingItems={billingItems}
                    onChange={name => updateItem(idx, 'name', name)}
                    onSelect={bi => selectBillingItem(idx, bi)}
                    onEnter={handleItemEnter}
                  />
                </div>
                {/* Qty */}
                <div className="col-span-2">
                  <input type="number" min="1"
                    className="w-full h-9 px-2 text-sm text-center font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white transition-all"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)} />
                </div>
                {/* Rate */}
                <div className="col-span-2">
                  <input type="number" min="0"
                    className="w-full h-9 px-2 text-sm text-right font-medium border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white transition-all"
                    placeholder="0"
                    value={item.rate}
                    onChange={e => updateItem(idx, 'rate', e.target.value)} />
                </div>
                {/* Amount */}
                <div className="col-span-1 text-right">
                  <span className="font-bold text-slate-700 text-sm">
                    ₹{((parseFloat(item.rate)||0) * (parseInt(item.qty)||1)).toLocaleString('en-IN')}
                  </span>
                </div>
                {/* Delete */}
                <div className="col-span-1 flex justify-center">
                  <button type="button" onClick={() => removeItem(idx)}
                    className="w-7 h-9 flex items-center justify-center text-slate-300 hover:text-danger rounded hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add row button */}
          <button type="button" onClick={addItem}
            className="mt-3 w-full border-2 border-dashed border-blue-100 rounded-xl py-2 text-sm text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4"/> Add Item Row
          </button>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Discount (₹)</span>
                <input type="number" min="0"
                  className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
                  value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800 pt-2 border-t-2 border-slate-200">
                <span>Total</span>
                <span className="text-lg">₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ④ Payment */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{patient ? '4' : '3'}</span>
            Payment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Payment Mode */}
            <div>
              <label className="form-label">Payment Mode</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PAYMENT_MODES.map(m => (
                  <button key={m} type="button" onClick={() => setPaymentMode(m)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all
                      ${paymentMode === m
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary bg-white'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid - auto-filled with total */}
            <div>
              <label className="form-label">Amount Paid (₹)</label>
              <input type="number" min="0" max={total}
                className="form-input text-xl font-bold text-success mt-1"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setAmountPaid(String(total))}
                  className="text-xs px-2.5 py-1 bg-success/10 text-success rounded-lg hover:bg-success/20 font-medium transition-colors">
                  Full ₹{total.toLocaleString('en-IN')}
                </button>
                <button type="button" onClick={() => setAmountPaid('0')}
                  className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">
                  Clear
                </button>
              </div>
            </div>

            {/* Status summary */}
            <div>
              <label className="form-label">Summary</label>
              <div className={`mt-1 p-3 rounded-xl border-2 transition-colors
                ${payStatus === 'Paid' ? 'border-success bg-green-50' : payStatus === 'Partial' ? 'border-warning bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`font-bold text-sm ${payStatus === 'Paid' ? 'text-success' : payStatus === 'Partial' ? 'text-warning' : 'text-slate-400'}`}>
                  {payStatus === 'Paid' ? '✅ Fully Paid' : payStatus === 'Partial' ? '⚡ Partial Payment' : '-'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paid: ₹{paid.toLocaleString('en-IN')} {balance > 0 && `| Balance: ₹${balance.toLocaleString('en-IN')}`}
                </p>
              </div>
            </div>
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" placeholder="Any payment notes..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="ghost" onClick={() => navigate('/billing')}>Cancel</Button>
          <Button variant="primary" loading={saving} size="lg" icon={<Save className="w-5 h-5"/>} onClick={handleSave}>
            Save Bill
          </Button>
        </div>
      </div>
    </div>
  )
}
