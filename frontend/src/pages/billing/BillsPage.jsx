import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Receipt, Calendar, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'

const STATUS_STYLE = {
  Paid:    { badge: 'success', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  Partial: { badge: 'warning', icon: <Clock className="w-3.5 h-3.5" /> },
  Pending: { badge: 'danger',  icon: <Clock className="w-3.5 h-3.5" /> },
}

export default function BillsPage() {
  const navigate = useNavigate()
  const [bills,  setBills]  = useState([])
  const [loading,setLoading]= useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [summary, setSummary] = useState(null)

  const fetchBills = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const { data } = await api.get(`/billing?${params}`)
      setBills(data.data)
      setPagination(data.pagination)
    } catch {} finally { setLoading(false) }
  }, [search, status])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => fetchBills(1), 300)
    return () => clearTimeout(t)
  }, [fetchBills])

  useEffect(() => {
    api.get('/billing/summary').then(({ data }) => setSummary(data.data)).catch(() => {})
  }, [])

  return (
    <div className="fade-in">
      <PageHeader title="Billing" subtitle={`${pagination.total} total bills`}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={() => navigate('/billing/new')}>
            New Bill
          </Button>
        }
      />

      {/* Today's Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Today's Bills", value: summary.count, icon: Receipt, color: 'text-primary', bg: 'bg-blue-50' },
            { label: 'Total Billed', value: `₹${summary.totalBilled.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-success', bg: 'bg-green-50' },
            { label: 'Collected', value: `₹${summary.totalCollected.toLocaleString('en-IN')}`, icon: CheckCircle, color: 'text-success', bg: 'bg-green-50' },
            { label: 'Pending', value: `₹${summary.totalPending.toLocaleString('en-IN')}`, icon: Clock, color: 'text-warning', bg: 'bg-orange-50' },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input className="form-input pl-9" placeholder="Search by patient or bill number..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select w-40" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </Card>

      {/* Bills List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
      ) : bills.length === 0 ? (
        <EmptyState icon={<Receipt className="w-8 h-8"/>} title="No bills yet"
          description="Create your first bill to get started"
          action={<Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={() => navigate('/billing/new')}>New Bill</Button>}
        />
      ) : (
        <div className="space-y-3">
          {bills.map(bill => (
            <div key={bill.id} onClick={() => navigate(`/billing/${bill.id}`)}
              className="card flex items-center gap-4 hover:shadow-modal transition-shadow cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-green-50 text-success flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800">{bill.patient?.name}</p>
                  <Badge variant="gray">{bill.billNo}</Badge>
                  <Badge variant={STATUS_STYLE[bill.paymentStatus]?.badge || 'gray'}>
                    {bill.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(bill.date), 'dd MMM yyyy')}</span>
                  <span>{bill.items?.length} item{bill.items?.length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-slate-600">₹{bill.total.toLocaleString('en-IN')}</span>
                  {bill.balance > 0 && <span className="text-warning">Balance: ₹{bill.balance.toLocaleString('en-IN')}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-success text-lg">₹{bill.amountPaid.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400">collected</p>
              </div>
              <button className="btn-ghost btn-icon btn-sm flex-shrink-0"><Eye className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
