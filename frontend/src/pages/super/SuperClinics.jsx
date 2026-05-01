import { useEffect, useState } from 'react'
import { Plus, Search, Building2, Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, PageHeader, EmptyState } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'
import ClinicManageModal from './ClinicManageModal'

const statusColors = { Active: 'success', Inactive: 'gray', Suspended: 'danger' }
const planColors   = { Pro: 'success', Standard: 'accent', Basic: 'primary' }

export default function SuperClinics() {
  const navigate = useNavigate()
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [manageId, setManageId] = useState(null)   // clinic id being managed

  const fetchClinics = async () => {
    try {
      const params = search ? `?search=${search}` : ''
      const { data } = await api.get(`/clinics${params}`)
      setClinics(data.data)
    } catch {
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchClinics() }, [])
  useEffect(() => {
    const t = setTimeout(fetchClinics, 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="fade-in">
      <PageHeader
        title="All Clinics"
        subtitle="Manage all registered clinics on SimpleRx EMR"
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/super/clinics/new')}>
            Add Clinic
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="form-input pl-9" placeholder="Search by code (CLN001) or name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner text-primary w-8 h-8" /></div>
        ) : clinics.length === 0 ? (
          <EmptyState icon={<Building2 className="w-8 h-8" />} title="No clinics found"
            action={<Button variant="primary" onClick={() => navigate('/super/clinics/new')}>Add First Clinic</Button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Clinic</th>
                  <th>Contact</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Patients</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary">
                        {c.code || '—'}
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{c.id.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="text-sm text-slate-500">{c.mobile || c.phone || '—'}</td>
                    <td><Badge variant={planColors[c.subscriptionPlan]}>{c.subscriptionPlan}</Badge></td>
                    <td><Badge variant={statusColors[c.status]}>{c.status}</Badge></td>
                    <td className="text-sm font-medium text-slate-700">{c._count?.users ?? '—'}</td>
                    <td className="text-sm font-medium text-slate-700">{c._count?.patients ?? '—'}</td>
                    <td className="text-sm text-slate-500">{format(new Date(c.createdAt), 'dd MMM yy')}</td>
                    <td className="text-right">
                      <Button variant="outline" size="sm"
                        icon={<SettingsIcon className="w-3.5 h-3.5"/>}
                        onClick={() => setManageId(c.id)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {manageId && (
        <ClinicManageModal
          clinicId={manageId}
          onClose={() => setManageId(null)}
          onChanged={fetchClinics}
        />
      )}
    </div>
  )
}
