// Inline editor for Section 11 "On Discharge Rx (Medications)" of the
// discharge summary. Replaces the older one-modal-per-medication flow with
// a multi-row inline table similar to NewPrescriptionPage.
//
// Behavior:
//   - Existing medications render as editable rows.
//   - Click "+ Add Medication" to append a blank row — fill it inline.
//   - Picking a medicine from the autocomplete:
//       * fills brandName + genericName from the catalog
//       * fetches the doctor's preferences for that medicine and pre-fills
//         dose, frequency, duration (mapped from `days`) and instructions.
//   - A row is persisted (POST or PUT) on blur of the medicine input OR when
//     the user changes any of dose/frequency/duration. Required fields
//     (brandName + dose + frequency + duration) must all be present before
//     the save fires; otherwise we keep the row as a draft.
//   - "Save All" is intentionally absent — autosave matches the OPD Rx page
//     flow doctors are already familiar with.
//   - Delete row via inline trash icon.

import { useEffect, useRef, useState } from 'react'
import { Plus, Pill, Trash2, AlertCircle, Search } from 'lucide-react'
import { Button } from '../../../components/ui'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

const FREQ_PRESETS = ['1-0-0', '0-0-1', '1-0-1', '1-1-1', 'BD', 'TDS', 'QID', 'SOS', 'STAT']
const DURATION_PRESETS = ['3 days', '5 days', '7 days', '10 days', '15 days', '1 month', 'Continue']
const INSTR_PRESETS = ['After food', 'Before food', 'With water', 'At bedtime', 'Empty stomach']

// Shape of a row in state. id present = saved on server. id null = draft.
//   { id, _localKey, medicineId, brandName, genericName, dose, frequency,
//     duration, instructions, _saving, _error }
function emptyRow() {
  return {
    id: null,
    _localKey: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicineId: null,
    brandName: '',
    genericName: '',
    dose: '',
    frequency: '',
    duration: '',
    instructions: '',
    _saving: false,
    _error: null,
  }
}

const isComplete = (r) => !!(r.brandName?.trim() && r.dose?.trim() && r.frequency?.trim() && r.duration?.trim())

