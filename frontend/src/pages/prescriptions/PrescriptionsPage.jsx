import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, FileText, User, Calendar } from 'lucide-react'
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'

export default function PrescriptionsPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [rxList,  setRxList]  = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  const fetchRx = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (search) params.set('search', search)
      const { data } = await api.get(`/prescriptions?${params}`)
      setRxList(data.data)
      setPagination(data.pagination)
    } catch {
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => fetchRx(1), 300)
    return () => clearTimeout(t)
  }, [fetchRx])

  const canWrite = ['DOCTOR', 'ADMIN'].includes(user?.role)

  return (
    <div className="fade-in">
      <PageHeader
        title="Prescriptions"
        subtitle={`${pagination.total} total prescriptions`}
        action={canWrite && (
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/prescriptions/new')}>
            New Prescription
          </Button>
        )}
      />

      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="form-input pl-9" placeholder="Search by patient name or Rx number..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8" /></div>
      ) : rxList.length === 0 ? (
        <EmptyState icon={<FileText className="w-8 h-8" />} title="No prescriptions yet"
          description="Write your first prescription to get started"
          action={canWrite && (
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/prescriptions/new')}>
              New Prescription
            </Button>
          )}
        />
      ) : (
        <div className="space-y-3">
          {rxList.map(rx => (
            <div key={rx.id}
              className="card flex items-center gap-4 hover:shadow-modal transition-shadow cursor-pointer"
              onClick={() => navigate(`/prescriptions/${rx.id}`)}>

              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800">{rx.patient?.name}</p>
                  <Badge variant="gray">{rx.rxNo}</Badge>
                  {rx.medicines?.length > 0 && (
                    <Badge variant="primary">{rx.medicines.length} medicines</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />{rx.doctor?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{format(new Date(rx.date), 'dd MMM yyyy')}
                  </span>
                  {rx.medicines?.slice(0,3).map(m => (
                    <span key={m.medicineName} className="hidden sm:inline">{m.medicineName}</span>
                  ))}
                </div>
              </div>

              <button className="btn-ghost btn-icon btn-sm flex-shrink-0">
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => fetchRx(p)}
                  className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all
                    ${p === pagination.page ? 'bg-primary text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-blue-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
