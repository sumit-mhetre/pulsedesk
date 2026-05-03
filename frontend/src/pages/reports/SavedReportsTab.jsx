import { useEffect, useState } from 'react'
import { Play, Trash2, Edit3, Share2, Lock, FileBarChart2, Download, ChevronDown, FileSpreadsheet, FileText, FileType2, FileDown } from 'lucide-react'
import { Button, Spinner, Modal, EmptyState, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const TYPE_META = {
  patients:      { label: 'Patients',      icon: '👥', bg: 'bg-blue-50',  fg: 'text-primary' },
  prescriptions: { label: 'Prescriptions', icon: '📋', bg: 'bg-cyan-50',  fg: 'text-accent'  },
  bills:         { label: 'Bills',         icon: '💰', bg: 'bg-green-50', fg: 'text-success' },
  appointments:  { label: 'Appointments',  icon: '📅', bg: 'bg-orange-50',fg: 'text-warning' },
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return Math.floor(diff / 60)   + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + 'd ago'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SavedReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(null)   // id being run
  const [runResult, setRunResult] = useState(null) // { savedReport, result }
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const fetchReports = () => {
    setLoading(true)
    api.get('/reports/saved')
      .then(r => setReports(r.data.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchReports, [])

  const runReport = async (report) => {
    setRunning(report.id)
    try {
      const { data } = await api.post(`/reports/saved/${report.id}/run`, {})
      setRunResult(data.data)
      // Bump the visible runCount + lastRunAt optimistically
      setReports(curr => curr.map(r => r.id === report.id
        ? { ...r, lastRunAt: new Date().toISOString(), runCount: (r.runCount || 0) + 1 }
        : r
      ))
    } catch {} finally { setRunning(null) }
  }

  const deleteReport = async () => {
    const target = confirmDelete
    setConfirmDelete(null)
    try {
      await api.delete(`/reports/saved/${target.id}`)
      toast.success('Report deleted')
      setReports(curr => curr.filter(r => r.id !== target.id))
      if (runResult?.savedReport?.id === target.id) setRunResult(null)
    } catch {}
  }

  const updateReport = async ({ name, description, isShared }) => {
    try {
      const { data } = await api.put(`/reports/saved/${editTarget.id}`, { name, description, isShared })
      toast.success('Report updated')
      setReports(curr => curr.map(r => r.id === editTarget.id ? data.data : r))
      setEditTarget(null)
    } catch {}
  }

  const exportAs = async (format) => {
    if (!runResult) return
    const report = runResult.savedReport
    try {
      const t = toast.loading(`Preparing ${format.toUpperCase()}…`)
      const res = await api.post('/reports/export', {
        format,
        config: { ...report.config, type: report.reportType },
      }, { responseType: 'blob', silent: true })
      const blob = new Blob([res.data])
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${report.name.replace(/[^a-z0-9]/gi, '_')}.${format}`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${format.toUpperCase()}`, { id: t })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner/></div>

  if (!reports.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10">
        <EmptyState
          icon={<FileBarChart2 className="w-12 h-12"/>}
          title="No saved reports yet"
          description="Go to the Custom tab, configure a report and click 'Save' to see it here. You can run saved reports with one click anytime."
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4">
      {/* ── Left: list ── */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          {reports.length} saved {reports.length === 1 ? 'report' : 'reports'}
        </div>
        {reports.map(r => {
          const meta = TYPE_META[r.reportType] || { icon: '📄', bg: 'bg-slate-50', fg: 'text-slate-500', label: r.reportType }
          const isActive = runResult?.savedReport?.id === r.id
          return (
            <div
              key={r.id}
              onClick={() => runReport(r)}
              className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition ${
                isActive ? 'border-primary shadow-md ring-2 ring-primary/10' : 'border-slate-100 hover:border-primary/40 hover:shadow'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{r.name}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {r.isShared
                        ? <Share2 className="w-3.5 h-3.5 text-slate-400" title="Shared"/>
                        : <Lock   className="w-3.5 h-3.5 text-slate-400" title="Private"/>}
                    </div>
                  </div>
                  <p className={`text-xs font-semibold ${meta.fg} mt-0.5`}>{meta.label}</p>
                  {r.description && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span>Run {r.runCount || 0}×</span>
                    <span>•</span>
                    <span>Last {timeAgo(r.lastRunAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-3 pt-3 border-t border-slate-50">
                <button
                  onClick={(e) => { e.stopPropagation(); runReport(r) }}
                  disabled={running === r.id}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3"/> {running === r.id ? 'Running…' : 'Run'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditTarget(r) }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200 hover:text-primary hover:border-primary"
                  title="Edit metadata"
                >
                  <Edit3 className="w-3.5 h-3.5"/>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(r) }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200 hover:text-danger hover:border-danger"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Right: results ── */}
      <div className="space-y-4">
        {!runResult ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm">Click <strong className="text-primary">Run</strong> on any saved report to see results here</p>
          </div>
        ) : (
          <ResultsPanel runResult={runResult} onExport={exportAs}/>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteReport}
        title="Delete this report?"
        message={confirmDelete ? `"${confirmDelete.name}" will be permanently removed.` : ''}
      />

      {/* Edit modal */}
      <EditReportModal
        report={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={updateReport}
      />
    </div>
  )
}

// ── Results panel ───────────────────────────
function ResultsPanel({ runResult, onExport }) {
  const { savedReport, result } = runResult
  const typeLabel = TYPE_META[savedReport.reportType]?.label || savedReport.reportType

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">{savedReport.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{typeLabel} • {result.total.toLocaleString('en-IN')} records</p>
          </div>
          <ExportMenu onExport={onExport}/>
        </div>
      </div>

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
                    No records match this report's filters
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
      </div>
    </>
  )
}

// ── Export dropdown ─────────────────────────
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

// ── Edit modal ──────────────────────────────
function EditReportModal({ report, onClose, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (report) {
      setName(report.name || '')
      setDescription(report.description || '')
      setIsShared(report.isShared !== false)
    }
  }, [report])

  return (
    <Modal
      open={!!report}
      onClose={onClose}
      title="Edit report"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={async () => {
          if (!name.trim()) return toast.error('Please enter a name')
          setSaving(true)
          await onSave({ name: name.trim(), description: description.trim() || null, isShared })
          setSaving(false)
        }}>Save Changes</Button>
      </>}
    >
      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Report name *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea className="form-input" rows={2}
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

function formatCell(val, type) {
  if (val === null || val === undefined || val === '') return '-'
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