export default function DischargeMedicationsEditor({
  admissionId,
  meds,
  setMeds,
  editable,
  onAddBlankRow,        // optional - parent can also push from "Copy from Active"
}) {
  // Local working copy synced from props. We mutate locally while the user
  // types, then push back via setMeds whenever a row is saved.
  const [rows, setRows] = useState(() => {
    const seeded = (meds || []).map(m => ({
      ...emptyRow(),
      ...m,
      _localKey: m.id || `r-${m.id || Math.random()}`,
    }))
    return seeded.length > 0 ? seeded : []
  })

  // Pre-load a small page of medicines so the row dropdown can show
  // results IMMEDIATELY on focus without waiting for a 2-character search.
  // Each row still fires its own debounced search when the user types,
  // but this lets "click → see list → pick" happen in one beat.
  const [allMedicines, setAllMedicines] = useState([])
  useEffect(() => {
    api.get('/medicines', { params: { limit: 50 }, silent: true })
      .then(({ data }) => setAllMedicines(data?.data || data?.medicines || []))
      .catch(() => setAllMedicines([]))
  }, [])

  // Resync rows when parent meds list changes (e.g. after "Copy from Active").
  // We preserve any unsaved drafts the user has open.
  useEffect(() => {
    setRows(prev => {
      const drafts = prev.filter(r => !r.id)
      const saved = (meds || []).map(m => ({
        ...emptyRow(),
        ...m,
        _localKey: m.id,
      }))
      return [...saved, ...drafts]
    })
  }, [meds])

  const updateRow = (key, patch) => {
    setRows(prev => prev.map(r => r._localKey === key ? { ...r, ...patch } : r))
  }

  const removeRow = async (row) => {
    if (!row.id) {
      // Draft - just drop locally
      setRows(prev => prev.filter(r => r._localKey !== row._localKey))
      return
    }
    if (!window.confirm(`Remove ${row.brandName} from discharge prescription?`)) return
    try {
      await api.delete(`/ipd/discharge-medications/${row.id}`)
      setRows(prev => prev.filter(r => r._localKey !== row._localKey))
      setMeds(prev => prev.filter(m => m.id !== row.id))
      toast.success('Medication removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  // Autosave: called when a row's required fields are all set and the user
  // moves focus away (blur). Creates if no id, updates otherwise.
  const persistRow = async (row) => {
    if (!isComplete(row)) return // not enough to save yet
    if (row._saving) return       // in flight
    updateRow(row._localKey, { _saving: true, _error: null })
    const payload = {
      medicineId:   row.medicineId || null,
      brandName:    row.brandName.trim(),
      genericName:  row.genericName?.trim() || null,
      dose:         row.dose.trim(),
      frequency:    row.frequency.trim(),
      duration:     row.duration.trim(),
      instructions: row.instructions?.trim() || null,
    }
    try {
      if (row.id) {
        const { data } = await api.put(`/ipd/discharge-medications/${row.id}`, payload)
        const saved = data.data
        updateRow(row._localKey, { ...saved, _saving: false })
        setMeds(prev => prev.map(m => m.id === saved.id ? saved : m))
      } else {
        const { data } = await api.post(`/ipd/admissions/${admissionId}/discharge-medications`, payload)
        const saved = data.data
        updateRow(row._localKey, { ...saved, _localKey: saved.id, _saving: false })
        setMeds(prev => [...prev, saved])
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save'
      updateRow(row._localKey, { _saving: false, _error: msg })
      toast.error(msg)
    }
  }

  const addBlankRow = () => {
    const r = emptyRow()
    setRows(prev => [...prev, r])
    if (onAddBlankRow) onAddBlankRow(r)
  }

  // Called after a row's medicine is picked. If this was the LAST row in the
  // table, automatically append a fresh empty row below so the doctor can keep
  // typing without clicking "+ Add Medication" between every entry. Mirrors
  // the OPD prescription page behavior.
  const appendBlankRowIfLast = (rowKey) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r._localKey === rowKey)
      if (idx === -1) return prev
      if (idx !== prev.length - 1) return prev   // not the last row
      return [...prev, emptyRow()]
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" size="sm" disabled={!editable}
          icon={<Plus className="w-4 h-4"/>}
          onClick={addBlankRow}>
          Add Medication
        </Button>
        <span className="text-xs text-slate-500 ml-auto">
          {rows.filter(r => r.id).length} item{rows.filter(r => r.id).length === 1 ? '' : 's'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          No discharge medications added yet. Click <strong>+ Add Medication</strong> to start.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-1.5 w-[28%]">Medication</th>
                <th className="text-left px-2 py-1.5 w-[12%]">Dose</th>
                <th className="text-left px-2 py-1.5 w-[14%]">Frequency</th>
                <th className="text-left px-2 py-1.5 w-[14%]">Duration</th>
                <th className="text-left px-2 py-1.5 w-[24%]">Instructions</th>
                <th className="px-2 py-1.5 w-[8%]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <DischargeMedRow
                  key={row._localKey}
                  row={row}
                  editable={editable}
                  initialMedicines={allMedicines}
                  onChange={(patch) => updateRow(row._localKey, patch)}
                  onPersist={() => persistRow(row)}
                  onRemove={() => removeRow(row)}
                  onPickedMedicine={() => appendBlankRowIfLast(row._localKey)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// One row of the discharge medications table.
function DischargeMedRow({ row, editable, initialMedicines, onChange, onPersist, onRemove, onPickedMedicine }) {
  const [query, setQuery] = useState(row.brandName || '')
  const [suggestions, setSugg] = useState([])
  const [showSugg, setShowSugg] = useState(false)
  const debounceRef = useRef(null)
  const justPickedRef = useRef(false)
  const blurTimerRef = useRef(null)

  // Keep the input in sync if the row is patched externally (e.g. doctor pref auto-fill).
  useEffect(() => {
    if (row.brandName !== query) setQuery(row.brandName || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.brandName])

  // Search behavior:
  //   - No query (empty input on focus): show the parent-loaded `initialMedicines`
  //     list directly. Lets "click → pick" happen without typing.
  //   - Query >= 2 chars: debounced server search.
  useEffect(() => {
    if (justPickedRef.current) { justPickedRef.current = false; return }
    const q = (query || '').trim()
    if (q.length === 0) {
      setSugg(initialMedicines || [])
      return
    }
    if (q.length < 2) { setSugg([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/medicines', { params: { search: q, limit: 8 } })
        const list = data?.data || data?.medicines || []
        setSugg(list)
      } catch { setSugg([]) }
    }, 250)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query, initialMedicines])

  // Pick a medicine from the suggestions list. Fills brandName, genericName,
  // medicineId and ALSO tries to pre-fill dose/frequency/duration/instructions
  // from this doctor's preferences (set by a previous Rx).
  const pickMedicine = async (m) => {
    justPickedRef.current = true
    setQuery(m.name)
    setShowSugg(false)
    const patch = {
      medicineId: m.id,
      brandName: m.name,
      genericName: m.genericName || row.genericName || '',
    }
    // Auto-fill missing fields from doctor preference (if any). We DON'T
    // overwrite values the user has already typed in this row.
    try {
      const { data } = await api.get(`/prescriptions/doctor-preferences/${m.id}`, { silent: true })
      const pref = data?.data
      if (pref) {
        if (!row.dose      && pref.dosage)    patch.dose      = pref.dosage
        if (!row.frequency && pref.frequency) patch.frequency = pref.frequency
        if (!row.duration  && pref.days)      patch.duration  = pref.days
        if (!row.instructions && pref.notesEn) patch.instructions = pref.notesEn
      }
    } catch { /* no preference yet — fine */ }

    // Fall back to the medicine's own defaults if the doctor has no preference.
    if (!patch.dose && m.defaultDosage) patch.dose = m.defaultDosage
    if (!patch.frequency && m.defaultFrequency) patch.frequency = m.defaultFrequency
    if (!patch.duration && m.defaultDays) patch.duration = `${m.defaultDays} days`

    onChange(patch)
    // Persist if everything is now complete, then ask the parent to append a
    // fresh blank row below (only fires when this was the last row).
    setTimeout(() => {
      onPersist()
      if (onPickedMedicine) onPickedMedicine()
    }, 0)
  }

  // Free-text "Use 'X' as new medicine" - no medicineId, just text
  const acceptFreeText = () => {
    setShowSugg(false)
    if (query.trim() && query.trim() !== row.brandName) {
      onChange({ medicineId: null, brandName: query.trim() })
    }
  }

  // Defer blur-driven save so suggestion clicks still register.
  const handleInputBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => {
      setShowSugg(false)
      acceptFreeText()
      onPersist()
    }, 150)
  }
  const cancelBlur = () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }

  const noDuration = !row.duration || !row.duration.trim()

  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50">
      {/* Medicine name with autocomplete */}
      <td className="px-3 py-2 align-top relative">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2.5 text-slate-300 pointer-events-none"/>
          <input
            className="form-input form-input-sm !pl-7"
            disabled={!editable}
            value={query}
            placeholder="Type medicine name..."
            onChange={e => { setQuery(e.target.value); setShowSugg(true) }}
            onFocus={() => setShowSugg(true)}
            onBlur={handleInputBlur}
          />
          {showSugg && suggestions.length > 0 && (
            <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow max-h-48 overflow-y-auto"
              onMouseDown={cancelBlur}>
              {suggestions.map(m => (
                <li key={m.id}>
                  <button type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs"
                    onMouseDown={(e) => { e.preventDefault(); pickMedicine(m) }}>
                    <div className="font-medium text-slate-800">{m.name}</div>
                    {m.genericName && <div className="text-slate-500 text-[11px]">{m.genericName}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {row.genericName && (
          <p className="text-[11px] text-slate-500 mt-0.5 italic">{row.genericName}</p>
        )}
        {row._error && (
          <p className="text-[11px] text-danger mt-0.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3"/>{row._error}
          </p>
        )}
      </td>

      {/* Dose */}
      <td className="px-2 py-2 align-top">
        <input className="form-input form-input-sm"
          disabled={!editable}
          value={row.dose}
          placeholder="500 mg"
          onChange={e => onChange({ dose: e.target.value })}
          onBlur={onPersist}/>
      </td>

      {/* Frequency */}
      <td className="px-2 py-2 align-top">
        <input className="form-input form-input-sm"
          disabled={!editable}
          value={row.frequency}
          placeholder="1-0-1"
          list={`freq-${row._localKey}`}
          onChange={e => onChange({ frequency: e.target.value })}
          onBlur={onPersist}/>
        <datalist id={`freq-${row._localKey}`}>
          {FREQ_PRESETS.map(p => <option key={p} value={p}/>)}
        </datalist>
      </td>

      {/* Duration */}
      <td className="px-2 py-2 align-top">
        <input className={`form-input form-input-sm ${noDuration ? 'border-warning' : ''}`}
          disabled={!editable}
          value={row.duration}
          placeholder="5 days"
          list={`dur-${row._localKey}`}
          onChange={e => onChange({ duration: e.target.value })}
          onBlur={onPersist}/>
        <datalist id={`dur-${row._localKey}`}>
          {DURATION_PRESETS.map(p => <option key={p} value={p}/>)}
        </datalist>
      </td>

      {/* Instructions */}
      <td className="px-2 py-2 align-top">
        <input className="form-input form-input-sm"
          disabled={!editable}
          value={row.instructions}
          placeholder="After food"
          list={`instr-${row._localKey}`}
          onChange={e => onChange({ instructions: e.target.value })}
          onBlur={onPersist}/>
        <datalist id={`instr-${row._localKey}`}>
          {INSTR_PRESETS.map(p => <option key={p} value={p}/>)}
        </datalist>
      </td>

      {/* Actions */}
      <td className="px-2 py-2 align-top text-right">
        <div className="flex items-center gap-1 justify-end">
          {row._saving && <span className="text-[10px] text-slate-400">saving...</span>}
          {editable && (
            <button type="button"
              onClick={onRemove}
              className="p-1 text-slate-400 hover:text-danger"
              title={row.id ? 'Delete' : 'Discard draft'}>
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
