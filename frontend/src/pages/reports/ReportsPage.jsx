import { useState } from 'react'
import { BarChart3, Wrench, Bookmark } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import DashboardTab     from './DashboardTab'
import CustomReportTab  from './CustomReportTab'
import SavedReportsTab  from './SavedReportsTab'

const TABS = [
  { key: 'dashboard', label: 'Dashboard',      icon: BarChart3, Component: DashboardTab,     description: 'Live overview with charts' },
  { key: 'custom',    label: 'Custom Report',  icon: Wrench,    Component: CustomReportTab,  description: 'Build your own report' },
  { key: 'saved',     label: 'Saved Reports',  icon: Bookmark,  Component: SavedReportsTab,  description: 'Your team\'s saved reports' },
]

export default function ReportsPage() {
  const [active, setActive] = useState('dashboard')
  const Current = TABS.find(t => t.key === active)?.Component || DashboardTab

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Insights into your clinic's performance"/>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 mb-5 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const activeStyle = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${
                activeStyle
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4"/>
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <Current/>
    </div>
  )
}
