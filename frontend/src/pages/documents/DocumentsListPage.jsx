import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileText, FileCheck, FileSymlink, Eye, Edit3, Trash2 } from 'lucide-react'
import { Button, Card, PageHeader, EmptyState, Badge, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import useAuthStore from '../../store/authStore'

const TYPE_FILTERS = [
  { key: 'ALL',          label: 'All',                 icon: FileText },
  { key: 'FITNESS_CERT', label: 'Fitness Certificate', icon: FileCheck },
  { key: 'MEDICAL_CERT', label: 'Medical Certificate', icon: FileText },
  { key: 'REFERRAL',     label: 'Referrals',           icon: FileSymlink },
]

const TYPE_BADGE = {
  FITNESS_CERT: { label: 'Fitness',  variant: 'success' },
  MEDICAL_CERT: { label: 'Medical',  variant: 'warning' },
  REFERRAL:     { label: 'Referral', variant: 'primary' },
}

export default function DocumentsListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canCreate = !!user?.permissions?.createDocuments

  const [type, setType]     = useState('ALL')
  const [q, setQ]           = useState('')
  const [page, setPage]     = useState(1)
  const [items, setItems]   = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  const limit = 20

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (type !== 'ALL') params.set('type', type)
      if (q.trim())       params.set('q', q.trim())

      const { data } = await api.get(`/documents?${params.toString()}`, { silent: true })
      setItems(data?.data?.items || [])
      setTotal(data?.data?.total || 0)
    } catch {
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchDocs() /* eslint-disable-next-line */ }, [type, page])

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); fetchDocs() }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line
  }, [q])

  const handleDelete = async () => {
    if (!confirm) return
    try {
      await api.delete(`/documents/${confirm.id}`)
      toast.success('Certificate deleted')
      setConfirm(null)
      fetchDocs()
    } catch {}
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Certificates"
        subtitle="Fitness certificates, medical leave certificates, and referral letters"
        action={canCreate && (
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={() => navigate('/documents/new')}>
            New Certificate
          </Button>
        )}
      />

      {/* Filter tabs */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setType(f.key); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition
                ${type === f.key
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <f.icon className="w-3.5 h-3.5"/>
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input
            type="text"
            className="form-input pl-9 w-full"
            placeholder="Search by certificate number or patient name..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10 text-slate-300"/>}
          title="No certificates yet"
          description={canCreate
            ? "Click 'New Certificate' to issue a fitness certificate, medical leave, or referral."
            : "No certificates have been issued."
          }
          action={canCreate && (
            <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={() => navigate('/documents/new')}>
              New Certificate
            </Button>
          )}
        />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2 px-2">Cert No</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Patient</th>
                    <th className="py-2 px-2">Doctor</th>
                    <th className="py-2 px-2">Issued</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(d => {
                    const badge = TYPE_BADGE[d.type] || { label: d.type, variant: 'primary' }
                    return (
                      <tr key={d.id} className="border-b border-slate-50 hover:bg-blue-50/30">
                        <td className="py-2 px-2 font-mono font-bold text-slate-800">{d.docNo}</td>
                        <td className="py-2 px-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <p className="font-semibold text-slate-800">{d.patientName}</p>
                          {d.patient?.patientCode && (
                            <p className="text-xs text-slate-400 font-mono">{d.patient.patientCode}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-slate-600">{d.doctor?.name || '-'}</td>
                        <td className="py-2 px-2 text-slate-500 text-xs">
                          {d.createdAt ? format(new Date(d.createdAt), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/documents/${d.id}/view`)}
                              title="View / Print"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4"/>
                            </button>
                            {canCreate && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/documents/${d.id}/edit`)}
                                  title="Edit"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-blue-50"
                                >
                                  <Edit3 className="w-4 h-4"/>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirm(d)}
                                  title="Delete"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-danger hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</Button>
                <span className="px-3 py-1 text-sm font-semibold">{page} / {totalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next →</Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Delete certificate?"
        message={confirm ? `This will permanently delete ${confirm.docNo} for ${confirm.patientName}. This cannot be undone.` : ''}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
      />
    </div>
  )
}
