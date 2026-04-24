import { useEffect, useState, useMemo } from 'react'
import { Download, Play, Save, RotateCcw, ChevronDown, FileSpreadsheet, FileText, FileType2, FileDown } from 'lucide-react'
import { Button, Spinner, Modal } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const PRESETS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d',        label: 'Last 7 days' },
  { key: '30d',       label: 'Last 30 days' },
  { key: '90d',       label: 'Last 90 days' },
  { key: 'month',     label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'year',      label: 'This year' },
  { key: 'custom',    label: 'Custom' },
]

const TYPES = [
  { key: 'patients',      label: 'Patients',      icon: '👥' },
  { key: 'prescriptions', label: 'Prescriptions', icon: '📋' },
  { key: 'bills',         label: 'Bills',         icon: '💰' },
  { key: 'appointments',  label: 'Appointments',  icon: '📅' },
]

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

function resolvePreset(preset) {
  const now = new Date()
  const today = new Date(now); today.setHours(0,0,0,0)
  let from = null, to = null

  switch (preset) {
    case 'today':     from = today; to = new Date(now); break
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      from = y; to = new Date(y); to.setHours(23,59,59,999); break
    }
    case '7d':   from = new Date(today); from.setDate(from.getDate() - 6); to = new Date(now); break
    case '30d':  from = new Date(today); from.setDate(from.getDate() - 29); to = new Date(now); break
    case '90d':  from = new Date(today); from.setDate(from.getDate() - 89); to = new Date(now); break
    case 'month':     from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now); break
    case 'lastMonth': from = new Date(now.getFullYear(), now.getMonth()-1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999); break
    case 'year':      from = new Date(now.getFullYear(), 0, 1); to = new Date(now); break
    case 'custom':    return { from: null, to: null, custom: true }
  }
  return {
    from: from ? from.toISOString().slice(0, 10) : null,
    to:   to   ? to.toISOString().slice(0, 10)   : null,
    custom: false,
  }
}

