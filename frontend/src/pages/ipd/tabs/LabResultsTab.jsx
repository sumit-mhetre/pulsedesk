// Lab Results tab -- record + view lab test results during admission.
//
// Two entry styles:
//   1. STRUCTURED (when LabTest from catalog has expectedFields): per-parameter
//      fields with normal range hints. Auto-flags abnormal values.
//   2. FREE TEXT (default for unknown tests / quick entry): one big text area
//      for raw findings/impression.
//
// View:
//   - Group by test name
//   - Latest result on top per group
//   - Repeated tests show all results sorted desc by date

import { useEffect, useState } from 'react'
import {
  Plus, FlaskConical, Save, Pencil, Trash2, Calendar, AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { Card, Button, Badge, Modal, ConfirmDialog } from '../../../components/ui'
import api from '../../../lib/api'
import useAuthStore from '../../../store/authStore'
import { can } from '../../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

// Determine if a single value is outside normal range
function isAbnormal(value, normalLow, normalHigh) {
  if (normalLow === null && normalHigh === null) return false
  const n = parseFloat(value)
  if (Number.isNaN(n)) return false
  if (normalLow !== null && n < normalLow)  return true
  if (normalHigh !== null && n > normalHigh) return true
  return false
}

export default function LabResultsTab({ admission }) {
  const { user } = useAuthStore()
  const canWrite = can(user, 'manageIPD')

  const [results,   setResults]   = useState([])
  const [labTests,  setLabTests]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [deleting,  setDeleting]  = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [resR, testR] = await Promise.all([
        api.get(`/ipd/admissions/${admission.id}/lab-results`),
        api.get(`/ipd/lab-tests/catalog`),
      ])
      setResults(resR.data.data || [])
      setLabTests(testR.data.data || [])
    } catch (err) {
      toast.error('Failed to load lab results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [admission.id])

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.delete(`/ipd/lab-results/${deleting.id}`)
      toast.success('Result deleted')
      setDeleting(null)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner text-primary w-6 h-6"/></div>
  }

  // Group by testName for trending display
  const grouped = {}
  for (const r of results) {
    const key = r.testName.toLowerCase().trim()
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }
  Object.values(grouped).forEach(arr => arr.sort((a, b) => new Date(b.resultDate) - new Date(a.resultDate)))

  const groupKeys = Object.keys(grouped).sort()

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-700 text-base">
            Lab Results
            {results.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-1.5">({results.length})</span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Test results recorded during admission</p>
        </div>
        {canWrite && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
            onClick={() => { setEditing(null); setShowForm(true) }}>
            Record Result
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <Card className="p-10 text-center">
          <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-sm text-slate-500 mb-1">No lab results recorded</p>
          {canWrite && (
            <p className="text-xs text-slate-400">Click "Record Result" when reports come back from the lab.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {groupKeys.map(key => {
            const group = grouped[key]
            const latest = group[0]
            const hasHistory = group.length > 1

            // Color encoding: red border if any abnormal value, slate otherwise
            const hasAbnormal = latest.values?.some(v => isAbnormal(v.value, v.normalLow, v.normalHigh))
            const borderClass = hasAbnormal ? 'border-l-danger' : 'border-l-slate-300'

            return (
              <div key={key}
                className={`bg-white border border-slate-200 ${borderClass} border-l-4 rounded-lg px-3 py-2`}>
                {/* Header row: title, category, date, history badge, actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 text-sm">{latest.testName}</p>
                  {latest.testCategory && (
                    <span className="text-[10px] uppercase text-slate-400 tracking-wide">
                      {latest.testCategory}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 flex-1 min-w-0">
                    <Calendar className="w-3 h-3 inline mr-1"/>
                    {format(new Date(latest.resultDate), 'd MMM yyyy, hh:mm a')}
                  </span>
                  {hasHistory && (
                    <Badge variant="accent">
                      <TrendingUp className="w-3 h-3 inline mr-0.5"/>
                      {group.length}
                    </Badge>
                  )}
                  {canWrite && (
                    <>
                      <button onClick={() => { setEditing(latest); setShowForm(true) }}
                        className="text-xs text-primary hover:underline whitespace-nowrap">
                        <Pencil className="w-3 h-3 inline mr-0.5"/>Edit
                      </button>
                      <button onClick={() => setDeleting(latest)}
                        className="text-xs text-danger hover:underline whitespace-nowrap">
                        <Trash2 className="w-3 h-3 inline mr-0.5"/>Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Values / free text -- inline below header when present */}
                {(latest.values?.length > 0 || latest.freeTextResult || latest.notes) && (
                  <div className="mt-1.5">
                    <ResultDisplay result={latest} compact/>
                  </div>
                )}

                {/* History (collapsed) */}
                {hasHistory && (
                  <details className="mt-2 pt-2 border-t border-slate-100">
                    <summary className="text-[11px] uppercase font-semibold text-slate-500 cursor-pointer hover:text-slate-700">
                      Earlier readings ({group.length - 1})
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {group.slice(1).map(r => (
                        <div key={r.id} className="bg-slate-50 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-500">
                              {format(new Date(r.resultDate), 'd MMM yyyy, hh:mm a')}
                            </span>
                            {canWrite && (
                              <div className="flex gap-2">
                                <button onClick={() => { setEditing(r); setShowForm(true) }}
                                  className="text-primary hover:underline">Edit</button>
                                <button onClick={() => setDeleting(r)}
                                  className="text-danger hover:underline">Delete</button>
                              </div>
                            )}
                          </div>
                          <ResultDisplay result={r} compact/>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ResultFormModal
          admission={admission}
          labTests={labTests}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchData() }}/>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.testName}?`}
        message="This permanently removes the lab result. This action cannot be undone."
        variant="danger"
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}/>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ResultDisplay({ result, onEdit, onDelete, compact }) {
  const hasValues = result.values?.length > 0

  return (
    <div>
      {hasValues ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {result.values.map(v => {
            const abnormal = isAbnormal(v.value, v.normalLow, v.normalHigh)
            return (
              <div key={v.id}
                className={`p-2 rounded-lg ${abnormal ? 'bg-red-50 border border-red-200' : 'bg-slate-50'}`}>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {v.fieldLabel}{v.fieldUnit ? ` (${v.fieldUnit})` : ''}
                </p>
                <p className={`text-sm font-semibold ${abnormal ? 'text-danger' : 'text-slate-700'}`}>
                  {v.value}
                  {abnormal && <AlertCircle className="w-3 h-3 inline ml-1"/>}
                </p>
                {(v.normalLow !== null || v.normalHigh !== null) && (
                  <p className="text-[10px] text-slate-400">
                    Normal: {v.normalLow ?? '—'} - {v.normalHigh ?? '—'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {result.freeTextResult && (
        <div className={hasValues ? 'mt-2' : ''}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.freeTextResult}</p>
        </div>
      )}

      {result.notes && (
        <p className="text-xs text-slate-500 italic mt-1">{result.notes}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function ResultFormModal({ admission, labTests, initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    labTestId:      initial?.labTestId      || '',
    testName:       initial?.testName       || '',
    testCategory:   initial?.testCategory   || '',
    resultDate:     initial?.resultDate ? toLocalInput(initial.resultDate) : toLocalInput(new Date()),
    freeTextResult: initial?.freeTextResult || '',
    notes:          initial?.notes          || '',
  })
  const [values, setValues] = useState(() => {
    if (initial?.values?.length > 0) {
      return initial.values.map(v => ({
        fieldKey: v.fieldKey,
        fieldLabel: v.fieldLabel,
        fieldUnit: v.fieldUnit,
        value: v.value,
        normalLow: v.normalLow,
        normalHigh: v.normalHigh,
      }))
    }
    return []
  })
  const [saving, setSaving] = useState(false)

  // When user picks a labTest from catalog, populate testName + structured fields
  const onPickTest = (testId) => {
    const test = labTests.find(t => t.id === testId)
    if (!test) {
      setForm(f => ({ ...f, labTestId: '', testName: '', testCategory: '' }))
      setValues([])
      return
    }
    setForm(f => ({
      ...f,
      labTestId: test.id,
      testName: test.name,
      testCategory: test.category || '',
    }))

    // Initialize structured values from expectedFields if provided
    if (Array.isArray(test.expectedFields) && test.expectedFields.length > 0) {
      setValues(test.expectedFields.map(ef => ({
        fieldKey: ef.key,
        fieldLabel: ef.label,
        fieldUnit: ef.unit || null,
        value: '',
        normalLow: ef.normalLow ?? null,
        normalHigh: ef.normalHigh ?? null,
      })))
    } else {
      setValues([])
    }
  }

  const updateValue = (idx, val) => {
    const next = [...values]
    next[idx] = { ...next[idx], value: val }
    setValues(next)
  }

  const submit = async () => {
    if (!form.testName.trim()) return toast.error('Test name is required')
    if (!form.resultDate) return toast.error('Result date is required')

    // Filter out values with empty fields (allow partial entry)
    const filledValues = values.filter(v => v.value !== '' && v.value !== null && v.value !== undefined)

    setSaving(true)
    try {
      const payload = {
        labTestId:      form.labTestId || undefined,
        testName:       form.testName.trim(),
        testCategory:   form.testCategory.trim() || undefined,
        resultDate:     form.resultDate,
        freeTextResult: form.freeTextResult.trim() || undefined,
        notes:          form.notes.trim() || undefined,
        values:         filledValues.length > 0 ? filledValues : undefined,
      }
      if (isEdit) {
        await api.put(`/ipd/lab-results/${initial.id}`, payload)
        toast.success('Result updated')
      } else {
        await api.post(`/ipd/admissions/${admission.id}/lab-results`, payload)
        toast.success('Result recorded')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Result' : 'Record Lab Result'} size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={submit}>
            Save
          </Button>
        </>
      }>
      <div className="space-y-3">
        {/* Test picker */}
        <div className="form-group">
          <label className="form-label">Test</label>
          {!isEdit && (
            <select className="form-select" value={form.labTestId}
              onChange={e => onPickTest(e.target.value)}>
              <option value="">— Pick from catalog (or type custom name below) —</option>
              {labTests.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.category ? ` (${t.category})` : ''}
                </option>
              ))}
            </select>
          )}
          <input className={`form-input ${!isEdit ? 'mt-2' : ''}`}
            value={form.testName} placeholder="Or type custom test name"
            onChange={e => setForm(f => ({ ...f, testName: e.target.value }))}/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="form-input" value={form.testCategory}
              placeholder="e.g. Haematology, Biochemistry"
              onChange={e => setForm(f => ({ ...f, testCategory: e.target.value }))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Result Date *</label>
            <input type="datetime-local" className="form-input"
              value={form.resultDate}
              onChange={e => setForm(f => ({ ...f, resultDate: e.target.value }))}/>
          </div>
        </div>

        {/* Structured values (if catalog test with expectedFields) */}
        {values.length > 0 && (
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide mb-2">
              Parameters
            </p>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
              {values.map((v, idx) => {
                const abnormal = isAbnormal(v.value, v.normalLow, v.normalHigh)
                return (
                  <div key={idx} className="form-group mb-0">
                    <label className="form-label text-[11px]">
                      {v.fieldLabel}{v.fieldUnit ? ` (${v.fieldUnit})` : ''}
                      {(v.normalLow !== null || v.normalHigh !== null) && (
                        <span className="text-slate-400 font-normal ml-1">
                          [{v.normalLow ?? '—'} - {v.normalHigh ?? '—'}]
                        </span>
                      )}
                    </label>
                    <input className={`form-input py-1.5 text-sm
                      ${abnormal ? 'border-danger ring-1 ring-danger/30' : ''}`}
                      value={v.value || ''}
                      onChange={e => updateValue(idx, e.target.value)}/>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Free text fallback */}
        <div className="form-group">
          <label className="form-label">
            Free Text Findings {values.length === 0 && <span className="text-slate-400 text-[11px] font-normal">(if structured fields not used)</span>}
          </label>
          <textarea className="form-input" rows={values.length > 0 ? 2 : 4}
            value={form.freeTextResult}
            onChange={e => setForm(f => ({ ...f, freeTextResult: e.target.value }))}
            placeholder="Findings, impression, or full report text..."/>
        </div>

        <div className="form-group">
          <label className="form-label">Notes / Interpretation</label>
          <input className="form-input" value={form.notes}
            placeholder="e.g. Trending down, clinically improving"
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
        </div>
      </div>
    </Modal>
  )
}
