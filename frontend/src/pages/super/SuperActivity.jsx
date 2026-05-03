// Activity Logs (clinic-scoped) -- Super Admin > Settings > Activity Logs.
//
// Two states driven by the `clinicId` query param:
//
//   1. No clinicId  -> Clinic picker. Search box + clinic list. Click a
//                      clinic to enter the second state.
//   2. clinicId set -> Activity feed for that single clinic. Header shows
//                      the clinic name with a "Change clinic" button.
//                      Filter UI does NOT include a clinic dropdown
//                      because the URL param is the source of truth.
//
// All state lives in the URL query (?clinicId=...) so back/forward and
// refresh work naturally.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  History, Search, Filter, X, Building2, Calendar,
  RefreshCw, ArrowLeft, ChevronRight,
} from 'lucide-react'
import {
  Card, Button, Badge, PageHeader, EmptyState,
} from '../../components/ui'
import api from '../../lib/api'
import { format } from 'date-fns'

const ACTION_META = {
  CREATE:                  { label: 'Created',                  color: 'success' },
  UPDATE:                  { label: 'Updated',                  color: 'primary' },
  DELETE:                  { label: 'Deleted',                  color: 'danger'  },
  LOGIN:                   { label: 'Logged in',                color: 'gray'    },
  LOGOUT:                  { label: 'Logged out',               color: 'gray'    },
  PASSWORD_RESET:          { label: 'Password reset',           color: 'warning' },
  'clinic.create':         { label: 'Clinic created',           color: 'success' },
  'clinic.update':         { label: 'Clinic info updated',      color: 'primary' },
  'clinic.plan_change':    { label: 'Plan changed',             color: 'warning' },
  'clinic.status_change':  { label: 'Status changed',           color: 'warning' },
  'admin.password_reset':  { label: 'Admin password reset',     color: 'danger'  },
  'super.user_create':     { label: 'User created (super)',     color: 'success' },
  'super.user_update':     { label: 'User updated (super)',     color: 'primary' },
  'user.create':           { label: 'User created',             color: 'success' },
  'user.update':           { label: 'User updated',             color: 'primary' },
}

const PLAN_COLORS   = { Pro: 'success', Standard: 'accent', Basic: 'primary' }
const STATUS_COLORS = { Active: 'success', Inactive: 'gray', Suspended: 'danger' }
const PAGE_SIZE = 50

export default function SuperActivity() {
  const [searchParams, setSearchParams] = useSearchParams()
  const clinicId = searchParams.get('clinicId') || ''

  if (!clinicId) {
    return <ClinicPickerView onSelect={(id) => setSearchParams({ clinicId: id })} />
  }
  return (
    <ClinicActivityView
      key={clinicId}        // remount on clinic change to reset filters
      clinicId={clinicId}
      onChangeClinic={() => setSearchParams({})}
    />
  )
}