export default function CustomReportTab() {
  const [meta, setMeta] = useState(null)
  const [type, setType] = useState('patients')
  const [preset, setPreset] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [selectedCols, setSelectedCols] = useState([])
  const [filters, setFilters] = useState({})
  const [sortBy, setSortBy]   = useState('')
  const [sortDir, setSortDir] = useState('desc')
  const [doctors, setDoctors] = useState([])
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState(null)
  const [page, setPage]       = useState(1)
  const [viewMode, setViewMode] = useState('table') // table | summary
  const [saveModalOpen, setSaveModalOpen] = useState(false)

  // Load meta + doctors
  useEffect(() => {
    api.get('/reports/meta').then(r => {
      setMeta(r.data.data)
      // pre-select first 6 columns for default type
      const cols = r.data.data.columns[type] || []
      setSelectedCols(cols.slice(0, 6).map(c => c.key))
    })
    api.get('/users/doctors').then(r => setDoctors(r.data.data || []))
  }, [])

  // When type changes, reset columns to defaults
  useEffect(() => {
    if (!meta) return
    const cols = meta.columns[type] || []
    setSelectedCols(cols.slice(0, 6).map(c => c.key))
    setSortBy('')
    setFilters({})
    setResult(null)
  }, [type, meta])

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      return { from: customFrom || null, to: customTo || null }
    }
    const r = resolvePreset(preset)
    return { from: r.from, to: r.to }
  }, [preset, customFrom, customTo])

  const availableCols = meta?.columns[type] || []

  const toggleCol = (key) => {
    setSelectedCols(curr => curr.includes(key)
      ? curr.filter(k => k !== key)
      : [...curr, key]
    )
  }

  const run = async (pageOverride) => {
    if (!selectedCols.length) {
      toast.error('Pick at least one column')
      return
    }
    setRunning(true)
    try {
      const { data } = await api.post('/reports/query', {
        type,
        dateRange,
        filters,
        columns: selectedCols,
        sortBy,
        sortDir,
        page: pageOverride || 1,
        pageSize: 50,
      })
      setResult(data.data)
      setPage(pageOverride || 1)
    } catch (err) {
      console.error(err)
    } finally {
      setRunning(false)
    }
  }

  const exportAs = async (format) => {
    try {
      const t = toast.loading(`Preparing ${format.toUpperCase()} download…`)
      const res = await api.post('/reports/export', {
        format,
        config: { type, dateRange, filters, columns: selectedCols, sortBy, sortDir },
      }, {
        responseType: 'blob',
        silent: true,
      })
      const ext = format === 'xlsx' ? 'xlsx' : format
      const blob = new Blob([res.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `simplerx-${type}-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${format.toUpperCase()}`, { id: t })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  const reset = () => {
    setFilters({})
    setSortBy('')
    setSortDir('desc')
    setPreset('30d')
    setResult(null)
  }

  if (!meta) return <div className="flex justify-center py-20"><Spinner/></div>

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
      {/* ── Left panel: configuration ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Report type</h3>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  type === t.key
                    ? 'bg-primary text-white shadow'
                    : 'bg-slate-50 text-slate-700 hover:bg-blue-50'
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Date range</h3>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  preset === p.key
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex gap-2 mt-2">
              <input type="date" className="form-input text-xs" value={customFrom} onChange={e => setCustomFrom(e.target.value)}/>
              <input type="date" className="form-input text-xs" value={customTo}   onChange={e => setCustomTo(e.target.value)}/>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Filters</h3>
          <div className="space-y-2">
            <input
              className="form-input text-sm"
              placeholder="Search name/code/phone…"
              value={filters.search || ''}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
            {doctors.length > 1 && (
              <select className="form-select text-sm" value={filters.doctorId || ''} onChange={e => setFilters({ ...filters, doctorId: e.target.value || undefined })}>
                <option value="">All doctors</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {type === 'patients' && (
              <>
                <select className="form-select text-sm" value={filters.gender || ''} onChange={e => setFilters({ ...filters, gender: e.target.value || undefined })}>
                  <option value="">Any gender</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" className="form-input text-sm" placeholder="Min age"
                    value={filters.ageMin || ''}
                    onChange={e => setFilters({ ...filters, ageMin: e.target.value || undefined })}/>
                  <input type="number" className="form-input text-sm" placeholder="Max age"
                    value={filters.ageMax || ''}
                    onChange={e => setFilters({ ...filters, ageMax: e.target.value || undefined })}/>
                </div>
              </>
            )}
            {type === 'bills' && (
              <>
                <select className="form-select text-sm" value={filters.paymentStatus || ''} onChange={e => setFilters({ ...filters, paymentStatus: e.target.value || undefined })}>
                  <option value="">Any payment status</option>
                  <option>Paid</option><option>Partial</option><option>Pending</option>
                </select>
                <select className="form-select text-sm" value={filters.paymentMode || ''} onChange={e => setFilters({ ...filters, paymentMode: e.target.value || undefined })}>
                  <option value="">Any payment mode</option>
                  <option>Cash</option><option>Card</option><option>UPI</option><option>Online</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" className="form-input text-sm" placeholder="Min amount"
                    value={filters.amountMin || ''}
                    onChange={e => setFilters({ ...filters, amountMin: e.target.value || undefined })}/>
                  <input type="number" className="form-input text-sm" placeholder="Max amount"
                    value={filters.amountMax || ''}
                    onChange={e => setFilters({ ...filters, amountMax: e.target.value || undefined })}/>
                </div>
              </>
            )}
            {type === 'prescriptions' && (
              <input className="form-input text-sm" placeholder="Diagnosis contains…"
                value={filters.diagnosis || ''}
                onChange={e => setFilters({ ...filters, diagnosis: e.target.value || undefined })}/>
            )}
            {type === 'appointments' && (
              <select className="form-select text-sm" value={filters.appointmentStatus || ''} onChange={e => setFilters({ ...filters, appointmentStatus: e.target.value || undefined })}>
                <option value="">Any status</option>
                <option>Waiting</option><option>InConsultation</option><option>Done</option><option>Skipped</option><option>Cancelled</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Columns</h3>
          <div className="max-h-60 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100">
            {availableCols.map(c => (
              <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer text-sm select-none hover:bg-white rounded px-1.5">
                <input
                  type="checkbox"
                  checked={selectedCols.includes(c.key)}
                  onChange={() => toggleCol(c.key)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                <span className="text-slate-700">{c.label}</span>
                <span className="text-[10px] text-slate-400 uppercase ml-auto">{c.type}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Sort</h3>
          <div className="flex gap-2">
            <select className="form-select text-sm flex-1" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="">Default</option>
              {availableCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600"
            >
              {sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button variant="primary" icon={<Play className="w-4 h-4"/>} onClick={() => run(1)} loading={running} className="flex-1">
            Run Report
          </Button>
          <button
            onClick={reset}
            title="Reset"
            className="px-3 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-primary"
          >
            <RotateCcw className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* ── Right panel: results ── */}
      <div className="space-y-4">
        {!result && !running && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm">Configure filters and columns, then click <strong className="text-primary">Run Report</strong></p>
          </div>
        )}

        {running && <div className="flex justify-center py-12"><Spinner/></div>}

        {result && !running && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">{result.total.toLocaleString('en-IN')}</span>
                  <span className="text-sm text-slate-500">{type === 'bills' ? 'bills' : type === 'prescriptions' ? 'prescriptions' : type === 'appointments' ? 'appointments' : 'patients'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSaveModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 hover:border-primary hover:text-primary inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5"/> Save
                  </button>
                  <ExportMenu onExport={exportAs}/>
                </div>
              </div>
              <SummaryBar type={type} summary={result.summary}/>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {result.columns.map(c => (
                        <th key={c.key} className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 px-3 py-2.5 whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.length === 0 ? (
                      <tr>
                        <td colSpan={result.columns.length} className="text-center py-10 text-slate-400 italic">
                          No records match your filters
                        </td>
                      </tr>
                    ) : result.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/20">
                        {result.columns.map(c => (
                          <td key={c.key} className="px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap">
                            {formatCell(r[c.key], c.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {result.total > result.pageSize && (
                <div className="p-3 flex items-center justify-between text-sm bg-slate-50 border-t border-slate-100">
                  <span className="text-slate-500">
                    Page {page} of {Math.ceil(result.total / result.pageSize)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => run(page - 1)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
                    >‹ Prev</button>
                    <button
                      disabled={page >= Math.ceil(result.total / result.pageSize)}
                      onClick={() => run(page + 1)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
                    >Next ›</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save modal */}
      <SaveReportModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={async ({ name, description, isShared }) => {
          try {
            await api.post('/reports/saved', {
              name, description, isShared,
              reportType: type,
              config: { type, dateRange, filters, columns: selectedCols, sortBy, sortDir },
            })
            toast.success('Saved!')
            setSaveModalOpen(false)
          } catch {}
        }}
      />
    </div>
  )
}

// ── Summary strip ───────────────────────────
function SummaryBar({ type, summary }) {
  if (!summary || !Object.keys(summary).length) return null

  const chips = []
  if (type === 'patients' && summary.byGender) {
    Object.entries(summary.byGender).forEach(([k, v]) => chips.push({ label: k, value: v }))
    if (summary.avgAge) chips.push({ label: 'Avg age', value: summary.avgAge })
  }
  if (type === 'bills') {
    chips.push({ label: 'Billed', value: inr(summary.totalBilled) })
    chips.push({ label: 'Collected', value: inr(summary.totalCollected) })
    chips.push({ label: 'Pending',  value: inr(summary.totalPending) })
    if (summary.avg) chips.push({ label: 'Avg bill', value: inr(summary.avg) })
  }
  if (type === 'prescriptions') {
    if (summary.uniquePatients) chips.push({ label: 'Unique patients', value: summary.uniquePatients })
    if (summary.topDiagnoses?.length) chips.push({ label: 'Top diagnosis', value: summary.topDiagnoses[0][0] })
  }
  if (type === 'appointments' && summary.byStatus) {
    Object.entries(summary.byStatus).forEach(([k, v]) => chips.push({ label: k, value: v }))
  }

  if (!chips.length) return null

  return (
    <div className="flex gap-2 flex-wrap mt-3">
      {chips.map((c, i) => (
        <div key={i} className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs">
          <span className="text-slate-500">{c.label}: </span>
          <span className="font-bold text-primary">{c.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Export menu ─────────────────────────────
function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-primary-dark"
      >
        <Download className="w-3.5 h-3.5"/> Export
        <ChevronDown className="w-3 h-3"/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-20">
            {[
              { k: 'csv',  icon: FileDown,        label: 'CSV' },
              { k: 'xlsx', icon: FileSpreadsheet, label: 'Excel' },
              { k: 'pdf',  icon: FileText,        label: 'PDF' },
              { k: 'docx', icon: FileType2,       label: 'Word' },
            ].map(x => (
              <button
                key={x.k}
                onClick={() => { setOpen(false); onExport(x.k) }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 inline-flex items-center gap-2"
              >
                <x.icon className="w-4 h-4 text-slate-400"/> {x.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Save modal ──────────────────────────────
function SaveReportModal({ open, onClose, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setName(''); setDescription(''); setIsShared(true) } }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save this report"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={async () => {
          if (!name.trim()) return toast.error('Please enter a name')
          setSaving(true)
          await onSave({ name: name.trim(), description: description.trim() || null, isShared })
          setSaving(false)
        }}>Save Report</Button>
      </>}
    >
      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Report name *</label>
          <input className="form-input" placeholder='e.g. "Monthly Revenue"'
            value={name} onChange={e => setName(e.target.value)} autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea className="form-input" rows={2} placeholder="What this report shows"
            value={description} onChange={e => setDescription(e.target.value)}/>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"/>
          Share with everyone in the clinic
        </label>
      </div>
    </Modal>
  )
}

// ── Cell formatter ──────────────────────────
function formatCell(val, type) {
  if (val === null || val === undefined || val === '') return '—'
  if (type === 'currency') return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (type === 'date' || val instanceof Date) {
    const d = val instanceof Date ? val : new Date(val)
    if (isNaN(d)) return String(val)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (typeof val === 'string' && val.length > 80) {
    return <span title={val}>{val.slice(0, 80)}…</span>
  }
  return String(val)
}
