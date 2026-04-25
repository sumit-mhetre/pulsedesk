import { useEffect, useState, useRef } from 'react'
import { Search, X, User } from 'lucide-react'
import api from '../../lib/api'

/**
 * PatientPicker — search by OPD code / name / phone, click to select.
 *
 * Props:
 *   value     selected patient object (or null)
 *   onChange  (patient | null) => void
 *   disabled  bool
 */
export default function PatientPicker({ value, onChange, disabled = false }) {
  const [q, setQ]               = useState('')
  const [results, setResults]   = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [searching, setSearching] = useState(false)
  const wrapRef = useRef(null)

  // Debounced search
  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const id = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get(`/patients/search?q=${encodeURIComponent(q.trim())}`)
        setResults(Array.isArray(data?.data) ? data.data : [])
        setShowDrop(true)
      } catch {} finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Selected state — show patient summary card with Change button
  if (value) {
    return (
      <div className="p-3 border-2 border-primary/30 bg-blue-50/30 rounded-xl flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-primary"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900">
            <span className="font-mono text-primary mr-2">{value.patientCode}</span>
            {value.name}
          </p>
          <p className="text-xs text-slate-500">
            {[
              value.age != null ? `${value.age} yrs` : null,
              value.gender,
              value.phone,
            ].filter(Boolean).join(' • ')}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-primary hover:text-primary/80 font-semibold flex-shrink-0"
          >
            Change
          </button>
        )}
      </div>
    )
  }

  // Empty state — search input
  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input
          type="text"
          className="form-input pl-9 w-full"
          placeholder="Search by OPD code, name, or phone..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q && setShowDrop(true)}
          disabled={disabled}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setResults([]); setShowDrop(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4"/>
          </button>
        )}
      </div>

      {showDrop && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-50">
          {searching ? (
            <p className="px-3 py-2 text-sm text-slate-400 italic">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400 italic">
              {q ? 'No matching patients' : 'Start typing to search'}
            </p>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => {
                  onChange(p)
                  setQ(''); setResults([]); setShowDrop(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-50 last:border-0"
              >
                <p className="text-sm font-semibold text-slate-800">
                  <span className="font-mono text-primary mr-2">{p.patientCode}</span>
                  {p.name}
                </p>
                <p className="text-xs text-slate-500">
                  {[p.age != null ? `${p.age} yrs` : null, p.gender, p.phone].filter(Boolean).join(' • ')}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
