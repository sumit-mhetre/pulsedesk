import { useEffect, useState } from 'react'
import { Building2, Users, FileText, Activity } from 'lucide-react'
import { StatCard, Card, PageHeader, Badge } from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'

export default function SuperDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/super/dashboard').then(({ data }) => setStats(data.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner text-primary w-8 h-8" />
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader title="Super Admin Dashboard" subtitle="Platform-wide overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clinics"   value={stats?.totalClinics}      icon={<Building2 className="w-6 h-6" />} color="bg-primary" />
        <StatCard label="Active Clinics"  value={stats?.activeClinics}     icon={<Activity className="w-6 h-6" />}  color="bg-success" />
        <StatCard label="Total Patients"  value={stats?.totalPatients}     icon={<Users className="w-6 h-6" />}     color="bg-secondary" />
        <StatCard label="Prescriptions"   value={stats?.totalPrescriptions}icon={<FileText className="w-6 h-6" />}  color="bg-accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="By Subscription Plan">
          <div className="space-y-3">
            {stats?.byPlan?.map(p => (
              <div key={p.subscriptionPlan} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <Badge variant={p.subscriptionPlan === 'Pro' ? 'success' : p.subscriptionPlan === 'Standard' ? 'accent' : 'primary'}>
                  {p.subscriptionPlan}
                </Badge>
                <span className="font-bold text-slate-700">{p._count.id} clinics</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recently Added Clinics">
          <div className="space-y-3">
            {stats?.recentClinics?.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-medium text-slate-700 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-400">{format(new Date(c.createdAt), 'dd MMM yyyy')}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={c.status === 'Active' ? 'success' : 'gray'}>{c.status}</Badge>
                  <Badge variant="primary">{c.subscriptionPlan}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
