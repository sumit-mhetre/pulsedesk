import { useState, useRef, useEffect } from 'react'

// ── Generic Autocomplete ──────────────────────────────────
// Behavior:
// - Type → filter existing items instantly
// - Select from dropdown → value set
// - Type something not in list → kept as free text, saved silently on prescription save
// - NO "Add to list" button - fully automatic
export function Autocomplete({
  value, onChange, items = [], placeholder, label,
  displayKey = 'nameEn', lang = 'en', className = '',
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value || '')
  const inputRef          = useRef(null)
  const dropRef           = useRef(null)

  // Sync when parent resets value
  useEffect(() => { setQuery(value || '') }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false)
        // When blurring with free text - pass it up as plain string
        if (query && query !== value) {
          onChange({ nameEn: query, _isNew: true })
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [query, value])

  const getLangKey = (item) => {
    if (lang === 'hi' && item.nameHi) return item.nameHi
    if (lang === 'mr' && item.nameMr) return item.nameMr
    return item[displayKey] || item.name || item.nameEn || ''
  }

  const filtered = query.length === 0
    ? items.slice(0, 10)
    : items.filter(item =>
        getLangKey(item).toLowerCase().includes(query.toLowerCase()) ||
        (item.nameEn || '').toLowerCase().includes(query.toLowerCase()) ||
        (item.nameHi || '').toLowerCase().includes(query.toLowerCase()) ||
        (item.nameMr || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)

  const select = (item) => {
    setQuery(getLangKey(item))
    onChange(item)
    setOpen(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) {
        select(filtered[0]) // auto-select first match on Enter
      } else if (query) {
        onChange({ nameEn: query, _isNew: true })
        setOpen(false)
      }
    }
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown' && filtered.length > 0) {
      e.preventDefault()
      // Focus first item - handled by mouse for now
    }
  }

  return (
    <div className={`relative ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <input
        ref={inputRef}
        className="form-input"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onChange={e => {
          setQuery(e.target.value)
          // Pass raw string while typing so parent state stays in sync
          onChange({ nameEn: e.target.value, _isNew: true })
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
      />
      {open && (
        <div ref={dropRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-modal border border-blue-50 max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 italic">
              {query
                ? `"${query}" will be saved as new entry`
                : 'Start typing to search...'}
            </div>
          ) : (
            filtered.map((item, i) => (
              <button key={i} type="button" onClick={() => select(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0">
                <p className="text-sm font-medium text-slate-700">{getLangKey(item)}</p>
                {/* Show other languages as hint */}
                {lang === 'en' && (item.nameHi || item.nameMr) && (
                  <p className="text-xs text-slate-400">
                    {[item.nameHi, item.nameMr].filter(Boolean).join(' • ')}
                  </p>
                )}
                {lang !== 'en' && item.nameEn && item.nameEn !== getLangKey(item) && (
                  <p className="text-xs text-slate-400">{item.nameEn}</p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Medicine Autocomplete ─────────────────────────────────
export function MedicineAutocomplete({ value, onChange, medicines = [], placeholder = "Search medicine..." }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value || '')
  const inputRef          = useRef(null)
  const dropRef           = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.length === 0
    ? []
    : medicines.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.category || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)

  const typeColors = {
    tablet:   'bg-blue-100 text-blue-700',
    capsule:  'bg-purple-100 text-purple-700',
    liquid:   'bg-cyan-100 text-cyan-700',
    drops:    'bg-green-100 text-green-700',
    cream:    'bg-orange-100 text-orange-700',
    sachet:   'bg-yellow-100 text-yellow-700',
    injection:'bg-red-100 text-red-700',
    inhaler:  'bg-indigo-100 text-indigo-700',
    powder:   'bg-slate-100 text-slate-600',
  }

  return (
    <div className="relative">
      <input ref={inputRef} className="form-input text-sm"
        placeholder={placeholder} value={query} autoComplete="off"
        onChange={e => { setQuery(e.target.value); onChange(null); setOpen(true) }}
        onFocus={() => query.length > 0 && setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && filtered.length > 0) {
            e.preventDefault()
            onChange(filtered[0])
            setQuery(filtered[0].name)
            setOpen(false)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && query.length >= 1 && (
        <div ref={dropRef}
          className="absolute z-50 top-full left-0 w-80 mt-1 bg-white rounded-xl shadow-modal border border-blue-50 max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 italic">No medicines found for "{query}"</div>
          ) : (
            filtered.map(m => (
              <button key={m.id} type="button"
                onClick={() => { onChange(m); setQuery(m.name); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 border-b border-slate-50 last:border-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${typeColors[m.type] || 'bg-slate-100 text-slate-600'}`}>
                  {m.type}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                  {m.category && <p className="text-xs text-slate-400">{m.category}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Quick Picker Buttons ──────────────────────────────────
export function QuickPicker({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const val = opt.value !== undefined ? opt.value : opt
        const lbl = opt.label !== undefined ? opt.label : opt
        return (
          <button key={val} type="button" onClick={() => onChange(val)}
            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all
              ${val === value
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary bg-white'}`}>
            {lbl}
          </button>
        )
      })}
    </div>
  )
}