// ── Clinic picker state ────────────────────────────────────
function ClinicPickerView({ onSelect }) {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    api.get('/super/activity/filters')
      .then(({ data }) => setClinics(data.data.clinics || []))
      .catch(() => setClinics([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clinics
    return clinics.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q)
    )
  }, [clinics, search])

  return (
    <div className="fade-in">
      <PageHeader
        title="Activity Logs"
        subtitle="Pick a clinic to view its audit log"
      />

      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="form-input pl-9"
            placeholder="Search by clinic code (CLN001) or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner text-primary w-8 h-8" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title={clinics.length === 0 ? 'No clinics yet' : 'No clinics match'}
            description={clinics.length === 0 ? 'Create a clinic to start tracking activity.' : 'Try a different search.'}
          />
        ) : (
          <div className="space-y-1">
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-slate-100 hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{c.code || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.subscriptionPlan && (
                    <Badge variant={PLAN_COLORS[c.subscriptionPlan] || 'primary'}>
                      {c.subscriptionPlan}
                    </Badge>
                  )}
                  {c.status && (
                    <Badge variant={STATUS_COLORS[c.status] || 'gray'}>{c.status}</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Per-clinic activity feed ───────────────────────────────
function emptyFilters() {
  return {
    search: '',
    action: '',
    entity: '',
    actorIsSuperAdmin: '',
    from: '',
    to: '',
  }
}

function ClinicActivityView({ clinicId, onChangeClinic }) {
  const [filters, setFilters]     = useState(emptyFilters())
  const [committed, setCommitted] = useState(emptyFilters())
  const [logs, setLogs]           = useState([])
  const [cursor, setCursor]       = useState(null)
  const [hasMore, setHasMore]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterOpts, setFilterOpts]   = useState({ actions: [], entities: [], clinics: [] })
  const [showFilters, setShowFilters] = useState(false)
  const [clinic, setClinic]           = useState(null)

  // Filters scoped to this clinic so action/entity counts reflect reality
  useEffect(() => {
    api.get(`/super/activity/filters?clinicId=${encodeURIComponent(clinicId)}`)
      .then(({ data }) => {
        setFilterOpts(data.data)
        const found = (data.data.clinics || []).find(c => c.id === clinicId) || null
        setClinic(found)
      })
      .catch(() => {})
  }, [clinicId])

  const buildParams = (cursorVal) => {
    const params = new URLSearchParams()
    params.set('clinicId', clinicId)
    params.set('limit', String(PAGE_SIZE))
    if (cursorVal) params.set('cursor', cursorVal)
    if (committed.search)            params.set('search', committed.search.trim())
    if (committed.action)            params.set('action', committed.action)
    if (committed.entity)            params.set('entity', committed.entity)
    if (committed.actorIsSuperAdmin) params.set('actorIsSuperAdmin', committed.actorIsSuperAdmin)
    if (committed.from)              params.set('from', new Date(committed.from).toISOString())
    if (committed.to) {
      const d = new Date(committed.to); d.setHours(23, 59, 59, 999)
      params.set('to', d.toISOString())
    }
    return params.toString()
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get(`/super/activity?${buildParams(null)}`)
      .then(({ data }) => {
        if (!alive) return
        setLogs(data.data.items)
        setCursor(data.data.nextCursor)
        setHasMore(data.data.hasMore)
      })
      .catch(() => alive && setLogs([]))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, clinicId])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const { data } = await api.get(`/super/activity?${buildParams(cursor)}`)
      setLogs(prev => [...prev, ...data.data.items])
      setCursor(data.data.nextCursor)
      setHasMore(data.data.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }

  const apply = () => setCommitted({ ...filters })
  const clearAll = () => {
    const e = emptyFilters()
    setFilters(e); setCommitted(e)
  }
  const onSearchEnter = (e) => { if (e.key === 'Enter') apply() }

  const setPreset = (preset) => {
    const today = new Date()
    const toStr = format(today, 'yyyy-MM-dd')
    let fromStr = ''
    if (preset === 'today')   fromStr = toStr
    if (preset === 'last7')   { const d = new Date(today); d.setDate(d.getDate() - 6);  fromStr = format(d, 'yyyy-MM-dd') }
    if (preset === 'last30')  { const d = new Date(today); d.setDate(d.getDate() - 29); fromStr = format(d, 'yyyy-MM-dd') }
    const next = { ...filters, from: fromStr, to: toStr }
    setFilters(next); setCommitted(next)
  }

  const activeCount = useMemo(() => {
    let n = 0
    if (committed.search)            n++
    if (committed.action)            n++
    if (committed.entity)            n++
    if (committed.actorIsSuperAdmin) n++
    if (committed.from || committed.to) n++
    return n
  }, [committed])

  return (
    <div className="fade-in">
      <PageHeader
        title="Activity Logs"
        subtitle={
          clinic
            ? `${clinic.name}${clinic.code ? ` · ${clinic.code}` : ''}`
            : 'Loading clinic...'
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={onChangeClinic}
            >
              Change clinic
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setCommitted({ ...committed })}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="form-input pl-9"
              placeholder="Search action, email, entity, ID..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={onSearchEnter}
            />
          </div>
          <Button variant="primary" onClick={apply}>Apply</Button>
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            icon={<Filter className="w-3.5 h-3.5" />}
            onClick={() => setShowFilters(s => !s)}
          >
            Filters {activeCount > 0 && <span className="ml-1 bg-white/20 rounded px-1.5 text-xs">{activeCount}</span>}
          </Button>
          {activeCount > 0 && (
            <Button variant="outline" icon={<X className="w-3.5 h-3.5" />} onClick={clearAll}>
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Quick range:</span>
          <button onClick={() => setPreset('today')}  className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600">Today</button>
          <button onClick={() => setPreset('last7')}  className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600">Last 7 days</button>
          <button onClick={() => setPreset('last30')} className="px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600">Last 30 days</button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Action</label>
              <select
                className="form-select"
                value={filters.action}
                onChange={e => setFilters({ ...filters, action: e.target.value })}
              >
                <option value="">All actions</option>
                {filterOpts.actions.map(a => (
                  <option key={a.value} value={a.value}>
                    {(ACTION_META[a.value]?.label || a.value)} ({a.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Entity</label>
              <select
                className="form-select"
                value={filters.entity}
                onChange={e => setFilters({ ...filters, entity: e.target.value })}
              >
                <option value="">All entities</option>
                {filterOpts.entities.map(en => (
                  <option key={en.value} value={en.value}>
                    {en.value} ({en.count})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Actor type</label>
              <select
                className="form-select"
                value={filters.actorIsSuperAdmin}
                onChange={e => setFilters({ ...filters, actorIsSuperAdmin: e.target.value })}
              >
                <option value="">Anyone</option>
                <option value="yes">Super Admin only</option>
                <option value="no">Clinic users only</option>
              </select>
            </div>
            <div>
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-input"
                value={filters.from}
                onChange={e => setFilters({ ...filters, from: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-input"
                value={filters.to}
                onChange={e => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <Button variant="outline" onClick={clearAll}>Reset</Button>
              <Button variant="primary" onClick={apply}>Apply Filters</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner text-primary w-8 h-8" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<History className="w-8 h-8" />}
            title="No activity matches"
            description={activeCount > 0 ? 'Try adjusting filters or clearing them.' : 'No audit entries yet for this clinic.'}
            action={activeCount > 0
              ? <Button variant="outline" onClick={clearAll}>Clear filters</Button>
              : null}
          />
        ) : (
          <>
            <div className="space-y-2">
              {logs.map(log => <ActivityRow key={log.id} log={log} />)}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                  Load more
                </Button>
              </div>
            )}
            {!hasMore && logs.length >= PAGE_SIZE && (
              <p className="text-center text-xs text-slate-400 mt-4">- end of feed -</p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

// ── Single audit row ───────────────────────────────────────
function ActivityRow({ log }) {
  const meta = ACTION_META[log.action] || { label: log.action, color: 'gray' }
  const actorName = log.actorIsSuperAdmin
    ? `Super Admin${log.actorEmail ? ` (${log.actorEmail})` : ''}`
    : (log.user?.name || log.actorEmail || 'Unknown')
  const date = log.createdAt ? new Date(log.createdAt) : null

  const d = log.details || {}
  let detailLine = ''
  if (log.action === 'clinic.update' && Array.isArray(d.fieldsChanged)) {
    detailLine = `Changed: ${d.fieldsChanged.join(', ')}`
  } else if (log.action === 'clinic.plan_change') {
    detailLine = `New plan: ${d.subscriptionPlan}`
  } else if (log.action === 'clinic.status_change') {
    detailLine = `New status: ${d.status}`
  } else if (log.action === 'clinic.create') {
    detailLine = d.adminCreated ? `Admin: ${d.adminEmail}` : 'No admin account'
  } else if (log.action === 'admin.password_reset') {
    detailLine = `For: ${d.adminEmail}`
  } else if (log.action === 'super.user_create' || log.action === 'user.create') {
    detailLine = `${d.role || 'user'}: ${d.name || ''}${d.email ? ` (${d.email})` : ''}`
  } else if (log.action === 'super.user_update' || log.action === 'user.update') {
    detailLine = `${d.name || ''} - changed: ${(d.fieldsChanged || []).join(', ') || '(no fields)'}`
  } else if (log.entityId) {
    detailLine = `${log.entity} · ${String(log.entityId).slice(0, 12)}${String(log.entityId).length > 12 ? '...' : ''}`
  } else if (log.entity) {
    detailLine = log.entity
  }

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-white">
      <Badge variant={meta.color}>{meta.label}</Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate">
          <span className="font-medium">{actorName}</span>
          {log.actorIsSuperAdmin && <span className="text-xs text-warning ml-2">★ super</span>}
          {log.user?.role && !log.actorIsSuperAdmin && (
            <span className="text-xs text-slate-400 ml-2">· {log.user.role}</span>
          )}
        </p>
        {detailLine && <p className="text-xs text-slate-500 mt-0.5 truncate">{detailLine}</p>}
      </div>
      <div className="text-right text-xs text-slate-400 flex-shrink-0">
        {date && (
          <>
            <p>{date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
            <p>{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </>
        )}
        {log.ip && <p className="text-[10px] mt-0.5 font-mono opacity-60">{log.ip}</p>}
      </div>
    </div>
  )
}
