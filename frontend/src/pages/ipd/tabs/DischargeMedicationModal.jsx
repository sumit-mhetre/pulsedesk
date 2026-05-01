// Modal for adding or editing one discharge medication (Section 11 of summary).
//
// Form fields per the 15-section spec:
//   Brand Name (generic name) -- Dose -- Frequency -- Duration -- Instructions
//
// Mode:
//   - props.medication is null -> ADD mode (POST to /discharge-medications)
//   - props.medication is set  -> EDIT mode (PUT to /discharge-medications/:id)
//
// Brand Name comes from Medicine catalog (autocomplete) OR free text.
// When picked from catalog, generic name auto-fills from medicine.genericName.

import { useEffect, useRef, useState } from 'react'
import { Pill, Save, X } from 'lucide-react'
import { Modal, Button } from '../../../components/ui'
import api from '../../../lib/api'
import toast from 'react-hot-toast'

// Common frequency presets shown as quick-pick chips below the field.
const FREQ_PRESETS = ['1-0-0', '0-0-1', '1-0-1', '1-1-1', 'BD', 'TDS', 'QID', 'SOS', 'STAT']
// Common instruction presets.
const INSTR_PRESETS = ['After food', 'Before food', 'With water', 'At bedtime', 'Empty stomach']

export default function DischargeMedicationModal({ admissionId, medication, onClose, onSaved }) {
  const isEdit = !!medication
  const [form, setForm] = useState({
    medicineId:   medication?.medicineId   || null,
    brandName:    medication?.brandName    || '',
    genericName:  medication?.genericName  || '',
    dose:         medication?.dose         || '',
    frequency:    medication?.frequency    || '',
    duration:     medication?.duration     || '',
    instructions: medication?.instructions || '',
  })
  const [saving, setSaving] = useState(false)

  // Medicine autocomplete state
  const [query, setQuery]         = useState(medication?.brandName || '')
  const [suggestions, setSugg]    = useState([])
  const [showSugg, setShowSugg]   = useState(false)
  const debounceRef = useRef(null)
  const justPickedRef = useRef(false)

  // Debounced search of Medicine catalog
  useEffect(() => {
    if (justPickedRef.current) {
      // Skip search right after picking from suggestions
      justPickedRef.current = false
      return
    }
    if (!query || query.trim().length < 2) {
      setSugg([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/medicines', { params: { search: query.trim(), limit: 8 } })
        const list = data?.data || data?.medicines || []
        setSugg(list)
      } catch {
        setSugg([])
      }
    }, 220)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query])

  const pickMedicine = (med) => {
    justPickedRef.current = true
    setQuery(med.name)
    setForm(f => ({
      ...f,
      medicineId:  med.id,
      brandName:   med.name,
      genericName: med.genericName || '',
    }))
    setSugg([])
    setShowSugg(false)
  }

  const onBrandChange = (val) => {
    setQuery(val)
    setForm(f => ({ ...f, brandName: val, medicineId: null }))  // typing breaks the catalog link
    setShowSugg(true)
  }

  const submit = async () => {
    if (!form.brandName.trim()) return toast.error('Brand name is required')
    if (!form.dose.trim())      return toast.error('Dose is required')
    if (!form.frequency.trim()) return toast.error('Frequency is required')
    if (!form.duration.trim())  return toast.error('Duration is required')

    setSaving(true)
    try {
      if (isEdit) {
        const { data } = await api.put(`/ipd/discharge-medications/${medication.id}`, form)
        toast.success('Medication updated')
        onSaved?.(data.data)
      } else {
        const { data } = await api.post(`/ipd/admissions/${admissionId}/discharge-medications`, form)
        toast.success('Medication added')
        onSaved?.(data.data)
      }
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Discharge Medication' : 'Add Discharge Medication'} size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving}
            icon={<Save className="w-4 h-4"/>} onClick={submit}>
            {isEdit ? 'Update' : 'Add'}
          </Button>
        </>
      }>

      {/* Brand name + autocomplete */}
      <div className="form-group">
        <label className="form-label">Brand Name *</label>
        <div className="relative">
          <input className="form-input" value={query}
            onChange={e => onBrandChange(e.target.value)}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            placeholder="Tab Augmentin 625, Syp Crocin, ..."/>
          {showSugg && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {suggestions.map(m => (
                <button key={m.id} type="button"
                  onClick={() => pickMedicine(m)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 last:border-0">
                  <Pill className="w-4 h-4 text-primary flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{m.name}</div>
                    {m.genericName && <div className="text-xs text-slate-500 truncate">{m.genericName}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">Pick from catalog to auto-fill generic name. Or type a free-text brand if not in catalog.</p>
      </div>

      {/* Generic name */}
      <div className="form-group">
        <label className="form-label">Generic Name</label>
        <input className="form-input" value={form.genericName}
          onChange={e => setForm(f => ({ ...f, genericName: e.target.value }))}
          placeholder="Amoxicillin + Clavulanic Acid"/>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Dose */}
        <div className="form-group">
          <label className="form-label">Dose *</label>
          <input className="form-input" value={form.dose}
            onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
            placeholder="500 mg, 1 tab, 5 ml"/>
        </div>
        {/* Frequency */}
        <div className="form-group">
          <label className="form-label">Frequency *</label>
          <input className="form-input" value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            placeholder="BD / 1-0-1 / TDS"/>
        </div>
      </div>

      {/* Frequency presets */}
      <div className="flex flex-wrap gap-1.5 mb-3 -mt-2">
        {FREQ_PRESETS.map(p => (
          <button key={p} type="button"
            onClick={() => setForm(f => ({ ...f, frequency: p }))}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors
              ${form.frequency === p
                ? 'bg-primary text-white border-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <div className="form-group">
          <label className="form-label">Duration *</label>
          <input className="form-input" value={form.duration}
            onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            placeholder="5 days, 2 weeks, Continue"/>
        </div>
        {/* Instructions */}
        <div className="form-group">
          <label className="form-label">Instructions</label>
          <input className="form-input" value={form.instructions}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
            placeholder="After food, Empty stomach..."/>
        </div>
      </div>

      {/* Instruction presets */}
      <div className="flex flex-wrap gap-1.5 -mt-2">
        {INSTR_PRESETS.map(p => (
          <button key={p} type="button"
            onClick={() => setForm(f => ({ ...f, instructions: p }))}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors
              ${form.instructions === p
                ? 'bg-primary text-white border-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>
            {p}
          </button>
        ))}
      </div>
    </Modal>
  )
}
