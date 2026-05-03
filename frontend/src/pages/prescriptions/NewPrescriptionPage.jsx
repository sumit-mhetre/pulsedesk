import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import useAutosave from '../../hooks/useAutosave'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Save, Printer, Copy, AlertTriangle, ChevronDown, X, Activity, BookOpen, Zap, FlaskConical, Calendar, Search } from 'lucide-react'
import { Button, Badge, Card, PageHeader, ConfirmDialog, Modal } from '../../components/ui'
import AutosaveIndicator from '../../components/ui/AutosaveIndicator'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import useAuthStore from '../../store/authStore'

const DOSAGE_OPTS = ['1-0-0','0-1-0','0-0-1','1-0-1','1-1-0','0-1-1','1-1-1','1-1-1-1','OD','BD','TDS','QID','HS','SOS','STAT']
const DAYS_OPTS   = ['1','2','3','5','7','10','14','15','21','30']

// ── Smart days input — type number → shows N days/weeks/months/years ──
function SmartDaysInput({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef(null)
  const [pos, setPos] = useState({ top:0, left:0, width:0 })

  // Extract number from value like "7 days", "2 weeks", "7"
  const getNum = (v) => {
    if (!v) return ''
    const m = String(v).match(/^(\d+)/)
    return m ? m[1] : ''
  }
  const display = value ? (String(value).match(/[a-z]/i) ? value : `${value} days`) : ''

  const getOptions = (n) => {
    if (!n) return DAYS_OPTS.map(d => ({ label: `${d} days`, value: `${d} days` }))
    const N = parseInt(n); if (!N) return []
    return [
      { label: `${N} days`,   value: `${N} days`   },
      { label: `${N} weeks`,  value: `${N} weeks`  },
      { label: `${N} months`, value: `${N} months` },
      { label: `${N} years`,  value: `${N} years`  },
    ]
  }

  const calc = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      const ab = window.innerHeight - r.bottom < 160 && r.top > 160
      setPos({ top: ab ? r.top-160-2 : r.bottom+2, left: r.left, width: r.width })
    }
  }

  const opts = getOptions(input || getNum(value))

  const commit = (v) => {
    const n = v.trim()
    if (!n) return
    // If just a number, default to days
    if (/^\d+$/.test(n)) onChange(`${n} days`)
    else onChange(n)
    setInput('')
  }

  return (
    <>
      <div ref={ref} className="relative flex">
        <input
          className={`w-full h-8 px-2 text-xs border rounded-lg focus:outline-none focus:border-primary bg-white transition-all ${value ? 'border-blue-200 text-slate-700 font-medium' : 'border-slate-200 text-slate-400'}`}
          placeholder="Duration"
          value={input || display}
          onChange={e => { setInput(e.target.value); calc(); setOpen(true) }}
          onFocus={() => { calc(); setOpen(true) }}
          onBlur={() => setTimeout(() => { setOpen(false); if (input) commit(input) }, 200)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input) { commit(input); setOpen(false); e.preventDefault() }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
      </div>
      {open && opts.length > 0 && (
        <div style={{ position:'fixed', top:pos.top, left:pos.left, width:Math.max(pos.width, 130), zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 overflow-hidden">
          {opts.map(opt => (
            <button key={opt.label} type="button"
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setInput(''); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${opt.value === value ? 'bg-blue-50 text-primary font-bold' : 'text-slate-700'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
const TIMING_OPTS = [
  { code:'AF', label:'After Food' }, { code:'BF', label:'Before Food' },
  { code:'ES', label:'Empty Stomach' }, { code:'HS', label:'At Bedtime' },
  { code:'WM', label:'With Milk' }, { code:'WW', label:'With Water' },
  { code:'MO', label:'Morning Only' }, { code:'AN', label:'At Night' },
]
// Frequency — how often across days (different from Timing which is when within a day)
const FREQ_OPTS = [
  { code:'DAILY',    label:'Daily' },
  { code:'ALT_DAYS', label:'Alternate Days' },
  { code:'EVERY_3D', label:'Every 3 Days' },
  { code:'WEEKLY',   label:'Weekly' },
  { code:'SOS',      label:'As Needed (SOS)' },
]
const FREQ_MAP    = { '1-0-0':1,'0-1-0':1,'0-0-1':1,'1-0-1':2,'1-1-0':2,'0-1-1':2,'1-1-1':3,'1-1-1-1':4,'OD':1,'BD':2,'TDS':3,'QID':4,'HS':1 }
const NON_TABLET  = ['liquid','drops','cream','inhaler','injection','powder','syrup','suspension','gel','lotion','ointment','spray']
const emptyMed    = { medicineId:'',medicineName:'',medicineType:'tablet',genericName:null,dosage:'',days:'',timing:'',frequency:'DAILY',qty:'',notesEn:'' }

// Syrup/liquid notes options (bilingual)
const LIQUID_NOTES_EN = ['5ml twice daily','5ml thrice daily','2.5ml twice daily','10ml twice daily','2 drops twice daily','2 drops thrice daily','1 teaspoon thrice daily','2 teaspoons twice daily','As directed','Apply thin layer twice daily']
const LIQUID_NOTES_MR = ['दिवसातून 2 वेळा 5ml','दिवसातून 3 वेळा 5ml','दिवसातून 2 वेळा 2.5ml','दिवसातून 2 वेळा 10ml','दिवसातून 2 वेळा 2 थेंब','दिवसातून 3 वेळा 2 थेंब','दिवसातून 3 वेळा 1 चमचा','दिवसातून 2 वेळा 2 चमचे','सांगितल्याप्रमाणे','दिवसातून 2 वेळा पातळ थर लावा']

// Frequency divisor — how many days between doses
const FREQ_DIV = { DAILY: 1, ALT_DAYS: 2, EVERY_3D: 3, WEEKLY: 7 }

// Infer medicine type from a typed-in name. Order matters — most specific first.
// Returns ONLY values present in the backend MedicineType enum:
// tablet | capsule | liquid | drops | cream | sachet | injection | inhaler | powder
const inferMedicineType = (name) => {
  if (!name) return 'tablet'
  const n = String(name).toLowerCase()
  // Order matters: more specific terms first
  if (/\binjection|\binj\b|injectable/.test(n))                    return 'injection'
  if (/\bsyrup|\bsuspension|\bsusp\b|elixir|\bliquid\b/.test(n))   return 'liquid'
  if (/\bdrops?\b/.test(n))                                        return 'drops'
  if (/\binhaler|inhalation|nebuliz|\bspray\b/.test(n))            return 'inhaler'
  if (/\bcream|\bointment|\boint\b|\bgel\b|\blotion\b/.test(n))    return 'cream'
  if (/\bpowder|\bsachet|\bsach\b/.test(n))                        return 'powder'
  if (/\bcapsule|\bcap\b/.test(n))                                 return 'capsule'
  if (/\btablet|\btab\b/.test(n))                                  return 'tablet'
  return 'tablet'  // default
}

const calcQty = (dosage, days, type='tablet', frequency='DAILY') => {
  // Liquid/syrup/drops/cream/etc → qty always 1 bottle/tube (editable)
  // Uses NON_TABLET + 'sachet' as single source of truth to avoid duplicate-list drift
  if (NON_TABLET.includes(type) || type === 'sachet') return '1'
  // SOS = as-needed; no fixed schedule, let doctor fill in manually
  if (frequency === 'SOS') return ''
  const t=FREQ_MAP[dosage]
  // Extract number from days string like "7 days", "2 weeks"
  const d = days ? parseInt(String(days).match(/\d+/)?.[0]) : 0
  const multiplier = String(days).toLowerCase().includes('week') ? 7
    : String(days).toLowerCase().includes('month') ? 30
    : String(days).toLowerCase().includes('year') ? 365 : 1
  if (!t || !d) return ''
  const totalDays = d * multiplier
  const divisor = FREQ_DIV[frequency] || 1
  // Ceil so the patient always has enough for the full duration (medically safer)
  const doses = Math.ceil(totalDays / divisor)
  return String(t * doses)
}

// Normalize a duration value to include a unit — bare numbers default to "days".
// Examples: "5" → "5 days" | "7 weeks" → "7 weeks" | "" → null | "  5  " → "5 days"
const normalizeDays = (d) => {
  if (d === null || d === undefined) return null
  const s = String(d).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return `${s} days`   // bare number → add unit
  return s                                   // already has a unit (days/weeks/months/years)
}

// Shift any Sunday to Monday — clinics are closed Sundays, so the Next Visit date
// should never land on one. Applied to every value we put into the next-visit field
// (auto-set from medicines, manual pick, template load, draft restore). Accepts a
// 'yyyy-MM-dd' string and returns a 'yyyy-MM-dd' string; passes through empty/invalid.
const shiftSundayToMonday = (yyyyMmDd) => {
  if (!yyyyMmDd) return yyyyMmDd
  // Parse explicitly without timezone — same trick used elsewhere in this file.
  const d = new Date(yyyyMmDd + 'T00:00:00')
  if (isNaN(d.getTime())) return yyyyMmDd
  if (d.getDay() === 0) return format(addDays(d, 1), 'yyyy-MM-dd')
  return yyyyMmDd
}

// ── Fixed position portal dropdown ───────────────────────
function PortalDrop({ anchorRef, open, options, value, onSelect, onClose }) {
  const [pos, setPos] = useState({ top:0, left:0, width:0 })
  const calc = useCallback(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const h = 192; const ab = window.innerHeight-r.bottom < h+8 && r.top > h
      setPos({ top: ab ? r.top-h-2 : r.bottom+2, left:r.left, width:r.width })
    }
  }, [anchorRef])
  useEffect(() => {
    if (open) { calc(); const s=()=>calc(); window.addEventListener('scroll',s,true); window.addEventListener('resize',s); return()=>{window.removeEventListener('scroll',s,true);window.removeEventListener('resize',s)} }
  }, [open,calc])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open, onClose, anchorRef])
  if (!open) return null
  return (
    <div style={{ position:'fixed', top:pos.top, left:pos.left, width:Math.max(pos.width,130), zIndex:9999 }}
      className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto">
      {options.map((opt,i) => {
        const code = opt.code||opt; const lbl = opt.label||opt
        return (
          <button key={i} type="button" onMouseDown={e=>{e.preventDefault();onSelect(code);onClose()}}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${code===value?'bg-blue-50 text-primary font-bold':'text-slate-700'}`}>
            {lbl}
          </button>
        )
      })}
    </div>
  )
}

function ColDrop({ value, options, onChange, disabled, placeholder }) {
  const [open,setOpen] = useState(false); const ref = useRef(null)
  const lbl = options.find(o=>(o.code||o)===value); const disp = lbl?(lbl.label||lbl):(value||'')
  if (disabled) return <div className="h-8 px-2 flex items-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100 w-full">N/A</div>
  return (
    <>
      <button ref={ref} type="button" onClick={()=>setOpen(o=>!o)}
        className={`w-full h-8 px-2 text-xs text-left rounded-lg border transition-all flex items-center justify-between gap-1 ${value?'border-blue-200 bg-white text-slate-700 font-medium':'border-slate-200 bg-white text-slate-400'} hover:border-primary`}>
        <span className="truncate">{disp||<span className="text-slate-300">{placeholder}</span>}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-40"/>
      </button>
      <PortalDrop anchorRef={ref} open={open} options={options} value={value} onSelect={onChange} onClose={()=>setOpen(false)}/>
    </>
  )
}

// ── Medicine search ───────────────────────────────────────
function MedInput({ value, medicineId, onSelect, onTyped, medicines, rowIndex, recentIds = [] }) {
  const [q,setQ]       = useState(value||'')
  const [open,setOpen] = useState(false)
  const [foc,setFoc]   = useState(false)
  const ref            = useRef(null)
  const [pos,setPos]   = useState({top:0,left:0,width:0})

  // Keep local input in sync with parent (e.g. edit mode load)
  useEffect(()=>setQ(value||''),[value])

  // Recently-used medicines (when input is empty + focused).
  // recentIds is doctor's medicine ids ordered most-recent first.
  const recentMeds = recentIds
    .map(id => medicines.find(m => m.id === id))
    .filter(Boolean)
    .slice(0, 8)

  // If query present → filter; else when focused → show all master list (used to).
  // Now: if query empty AND we have recentMeds → show those first, then fall through.
  const qLc = q.toLowerCase()
  const filtered = foc
    ? (q.length >= 1
        ? medicines.filter(m => m.name.toLowerCase().includes(qLc)).slice(0, 14)
        : medicines.slice(0, 14))
    : []
  const showRecentHeader = foc && q.length === 0 && recentMeds.length > 0

  const upd = useCallback(()=>{
    if (ref.current) {
      const r=ref.current.getBoundingClientRect()
      const h=224; const ab=window.innerHeight-r.bottom<h+8&&r.top>h
      setPos({top:ab?r.top-h-2:r.bottom+2,left:r.left,width:r.width})
    }
  },[])

  useEffect(()=>{
    if (!open) return
    const s=()=>upd()
    window.addEventListener('scroll',s,true); window.addEventListener('resize',s)
    return()=>{window.removeEventListener('scroll',s,true);window.removeEventListener('resize',s)}
  },[open,upd])

  const TC = {
    tablet:'bg-blue-50 text-blue-700', capsule:'bg-purple-50 text-purple-700',
    liquid:'bg-cyan-50 text-cyan-700',  drops:'bg-green-50 text-green-700',
    cream:'bg-orange-50 text-orange-700', inhaler:'bg-indigo-50 text-indigo-700',
    injection:'bg-red-50 text-red-700',   sachet:'bg-yellow-50 text-yellow-700'
  }

  // Called when selecting from dropdown
  const sel = (m) => {
    setQ(m.name); setOpen(false); setFoc(false)
    onSelect && onSelect(m, rowIndex)
  }

  // Called when user types freely and leaves the field (Tab / Enter / blur)
  const commitTyped = () => {
    const typed = q.trim()
    if (!typed) return
    // Only commit if it's different from what's already saved
    if (typed === value && medicineId) return
    // Check if it exactly matches a medicine in master
    const exact = medicines.find(m => m.name.toLowerCase() === typed.toLowerCase())
    if (exact) {
      sel(exact)  // treat as if selected
    } else {
      // Save as custom typed medicine — no id yet, backend will create it
      onTyped && onTyped(typed, rowIndex)
    }
  }

  return (
    <>
      <input ref={ref} id={`med-input-${rowIndex}`}
        className="w-full h-8 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
        placeholder="Search or type medicine name..." value={q} autoComplete="off"
        onChange={e=>{ setQ(e.target.value); setFoc(true); setOpen(true); upd() }}
        onFocus={()=>{ setFoc(true); setOpen(true); upd() }}
        onBlur={()=>{ setTimeout(()=>{ setOpen(false); setFoc(false) }, 200); commitTyped() }}
        onKeyDown={e=>{
          if (e.key==='Enter') {
            if (filtered.length>0) sel(filtered[0])
            else commitTyped()
            e.preventDefault()
          }
          if (e.key==='Tab') { commitTyped() }
          if (e.key==='Escape') { setOpen(false); setFoc(false) }
        }}
      />
      {open && (filtered.length > 0 || recentMeds.length > 0) && (
        <div style={{ position:'fixed',top:pos.top,left:pos.left,width:Math.max(pos.width+80,280),zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-72 overflow-y-auto">

          {/* ── Recently used (only when input is empty) ── */}
          {showRecentHeader && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100 sticky top-0">
                Recently Prescribed
              </div>
              {recentMeds.map(m => (
                <button key={`r-${m.id}`} type="button" onMouseDown={e=>{ e.preventDefault(); sel(m) }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 border-b border-slate-50">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TC[m.type]||'bg-slate-100 text-slate-600'}`}>{m.type}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                    {m.category && <p className="text-xs text-slate-400">{m.category}</p>}
                  </div>
                  <span className="text-[10px] text-primary font-semibold flex-shrink-0">★ recent</span>
                </button>
              ))}
              {filtered.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100 sticky top-0">
                  All Medicines
                </div>
              )}
            </>
          )}

          {/* ── Filtered (or all when no query) ── */}
          {filtered.map(m=>(
            <button key={m.id} type="button" onMouseDown={e=>{ e.preventDefault(); sel(m) }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2.5 border-b border-slate-50 last:border-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TC[m.type]||'bg-slate-100 text-slate-600'}`}>{m.type}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                {m.category && <p className="text-xs text-slate-400">{m.category}</p>}
              </div>
            </button>
          ))}
          {/* Show option to add as custom if no exact match */}
          {q.length>1 && !medicines.find(m=>m.name.toLowerCase()===qLc) && (
            <button type="button" onMouseDown={e=>{ e.preventDefault(); commitTyped(); setOpen(false) }}
              className="w-full text-left px-3 py-2 hover:bg-green-50 border-t border-slate-100 flex items-center gap-2 text-success text-sm font-medium">
              <Plus className="w-3.5 h-3.5"/>Use "{q.trim()}" as new medicine
            </button>
          )}
        </div>
      )}
    </>
  )
}

// ── Generic name inline editor (shown below medicine name) ────
// Readable by everyone; editable only by Doctor + Admin.
// PATCHes the Medicine master on save → updates all rows sharing that medicineId.
function GenericInput({ medicineId, value, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value || '')
  const [saving,  setSaving]  = useState(false)
  const inputRef = useRef(null)

  // Sync from prop changes (e.g. another row updated the same medicine)
  useEffect(() => { if (!editing) setDraft(value || '') }, [value, editing])

  // Focus the input when entering edit mode
  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.focus(), 20) }, [editing])

  const cancel = () => { setDraft(value || ''); setEditing(false) }

  const save = async () => {
    const trimmed = draft.trim()
    if (trimmed === (value || '').trim()) { setEditing(false); return }
    if (!medicineId) { toast.error('Select a medicine first'); setEditing(false); return }
    setSaving(true)
    try {
      await api.patch(`/master/medicines/${medicineId}/generic`, { genericName: trimmed })
      onSaved?.(medicineId, trimmed || null)
      setEditing(false)
      toast.success(trimmed ? 'Generic name saved' : 'Generic name cleared')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save generic')
    } finally { setSaving(false) }
  }

  // Read-only state (has value, no edit permission)
  if (!canEdit && value) {
    return <p className="text-xs text-slate-500 italic mt-0.5 truncate">{value}</p>
  }
  // Read-only state (no value, no edit permission) — render nothing
  if (!canEdit) return null

  // Edit state
  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <input ref={inputRef} type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') cancel() }}
          onBlur={save}
          placeholder="Generic / composition (e.g. Paracetamol 500mg)"
          disabled={saving}
          className="flex-1 text-xs italic text-slate-700 border-b border-primary/40 focus:border-primary bg-transparent py-0.5 px-1 outline-none"/>
      </div>
    )
  }

  // Has value, can edit → show + pencil
  if (value) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-xs text-slate-500 italic truncate">{value}</span>
        <button type="button" onClick={() => setEditing(true)}
          className="text-slate-400 hover:text-primary flex-shrink-0 p-0.5"
          title="Edit generic name">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
      </div>
    )
  }

  // No value, can edit → show "+ Add generic name"
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-xs text-primary/70 hover:text-primary italic mt-0.5 flex items-center gap-0.5">
      <Plus className="w-3 h-3"/> Add generic name
    </button>
  )
}

// ── Notes field with dropdown for liquids/non-tablets ─────
function NotesInput({ value, onChange, medicineType, printLang, savedNotes=[], onNoteCommit }) {
  // Controlled text input with a type-aware suggestion dropdown.
  // - Syrups/liquids → hardcoded liquid options (EN/MR) + saved history
  // - Tablets/capsules → doctor's saved history only
  // Dropdown opens on focus, filters live as user types.
  // Input is purely controlled by `value` (no intermediate state → no backspace ghost).
  // New notes are committed to suggestion list on blur (not per keystroke → no "स", "2 d" pollution).
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top:0, left:0, width:0 })
  const ref = useRef(null)
  const isNT = NON_TABLET.includes(medicineType)

  // Build suggestion pool based on medicine type
  const baseOptions = isNT ? (printLang === 'mr' ? LIQUID_NOTES_MR : LIQUID_NOTES_EN) : []
  const allOptions  = [...new Set([...(savedNotes || []), ...baseOptions])]

  // Derive filter query directly from the controlled value (no separate state)
  const q = (value || '').trim().toLowerCase()
  const filtered = q
    ? allOptions.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 10)
    : allOptions.slice(0, 10)

  const calc = () => {
    if (ref.current) {
      const r  = ref.current.getBoundingClientRect()
      const ab = window.innerHeight - r.bottom < 200 && r.top > 200
      setPos({ top: ab ? r.top - 200 - 2 : r.bottom + 2, left: r.left, width: r.width })
    }
  }

  // Reposition while open (scroll/resize)
  useEffect(() => {
    if (!open) return
    const s = () => calc()
    window.addEventListener('scroll', s, true)
    window.addEventListener('resize', s)
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', s) }
  }, [open])

  const handleBlur = () => setTimeout(() => {
    setOpen(false)
    // Commit final value to the in-session suggestion list (server-side POST still happens on form submit)
    const v = (value || '').trim()
    if (v && onNoteCommit && !(savedNotes || []).some(n => n.toLowerCase() === v.toLowerCase())) {
      onNoteCommit(v)
    }
  }, 200)

  return (
    <div className="relative">
      <input ref={ref}
        type="text"
        className="w-full h-8 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white"
        placeholder="Notes (optional)..."
        value={value || ''}
        onChange={e => { onChange(e.target.value); calc(); setOpen(true) }}
        onFocus={() => { calc(); setOpen(true) }}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position:'fixed', top:pos.top, left:pos.left, width:Math.max(pos.width, 200), zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto">
          {filtered.map(note => (
            <button key={note} type="button"
              onMouseDown={e => { e.preventDefault(); onChange(note); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-50 last:border-0 text-slate-700">
              {note}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tag input for complaint/diagnosis ────────────────────
function TagInput({ tags, onAdd, onRemove, items, placeholder }) {
  const [q,setQ]       = useState('')
  const [open,setOpen] = useState(false)
  const [pos,setPos]   = useState({top:0,left:0,width:0})
  const [bump,setBump] = useState(0)
  const ref = useRef(null)

  // Always recalculate — exclude already added tags
  const filtered = items
    .filter(i => !tags.includes(i.nameEn))
    .filter(i => q.length===0 || i.nameEn?.toLowerCase().includes(q.toLowerCase()))
    .slice(0,10)

  const calc = useCallback(() => {
    if (ref.current) {
      const r  = ref.current.getBoundingClientRect()
      const ab = window.innerHeight - r.bottom < 240 && r.top > 240
      setPos({ top: ab ? r.top-240-2 : r.bottom+2, left: r.left, width: r.width })
    }
  }, [])

  // Update dropdown position on scroll while open
  useEffect(() => {
    if (!open) return
    const s = () => calc()
    window.addEventListener('scroll', s, true)
    window.addEventListener('resize', s)
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', s) }
  }, [open, calc])

  // Add tag and keep dropdown open for more additions
  const doAdd = (text) => {
    const v = text.trim()
    if (v && !tags.includes(v)) onAdd(v)
    setQ('')           // clear input
    setOpen(true)      // keep open
    setBump(b=>b+1)    // re-render filtered
    setTimeout(() => { calc(); ref.current?.focus() }, 30)
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag=>(
            <span key={tag} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-lg font-medium">
              {tag}
              <button type="button" onClick={()=>onRemove(tag)} className="hover:text-danger"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      )}
      <input ref={ref} className="form-input" placeholder={placeholder} value={q}
        onChange={e=>{setQ(e.target.value);calc();setOpen(true)}}
        onFocus={()=>{calc();setOpen(true)}}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        onKeyDown={e=>{
          if (e.key==='Enter' && q.trim()) { doAdd(q); e.preventDefault() }
          if (e.key==='Tab'   && q.trim()) { doAdd(q); e.preventDefault() }
          if (e.key==='Escape') setOpen(false)
        }}
      />
      {open && (filtered.length>0 || (q.trim()&&!items.find(i=>i.nameEn?.toLowerCase()===q.toLowerCase()))) && (
        <div style={{ position:'fixed',top:pos.top,left:pos.left,width:Math.max(pos.width,280),zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-52 overflow-y-auto">
          {filtered.map(item=>(
            <button key={item.id} type="button" onMouseDown={e=>{e.preventDefault();doAdd(item.nameEn)}}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm font-medium text-slate-700 transition-colors">
              {item.nameEn}
            </button>
          ))}
          {q.trim() && !items.find(i=>i.nameEn?.toLowerCase()===q.toLowerCase()) && (
            <button type="button" onMouseDown={e=>{e.preventDefault();doAdd(q)}}
              className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-success text-sm font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5"/>Add "{q}" as new
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tag search for lab tests & advice ─────────────────────
function TagSearch({ tags, onAdd, onRemove, items, placeholder, allowCustom=true }) {
  const [q,setQ]       = useState('')
  const [open,setOpen] = useState(false)
  const [pos,setPos]   = useState({top:0,left:0,width:0})
  const [bump,setBump] = useState(0)   // bump to keep dropdown open after add
  const ref = useRef(null)
  const nameOf = (item) => item.nameEn||item.name||''

  // Always recalculate filtered based on current tags + query
  const filtered = items
    .filter(i => !tags.find(t => t.id===i.id))
    .filter(i => q.length===0 || nameOf(i).toLowerCase().includes(q.toLowerCase()))
    .slice(0,12)

  const calc = useCallback(() => {
    if (ref.current) {
      const r=ref.current.getBoundingClientRect()
      const ab=window.innerHeight-r.bottom<240&&r.top>240
      setPos({top:ab?r.top-240-2:r.bottom+2,left:r.left,width:r.width})
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const s = () => calc()
    window.addEventListener('scroll', s, true)
    window.addEventListener('resize', s)
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', s) }
  }, [open, calc])

  const doAdd = (item) => {
    onAdd(item); setQ(''); setOpen(true); setBump(b=>b+1)
    // Refocus input so user can keep adding
    setTimeout(()=>ref.current?.focus(), 50)
  }

  const doAddCustom = (text) => {
    if (!text.trim()) return
    onAdd({id:'new_'+Date.now(), name:text.trim(), isNew:true})
    setQ(''); setOpen(true); setBump(b=>b+1)
    setTimeout(()=>ref.current?.focus(), 50)
  }

  return (
    <div>
      {tags.length>0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag=>(
            <span key={tag.id||tag.name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-primary text-xs px-2.5 py-1 rounded-lg font-medium">
              {tag.name}
              <button type="button" onClick={()=>onRemove(tag)} className="hover:text-danger"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      )}
      <input ref={ref} className="form-input" placeholder={placeholder} value={q}
        onChange={e=>{setQ(e.target.value);calc();setOpen(true)}}
        onFocus={()=>{calc();setOpen(true)}}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        onKeyDown={e=>{
          if (e.key==='Enter' && q.trim()) { doAddCustom(q); e.preventDefault() }
          if (e.key==='Tab'   && q.trim()) { doAddCustom(q); e.preventDefault() }
          if (e.key==='Escape') setOpen(false)
        }}
      />
      {open && (filtered.length>0 || (allowCustom&&q.trim())) && (
        <div style={{ position:'fixed',top:pos.top,left:pos.left,width:Math.max(pos.width,300),zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-56 overflow-y-auto">
          {filtered.map(item=>(
            <button key={item.id} type="button" onMouseDown={e=>{e.preventDefault();doAdd(item)}}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center justify-between transition-colors">
              <span className="text-sm font-medium text-slate-700">{nameOf(item)}</span>
              {item.category && <span className="text-xs text-slate-400">{item.category}</span>}
            </button>
          ))}
          {allowCustom && q.trim() && !items.find(i=>nameOf(i).toLowerCase()===q.toLowerCase()) && (
            <button type="button" onMouseDown={e=>{e.preventDefault();doAddCustom(q)}}
              className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-success text-sm font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5"/>Add "{q.trim()}" as new (press Enter)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section template button ───────────────────────────────
function SectionTemplate({ label, onApply, templates, section }) {
  const [open,setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const relevant = (templates||[]).filter(t => {
    if (section==='complaint')  return t.complaint
    if (section==='diagnosis')  return t.diagnosis
    if (section==='medicines')  return t.medicines?.length > 0
    if (section==='labTests')   return t.labTests?.length > 0
    if (section==='advice')     return t.advice
    return false
  })
  if (relevant.length === 0) return null

  // Show search box once there are enough templates that scrolling becomes annoying.
  const showSearch = relevant.length >= 4
  const q = query.trim().toLowerCase()
  const filtered = q
    ? relevant.filter(t => (t.name || '').toLowerCase().includes(q))
    : relevant

  // Reset the search query whenever the dropdown closes so it starts fresh next time.
  const close = () => { setOpen(false); setQuery('') }

  return (
    <div className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-1 text-xs text-primary font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100">
        <Zap className="w-3 h-3"/>Templates
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close}/>
          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-blue-100 z-50 max-h-80 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            </div>
            {showSearch && (
              <div className="px-2 py-2 border-b border-slate-50">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search templates..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            )}
            <div className="overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400 text-center">No templates match "{query}"</p>
              ) : (
                filtered.map(t=>(
                  <button key={t.id} type="button" onClick={()=>{ onApply(t); close() }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0">
                    <p className="font-medium text-sm text-slate-700">{t.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {section==='medicines'&&`${t.medicines?.length||0} med(s)`}
                      {section==='labTests'&&`${t.labTests?.length||0} test(s)`}
                      {section==='complaint'&&(t.complaint||'').replace(/\|\|/g,', ').slice(0,40)}
                      {section==='diagnosis'&&(t.diagnosis||'').replace(/\|\|/g,', ').slice(0,40)}
                      {section==='advice'&&`${(t.advice||'').split('\n').filter(Boolean).length} item(s)`}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Blood Pressure Input Component ───────────────────────
function BloodPressureInput({ value = '', onChange }) {
  const sysRef = useRef(null)
  const diaRef = useRef(null)
  const [focused, setFocused] = useState(false)

  const hasSlash = value.includes('/')
  const [rawSys, rawDia] = hasSlash ? value.split('/') : [value, '']
  const systolic  = (rawSys || '').replace(/\D/g, '').slice(0, 3)
  const diastolic = (rawDia || '').replace(/\D/g, '').slice(0, 3)

  const emit = (sys, dia, keepSlash = hasSlash) => {
    if (!sys && !dia && !keepSlash) return onChange('')
    if (dia || keepSlash) return onChange(`${sys}/${dia}`)
    onChange(sys)
  }

  const handleSysChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
    emit(v, diastolic)
    if (v.length === 3) diaRef.current?.focus()
  }

  const handleSysKeyDown = (e) => {
    if ((e.key === '/' || e.key === ' ' || e.key === '-') && systolic.length >= 2) {
      e.preventDefault()
      emit(systolic, diastolic, true)
      diaRef.current?.focus()
    }
  }

  const handleDiaChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
    emit(systolic, v, true)
  }

  const handleDiaKeyDown = (e) => {
    if (e.key === 'Backspace' && !diastolic) {
      e.preventDefault()
      emit(systolic, '', false)
      sysRef.current?.focus()
      requestAnimationFrame(() => {
        const el = sysRef.current
        if (el) el.setSelectionRange(el.value.length, el.value.length)
      })
    }
  }

  const sysNum = systolic ? parseInt(systolic, 10) : null
  const diaNum = diastolic ? parseInt(diastolic, 10) : null
  const invalid = (sysNum !== null && (sysNum < 50 || sysNum > 300)) ||
                  (diaNum !== null && (diaNum < 30 || diaNum > 200))

  const borderClass = invalid
    ? 'border-danger ring-1 ring-danger/30'
    : focused
    ? 'border-primary ring-1 ring-primary/20'
    : 'border-slate-200'

  return (
    <div>
      <div className={`flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 transition-colors h-9 ${borderClass}`}
        onClick={() => sysRef.current?.focus()}>
        <input ref={sysRef} type="text" inputMode="numeric" autoComplete="off"
          value={systolic} onChange={handleSysChange} onKeyDown={handleSysKeyDown}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder="120" aria-label="Systolic"
          className="w-10 bg-transparent text-center text-sm tabular-nums outline-none placeholder:text-slate-300"
        />
        <span className="select-none text-slate-400 font-medium">/</span>
        <input ref={diaRef} type="text" inputMode="numeric" autoComplete="off"
          value={diastolic} onChange={handleDiaChange} onKeyDown={handleDiaKeyDown}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder="80" aria-label="Diastolic"
          className="w-10 bg-transparent text-center text-sm tabular-nums outline-none placeholder:text-slate-300"
        />
        <span className="ml-auto select-none text-xs text-slate-300">mmHg</span>
      </div>
      {invalid && <p className="text-xs text-danger mt-1">Check BP range</p>}
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────
export default function NewPrescriptionPage() {
  const navigate   = useNavigate()
  const { isDirty, setDirty, confirmProps, guardedAction } = useUnsavedChanges()
  const [params]   = useSearchParams()
  const { id: editId } = useParams()
  const isEdit     = !!editId
  const user       = useAuthStore(s => s.user)
  const canEditGeneric = user?.role === 'ADMIN' || user?.role === 'DOCTOR'

  // FAB auto-hide: track whether the in-flow bottom save bar is visible
  const bottomBarRef = useRef(null)
  const [bottomBarVisible, setBottomBarVisible] = useState(false)
  useEffect(() => {
    const el = bottomBarRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setBottomBarVisible(entry.isIntersecting),
      { rootMargin: '0px 0px -80px 0px', threshold: 0 }   // hide FAB slightly before bar fully enters viewport
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [medicines,   setMedicines]   = useState([])
  const [labTestList, setLabTestList] = useState([])
  const [complaints,  setComplaints]  = useState([])
  const [diagnoses,   setDiagnoses]   = useState([])
  const [adviceList,  setAdviceList]  = useState([])

  const [patient,    setPatient]    = useState(null)
  const [ptSearch,   setPtSearch]   = useState('')
  const [ptResults,  setPtResults]  = useState([])
  const [showPtDrop, setShowPtDrop] = useState(false)

  // Flip today's queue entry Waiting → InConsultation when patient is set on Rx page.
  // Idempotent on backend; flag avoids redundant calls within a single Rx session.
  const consultationStartedFor = useRef(null)
  useEffect(() => {
    if (!patient?.id) return
    if (consultationStartedFor.current === patient.id) return
    consultationStartedFor.current = patient.id
    api.post(`/appointments/queue/today/${patient.id}/start`, {}, { silent: true }).catch(() => {})
  }, [patient?.id])

  const [vitals,     setVitals]     = useState({ bp:'',bpSys:'',bpDia:'',sugar:'',weight:'',temp:'',spo2:'',pulse:'',height:'',bmi:'',heightUnit:'cm' })
  const [showVitals, setShowVitals] = useState(false)
  // Auto-calculate BMI when weight or height changes
  useEffect(() => {
    const w = parseFloat(vitals.weight); const h = parseFloat(vitals.height)
    if (w > 0 && h > 0) {
      // Convert ft to cm if needed (e.g. 5.7 ft = 170.7 cm)
      const hCm = vitals.heightUnit === 'ft' ? h * 30.48 : h
      const bmi = (w / Math.pow(hCm/100, 2)).toFixed(1)
      setVitals(p => ({ ...p, bmi }))
    }
  }, [vitals.weight, vitals.height])
  const [complaintTags, setComplaintTags] = useState([])
  const [diagnosisTags, setDiagnosisTags] = useState([])
  const [rxMeds,    setRxMeds]    = useState([{...emptyMed}])
  const lastUsed    = useRef({ dosage:'1-0-1', days:'5 days', timing:'AF' })
  const [rxTests,   setRxTests]   = useState([])
  const [rxAdvice,  setRxAdvice]  = useState([])
  // Lab Results / Test Outcomes — Phase 2 of lab feature.
  // Shape: [{ tempId, id?, labTestId?, testName, testCategory?, resultDate (yyyy-MM-dd),
  //           expectedFields?: [{key,label,unit,normalLow,normalHigh}],
  //           values: {fieldKey: string}, freeTextResult?: string, notes?: string }]
  // tempId is local-only for React keying. Server id is set after first save.
  const [rxLabResults, setRxLabResults] = useState([])
  const [deletedLabResultIds, setDeletedLabResultIds] = useState([])  // IDs to DELETE on save
  const [outcomesOpen, setOutcomesOpen] = useState(false)             // full-screen Test Outcomes modal
  const [outcomesDates, setOutcomesDates] = useState(() => [format(new Date(), 'yyyy-MM-dd')]) // multi-date columns
  const [outcomesSearchQuery, setOutcomesSearchQuery] = useState('')  // filter for picker dropdown only
  const [outcomesPickerOpen, setOutcomesPickerOpen] = useState(false) // picker dropdown visibility
  const [openCategories, setOpenCategories] = useState({})            // category name → bool (manual collapse state)
  const [showAllCategories, setShowAllCategories] = useState(false)   // when true, render all categories; otherwise only added/filled
  const [addedLabTestIds, setAddedLabTestIds] = useState(() => new Set()) // tests user explicitly picked from the search dropdown
  const [nextVisit, _setNextVisitRaw] = useState('')
  // Wrapper that auto-shifts Sunday → Monday before storing. Every place in this
  // component that sets next-visit goes through here (auto-set from medicines,
  // manual date input, template load, draft restore, edit-load). Clinics are
  // closed Sundays so we never want that day persisted.
  const setNextVisit = useCallback((value) => {
    if (typeof value === 'function') {
      _setNextVisitRaw(prev => shiftSundayToMonday(value(prev)))
    } else {
      _setNextVisitRaw(shiftSundayToMonday(value))
    }
  }, [])
  const [printLang, setPrintLang] = useState('en')
  const [customRxNo,setCustomRxNo]= useState('')
  const [saving,    setSaving]    = useState(false)
  const [lastRx,    setLastRx]    = useState(null)
  const [doctorPrefs,  setDoctorPrefs]  = useState({})
  const [savedMedNotes, setSavedMedNotes] = useState([]) // all notes ever typed across medicines
  const [allTemplates, setAllTemplates] = useState([])
  const [pageDesign,   setPageDesign]   = useState(null)
  const [pdLoaded,     setPdLoaded]     = useState(false)
  // customData shape: { cf_id: string[] } — multi-tag values per clinic-defined custom field.
  // Loaded from the saved prescription on edit (normalized — see edit-loader below) or
  // starts empty for a new Rx. Old single-string values from before multi-tag are
  // automatically wrapped to arrays on load.
  const [customData,   setCustomData]   = useState({})
  // customFieldValues — flat list of { id, nameEn, fieldId } across all custom fields
  // for the clinic. We slice by fieldId locally when rendering each TagInput, which
  // means we fetch ONCE on mount instead of N times (one per custom field).
  const [customFieldValues, setCustomFieldValues] = useState([])

  // Medicine IDs sorted by "recently prescribed" for this doctor — shown at top of medicine dropdown
  const recentMedIds = useMemo(() => {
    return Object.entries(doctorPrefs)
      .filter(([, p]) => p && p.updatedAt)
      .sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt))
      .map(([id]) => id)
  }, [doctorPrefs])
  // Auto-open vitals when rx_form config loads and showVitals is true
  useEffect(() => { if (pdLoaded && pageDesign?.showVitals === true) setShowVitals(true) }, [pdLoaded])
  // Before config loads: show all. After load: hide if explicitly set to false
  const showSection = (key) => !pdLoaded ? true : (pageDesign === null ? true : pageDesign[key] !== false)

  // Build a key → orderIndex map from pageDesign.fieldOrder. Used as inline `order:`
  // CSS on each section wrapper so the doctor's preferred section order applies to
  // the writing form. Built-in section keys: complaint/diagnosis/vitals/medicines/
  // labTests/advice/nextVisit. Custom fields use their cf_* id.
  // Returns a stable fallback order if config hasn't loaded or the key is missing.
  const __DEFAULT_FIELD_ORDER = ['complaint', 'diagnosis', 'vitals', 'medicines', 'labTests', 'advice', 'nextVisit']
  const sectionOrderMap = useMemo(() => {
    const order = (pageDesign && Array.isArray(pageDesign.fieldOrder) && pageDesign.fieldOrder.length > 0)
      ? pageDesign.fieldOrder
      : __DEFAULT_FIELD_ORDER
    const map = {}
    order.forEach((key, idx) => { map[key] = idx + 1 })   // 1-based so unmapped (default 0) goes first
    return map
  }, [pageDesign])
  const getSectionOrder = (key) => sectionOrderMap[key] ?? 999   // unmapped sections (e.g. patient) default to start

  // Custom fields the clinic has defined (loaded with the rx_form config).
  // Always treat as an array even if config is null/missing the key.
  const customFieldsConfig = (pageDesign && Array.isArray(pageDesign.customFields))
    ? pageDesign.customFields.filter(cf => cf && cf.id && (cf.name || '').trim())
    : []

  // ── Autosave (drafts) ─────────────────────────────────────────
  // Enabled ONLY for NEW prescriptions (not while editing existing) and after a patient is picked.
  const [resumeDraft, setResumeDraft]       = useState(null)   // draft row when found

  const getFormSnapshot = useCallback(() => ({
    complaint: complaintTags.join(' || '),
    diagnosis: diagnosisTags.join(' || '),
    advice:    rxAdvice.join('\n'),
    nextVisit, printLang, customRxNo,
    vitals,
    medicines: rxMeds,
    labTests:  rxTests,
    customData,
  }), [complaintTags, diagnosisTags, rxAdvice, nextVisit, printLang, customRxNo, vitals, rxMeds, rxTests, customData])

  const autosave = useAutosave({
    enabled:      !isEdit && !!patient?.id,
    patientId:    patient?.id,
    getFormState: getFormSnapshot,
    intervalMs:   10000,
  })

  // When patient changes (or first loads), check for an existing draft
  useEffect(() => {
    if (isEdit) return
    if (!patient?.id) { setResumeDraft(null); return }
    // Reset modal state when patient switches
    setResumeDraft(null)
    api.get(`/prescriptions/drafts/for-patient/${patient.id}`, { silent: true })
      .then(res => {
        const d = res?.data?.data
        if (d && d.formState) setResumeDraft(d)
      })
      .catch(() => {})
  }, [patient?.id, isEdit])

  const applyDraft = (draft) => {
    const s = draft?.formState || {}
    if (s.complaint)  setComplaintTags(String(s.complaint).split('||').map(x => x.trim()).filter(Boolean))
    if (s.diagnosis)  setDiagnosisTags(String(s.diagnosis).split('||').map(x => x.trim()).filter(Boolean))
    if (s.advice)     setRxAdvice(String(s.advice).split('\n').filter(Boolean))
    if (s.nextVisit != null) setNextVisit(s.nextVisit)
    if (s.printLang)  setPrintLang(s.printLang)
    if (s.customRxNo != null) setCustomRxNo(s.customRxNo)
    if (s.vitals && typeof s.vitals === 'object') setVitals(v => ({ ...v, ...s.vitals }))
    if (Array.isArray(s.medicines) && s.medicines.length) setRxMeds(s.medicines)
    if (Array.isArray(s.labTests)) setRxTests(s.labTests)
    if (s.customData && typeof s.customData === 'object') setCustomData(s.customData)
    setResumeDraft(null)
    toast.success('Draft restored')
  }

  const discardDraft = async () => {
    await autosave.discard()
    // Also try to delete via the explicit endpoint if we have it
    if (resumeDraft?.id) {
      try { await api.delete(`/prescriptions/drafts/${resumeDraft.id}`, { silent: true }) } catch {}
    }
    setResumeDraft(null)
  }

  // ── Section auto-scroll (next-section navigation) ───────────────
  const SECTION_ORDER = [
    { id: 'sec-patient',       key: null },                // always visible
    { id: 'sec-vitals',        key: 'showVitals' },
    { id: 'sec-complaint',     key: 'showComplaint' },
    { id: 'sec-diagnosis',     key: 'showDiagnosis' },
    { id: 'sec-medicines',     key: 'showMedicines' },
    { id: 'sec-labtests',      key: 'showLabTests' },
    { id: 'sec-advice',        key: 'showAdvice' },
  ]
  const scrollToNext = (fromId) => {
    const idx = SECTION_ORDER.findIndex(s => s.id === fromId)
    if (idx < 0) return
    // Walk forward to find next visible section
    for (let i = idx + 1; i < SECTION_ORDER.length; i++) {
      const { id, key } = SECTION_ORDER[i]
      if (key && !showSection(key)) continue
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    }
  }

  // Track sections already auto-scrolled this session so we don't interrupt editing.
  // First time user finishes a section → scroll. Subsequent blurs → stay put.
  const autoScrolledRef = useRef(new Set())
  const handleSectionBlur = (sectionId, hasContent) => (e) => {
    // Only fire when focus is actually leaving the section (not moving within)
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (!hasContent) return
    if (autoScrolledRef.current.has(sectionId)) return
    autoScrolledRef.current.add(sectionId)
    setTimeout(() => scrollToNext(sectionId), 150)
  }

  // ── Medicines section: one-shot "scroll-to-top" when doctor starts adding meds ─────
  // Fires only once per page-visit. After that, doctor controls scroll themselves.
  const medicinesFocusedRef = useRef(false)
  const handleMedicinesFirstFocus = () => {
    if (medicinesFocusedRef.current) return
    medicinesFocusedRef.current = true
    const el = document.getElementById('sec-medicines')
    if (el) {
      // Small delay so the focused input has finished its own focus side-effects
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
  }

  useEffect(() => {
    // Load sequentially in small groups to avoid overwhelming Render free tier
    const loadMaster = async () => {
      try { const meds = await api.get('/master/medicines');   setMedicines(meds.data.data) }   catch {}
      try { const labs = await api.get('/master/lab-tests');    setLabTestList(labs.data.data) } catch {}
      try { const comp = await api.get('/master/complaints');   setComplaints(comp.data.data) }  catch {}
      try { const diag = await api.get('/master/diagnoses');    setDiagnoses(diag.data.data) }   catch {}
      try { const adv   = await api.get('/master/advice');         setAdviceList(adv.data.data) }     catch {}
      try { const cfv = await api.get('/master/custom-field-values'); setCustomFieldValues(cfv.data.data || []) } catch {}
      try { const tmpl  = await api.get('/templates');              setAllTemplates(tmpl.data.data) }  catch {}
      try { const notes = await api.get('/master/medicine-notes');  setSavedMedNotes((notes.data.data || []).map(n => n.nameEn)) } catch {}
      try {
        const pd = await api.get('/page-design?type=rx_form')
        if (pd.data.data?.config) { setPageDesign(pd.data.data.config); setPdLoaded(true) }
        else setPdLoaded(true)
      } catch { setPdLoaded(true) }
      // Load Rx PRINT config — we only need defaultPrintLang from it for now
      try {
        const printPd = await api.get('/page-design?type=prescription')
        const lang = printPd.data?.data?.config?.defaultPrintLang
        // Only apply for NEW Rx (not edit). For edit mode, the saved Rx's printLang wins
        // and is set by the edit-loader effect below.
        if (lang && !isEdit) setPrintLang(lang)
      } catch {}
      // Load doctor's medicine preferences last (non-critical)
      try {
        const prefs = await api.get('/prescriptions/doctor-preferences')
        setDoctorPrefs(prefs.data.data || {})
      } catch {}
    }
    loadMaster()
    const pid        = params.get('patientId')
    const templateId = params.get('template')
    if (pid) {
      api.get(`/patients/${pid}`).then(({data})=>{
        setPatient(data.data)
        api.get(`/prescriptions/patient/${pid}/last`).then(r=>{ if(r.data.data)setLastRx(r.data.data) }).catch(()=>{})
      }).catch(()=>{})
    }
    // Load template if provided
    if (templateId) {
      api.post(`/templates/${templateId}/use`).then(({data})=>{
        const t = data.data
        if (t.complaint) setComplaintTags(t.complaint.split('||').map(s=>s.trim()).filter(Boolean))
        if (t.diagnosis) setDiagnosisTags(t.diagnosis.split('||').map(s=>s.trim()).filter(Boolean))
        if (t.medicines?.length > 0) setRxMeds([...t.medicines, {...emptyMed}])
        if (t.labTests?.length > 0)  setRxTests(t.labTests.map((name,i)=>({id:'tlab_'+i,name})))
        if (t.advice)    setRxAdvice(t.advice.split('\n').filter(Boolean).map((a,i)=>({id:'adv_'+i,name:a})))
        toast.success(`Template "${t.name}" loaded!`)
      }).catch(()=>{})
    }
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api.get(`/prescriptions/${editId}`).then(({data}) => {
      const rx = data.data
      setPatient(rx.patient)
      setComplaintTags(rx.complaint ? rx.complaint.split('||').map(s=>s.trim()).filter(Boolean) : [])
      setDiagnosisTags(rx.diagnosis ? rx.diagnosis.split('||').map(s=>s.trim()).filter(Boolean) : [])
      setRxMeds(rx.medicines.length > 0 ? rx.medicines.map(m=>({
        medicineId:m.medicineId, medicineName:m.medicineName, medicineType:m.medicineType,
        genericName: m.genericName || null,
        dosage:m.dosage||'', days:m.days?String(m.days):'', timing:m.timing||'AF',
        frequency: m.frequency||'DAILY',
        qty:m.qty?String(m.qty):(NON_TABLET.includes(m.medicineType)?'1':''), notesEn:m.notesEn||''
      })) : [{...emptyMed}])
      setRxTests(rx.labTests.map(t=>({ id:t.labTestId, name:t.labTestName })))
      setRxAdvice(rx.advice ? rx.advice.split('\n').filter(Boolean).map((a,i)=>({ id:'adv_'+i, name:a })) : [])
      setNextVisit(rx.nextVisit ? format(new Date(rx.nextVisit),'yyyy-MM-dd') : '')
      setPrintLang(rx.printLang||'en')
      // Custom field values — backend stores nullable JSON. Normalize to { cf_id: string[] }.
      // Older Rxs may have stored a single string per field (pre multi-tag); wrap those
      // into 1-element arrays so the form's TagInput sees a consistent shape.
      const rawCD = rx.customData && typeof rx.customData === 'object' ? rx.customData : {}
      const normalizedCD = {}
      for (const [k, v] of Object.entries(rawCD)) {
        if (Array.isArray(v))      normalizedCD[k] = v.filter(x => x != null && String(x).trim() !== '')
        else if (v == null)        normalizedCD[k] = []
        else if (String(v).trim()) normalizedCD[k] = [String(v)]
        else                       normalizedCD[k] = []
      }
      setCustomData(normalizedCD)
      // Vitals snapshot — restore the values entered when this Rx was originally
      // saved. We merge into the existing default vitals state (with units etc.)
      // and auto-expand the vitals section if any value was previously entered.
      if (rx.vitals && typeof rx.vitals === 'object') {
        setVitals(v => ({ ...v, ...rx.vitals }))
        if (Object.values(rx.vitals).some(x => x != null && String(x).trim() !== '')) {
          setShowVitals(true)
        }
      }
    }).catch(()=>navigate('/prescriptions'))
  }, [editId, isEdit])

  // ── Load existing lab results for this prescription (edit mode) ──
  useEffect(() => {
    if (!isEdit || !editId) return
    api.get(`/lab-results/prescription/${editId}`).then(({ data }) => {
      const items = (data.data || []).map((r, i) => {
        const valuesMap = {}
        for (const v of (r.values || [])) valuesMap[v.fieldKey] = v.value
        // Reconstruct expectedFields from stored values (preserves the structure across edits)
        const expectedFields = (r.values || []).length > 0
          ? r.values.map(v => ({
              key: v.fieldKey, label: v.fieldLabel, unit: v.fieldUnit,
              normalLow: v.normalLow, normalHigh: v.normalHigh,
            }))
          : null
        return {
          tempId:        'srv_'+r.id,
          id:            r.id,
          labTestId:     r.labTestId,
          testName:      r.testName,
          testCategory:  r.testCategory,
          resultDate:    r.resultDate ? format(new Date(r.resultDate),'yyyy-MM-dd') : format(new Date(),'yyyy-MM-dd'),
          expectedFields,
          values:        valuesMap,
          freeTextResult: r.freeTextResult || '',
          notes:         r.notes || '',
        }
      })
      setRxLabResults(items)
    }).catch(() => {})  // non-blocking — empty array if endpoint fails
  }, [editId, isEdit])

  const fetchPatients = async (q='') => {
    try { const {data}=await api.get(`/patients/search?q=${q}`); setPtResults(data.data); setShowPtDrop(true) } catch {}
  }
  useEffect(() => {
    if (ptSearch.length===0) return
    const t = setTimeout(()=>fetchPatients(ptSearch), 250)
    return ()=>clearTimeout(t)
  }, [ptSearch])

  useEffect(() => {
    const max = Math.max(...rxMeds.map(m=>parseInt(m.days)||0), 0)
    if (max>0) setNextVisit(format(addDays(new Date(),max+1),'yyyy-MM-dd'))
  }, [rxMeds])

  // ── Lab Results / Test Outcomes helpers ───────────────────────────
  // On modal open, hydrate state from existing rows: dates from row resultDates,
  // and addedLabTestIds from row labTestIds (so editing an Rx pre-shows its
  // tests). Also reset transient UI state for a clean entry every time.
  useEffect(() => {
    if (!outcomesOpen) return
    const existing = Array.from(new Set(
      rxLabResults.map(r => r.resultDate).filter(Boolean)
    )).sort((a, b) => b.localeCompare(a))   // descending — newest first / leftmost
    setOutcomesDates(existing.length > 0 ? existing : [format(new Date(), 'yyyy-MM-dd')])
    // Hydrate added set from any rows that already have a labTestId — both the
    // explicit-pick set and the implicit-via-values set unify here, so the body
    // shows everything that's relevant when reopening an existing prescription.
    setAddedLabTestIds(new Set(rxLabResults.map(r => r.labTestId).filter(Boolean)))
    setOutcomesSearchQuery('')
    setOutcomesPickerOpen(false)
    setOpenCategories({})
    setShowAllCategories(false)
    // intentionally only depend on outcomesOpen — we sync once per modal open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomesOpen])

  // ── Multi-date column management ──────────────────────────────────
  // Add a new date column. If newDate is provided (e.g. from a date picker),
  // use it. Otherwise auto-pick: prefer today, else step back day by day until
  // we find a date not already in the list. Result: one click guaranteed to
  // produce a visible new column. User can then click the date inside the new
  // chip to change it to any specific date they want.
  const addDate = (newDate) => {
    let target = newDate
    if (!target) {
      const today = format(new Date(), 'yyyy-MM-dd')
      if (!outcomesDates.includes(today)) {
        target = today
      } else {
        // Step back day-by-day until a free slot is found (cap at 365 to be safe)
        const d = new Date()
        for (let i = 1; i < 365; i++) {
          d.setDate(d.getDate() - 1)
          const candidate = format(d, 'yyyy-MM-dd')
          if (!outcomesDates.includes(candidate)) { target = candidate; break }
        }
      }
    }
    if (!target) return
    setOutcomesDates(prev => {
      if (prev.includes(target)) {
        toast('That date is already in your list', { icon: 'ℹ️' })
        return prev
      }
      return [...prev, target].sort((a, b) => b.localeCompare(a))   // newest first
    })
  }

  // Remove a date column. Always confirms (even for empty columns) — accidentally
  // dropping a column you just added is annoying. Always keeps at least one column.
  // If values exist, queues server-side deletion and drops the rows too.
  const removeDate = (date) => {
    if (outcomesDates.length <= 1) {
      toast('At least one date is required', { icon: 'ℹ️' })
      return
    }
    const rowsForDate = rxLabResults.filter(r => r.resultDate === date)
    const msg = rowsForDate.length > 0
      ? `Remove ${date} and the ${rowsForDate.length} value(s) recorded for it?`
      : `Remove ${date} column?`
    if (!window.confirm(msg)) return
    if (rowsForDate.length > 0) {
      rowsForDate.forEach(r => { if (r.id) setDeletedLabResultIds(d => [...d, r.id]) })
      setRxLabResults(prev => prev.filter(r => r.resultDate !== date))
      setDirty(true)
    }
    setOutcomesDates(prev => prev.filter(d => d !== date))
  }

  // Change one of the date columns to a new date. All rows with the old date
  // are migrated to the new date (preserves entered values). Refuses to merge
  // into an existing column to avoid silent data loss.
  const changeDate = (oldDate, newDate) => {
    if (!newDate || newDate === oldDate) return
    if (outcomesDates.includes(newDate)) {
      toast('That date is already in your list', { icon: 'ℹ️' })
      return
    }
    setRxLabResults(prev => prev.map(r => r.resultDate === oldDate ? { ...r, resultDate: newDate } : r))
    setOutcomesDates(prev => prev.map(d => d === oldDate ? newDate : d).sort((a, b) => b.localeCompare(a)))
    setDirty(true)
  }

  // ── Categorical field model ───────────────────────────────────────
  // Flatten labTestList into category → array of "field rows" so the UI can
  // render every individual test field with its own inline textbox. Multi-field
  // tests (CBC, Lipid Profile) split into multiple rows. Tests without
  // expectedFields collapse to one free-text row labeled by the test name.
  const outcomesFieldsByCategory = useMemo(() => {
    const map = new Map()
    for (const t of (labTestList || [])) {
      const cat = String(t.category || 'Other').trim() || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      const bucket = map.get(cat)
      if (Array.isArray(t.expectedFields) && t.expectedFields.length) {
        for (const f of t.expectedFields) {
          bucket.push({
            labTestId:    t.id,
            labTestName:  t.name,
            fieldKey:     f.key,
            label:        f.label,
            unit:         f.unit || null,
            normalLow:    typeof f.normalLow === 'number'  ? f.normalLow  : null,
            normalHigh:   typeof f.normalHigh === 'number' ? f.normalHigh : null,
            isFreeText:   false,
            rowKey:       String(t.id) + '__' + f.key,
          })
        }
      } else {
        // No expectedFields → single free-text row, label is the test name itself
        bucket.push({
          labTestId:    t.id,
          labTestName:  t.name,
          fieldKey:     '__freetext__',
          label:        t.name,
          unit:         null,
          normalLow:    null,
          normalHigh:   null,
          isFreeText:   true,
          rowKey:       String(t.id) + '__freetext',
        })
      }
    }
    // Sort categories alphabetically. Within each category, preserve the field
    // order coming from master data (which itself follows seedData ordering).
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [labTestList])

  // Body content selector — three modes (search query no longer affects body):
  //   1. "Show all" toggled → render every category (browse mode)
  //   2. Default → only categories that contain a labTest the user picked from
  //      the search dropdown OR a labTest that already has values entered
  //   3. Nothing picked yet → empty (caller renders friendly hint)
  const outcomesFilteredCategories = useMemo(() => {
    if (showAllCategories) return outcomesFieldsByCategory
    const inScope = new Set(addedLabTestIds)
    for (const r of rxLabResults) {
      const hasVal = (r.freeTextResult && String(r.freeTextResult).trim()) ||
                     Object.values(r.values || {}).some(v => v && String(v).trim())
      if (hasVal && r.labTestId) inScope.add(r.labTestId)
    }
    if (inScope.size === 0) return []
    return outcomesFieldsByCategory
      .map(([cat, rows]) => [cat, rows.filter(r => inScope.has(r.labTestId))])
      .filter(([, rows]) => rows.length > 0)
  }, [outcomesFieldsByCategory, showAllCategories, addedLabTestIds, rxLabResults])

  // Picker dropdown items — one entry per CATEGORY (not per test). Clicking a
  // category adds ALL its tests to the body at once. This matches how doctors
  // think — "I need a full lipid profile", not "I need LDL, then HDL, then…".
  // A category is hidden from the picker once all its tests are already added.
  // Search query filters by category name OR any sub-test name within (so typing
  // "ldl" still surfaces LIPID PROFILE).
  const outcomesPickerItems = useMemo(() => {
    const q = outcomesSearchQuery.trim().toLowerCase()
    const map = new Map()
    for (const t of (labTestList || [])) {
      if (!t || !t.id) continue
      const cat = String(t.category || 'Other').trim() || 'Other'
      if (!map.has(cat)) map.set(cat, { name: cat, totalCount: 0, labTestIds: [], testNames: [] })
      const entry = map.get(cat)
      entry.totalCount++
      entry.labTestIds.push(t.id)
      entry.testNames.push(t.name || '')
    }
    let list = Array.from(map.values()).map(c => ({
      ...c,
      // The actual ids that aren't already added — what would be appended on click
      remainingIds: c.labTestIds.filter(id => !addedLabTestIds.has(id)),
    })).filter(c => c.remainingIds.length > 0)

    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.testNames.some(n => n.toLowerCase().includes(q))
      )
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [labTestList, addedLabTestIds, outcomesSearchQuery])

  // Orphan rows = saved values that don't map to current master (labTest deleted
  // from Master Data, or older free-text outcomes from previous flow). We surface
  // these in a separate "Custom (Saved)" section so users can review/remove them.
  const outcomesOrphanRows = useMemo(() => {
    const labIds = new Set((labTestList || []).map(t => t.id))
    return rxLabResults.filter(r => !r.labTestId || !labIds.has(r.labTestId))
  }, [rxLabResults, labTestList])

  // Total filled value cells across all (test × date × field) combinations.
  // With multi-date, every individual cell counts — so 3 dates × 2 fields all
  // filled = 6, not 1. Useful as a "you have X data points" cue.
  const outcomesFilledCount = useMemo(() => {
    let n = 0
    for (const r of rxLabResults) {
      if (r.freeTextResult && String(r.freeTextResult).trim()) n++
      else {
        for (const v of Object.values(r.values || {})) {
          if (v && String(v).trim()) n++
        }
      }
    }
    return n
  }, [rxLabResults])

  // Read the value for a given field row at a specific date from rxLabResults.
  // Each (labTestId, resultDate) tuple maps to at most one row, so the lookup is
  // unique. If no row exists for that date yet, returns ''.
  const getRowValue = (row, date) => {
    const result = rxLabResults.find(r => r.labTestId === row.labTestId && r.resultDate === date)
    if (!result) return ''
    if (row.isFreeText) return result.freeTextResult || ''
    return result.values?.[row.fieldKey] ?? ''
  }

  // Write a value for a field row at a specific date. Lazily creates a result
  // row when the user types the first value, and removes the row entirely when
  // all its fields are cleared (so empty rows never get persisted on save).
  // Each date column has its own row in rxLabResults — keeps history clean for
  // longitudinal charts (HbA1c trend, BP progression, etc).
  const setRowValue = (row, date, value) => {
    const v = String(value ?? '')
    setRxLabResults(prev => {
      const idx = prev.findIndex(r => r.labTestId === row.labTestId && r.resultDate === date)

      if (idx === -1) {
        // No row yet — only create when there's actually something to save
        if (!v.trim()) return prev
        const labTest = (labTestList || []).find(l => l.id === row.labTestId)
        const expectedFields = Array.isArray(labTest?.expectedFields) && labTest.expectedFields.length
          ? labTest.expectedFields
          : null
        const newRow = {
          tempId:         'lr_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
          id:             null,
          labTestId:      row.labTestId,
          testName:       row.labTestName,
          testCategory:   labTest?.category || null,
          resultDate:     date,
          expectedFields,
          values:         row.isFreeText ? {} : { [row.fieldKey]: v },
          freeTextResult: row.isFreeText ? v : '',
          notes:          '',
        }
        return [...prev, newRow]
      }

      // Update existing row at this (labTest, date)
      const existing = prev[idx]
      let updated
      if (row.isFreeText) {
        updated = { ...existing, freeTextResult: v }
      } else {
        const newValues = { ...(existing.values || {}) }
        if (v.trim()) newValues[row.fieldKey] = v
        else          delete newValues[row.fieldKey]
        updated = { ...existing, values: newValues }
      }

      // If the whole row is now empty, drop it (and queue deletion if it had a server id).
      const hasAny = (
        Object.values(updated.values || {}).some(x => x && String(x).trim()) ||
        (updated.freeTextResult && String(updated.freeTextResult).trim())
      )
      if (!hasAny) {
        if (existing.id) setDeletedLabResultIds(d => [...d, existing.id])
        return prev.filter((_, i) => i !== idx)
      }

      const next = [...prev]
      next[idx] = updated
      return next
    })
    setDirty(true)
  }

  // Notes/free-text edit for orphan rows that aren't in current master. Kept
  // because removing master entries shouldn't silently lose previously-saved data.
  const updateOutcomeMeta = (tempId, key, value) => {
    setRxLabResults(prev => prev.map(r => r.tempId === tempId ? { ...r, [key]: value } : r))
    setDirty(true)
  }
  const removeOutcome = (tempId) => {
    setRxLabResults(prev => {
      const target = prev.find(r => r.tempId === tempId)
      if (target?.id) setDeletedLabResultIds(d => [...d, target.id])
      return prev.filter(r => r.tempId !== tempId)
    })
    setDirty(true)
  }

  // Category accordion controls. Three open-state inputs interact:
  //   • search active → all rendered categories are open (live filter feel)
  //   • showAllCategories → user is in browse mode; openCategories controls each
  //   • default (filled-only mode) → categories are open by default since they
  //     wouldn't be rendered at all if they had no values; user can still toggle
  const toggleCategory = (cat) => setOpenCategories(prev => ({
    ...prev,
    [cat]: prev[cat] === undefined ? false : !prev[cat]
  }))
  const isCategoryOpen = (cat) => {
    if (showAllCategories) return !!openCategories[cat]
    // default (filled/added-only) → open unless explicitly collapsed
    return openCategories[cat] !== false
  }
  // "Browse all" reveals every category AND opens each one.
  const expandAllCategories = () => {
    setShowAllCategories(true)
    const next = {}
    outcomesFieldsByCategory.forEach(([cat]) => { next[cat] = true })
    setOpenCategories(next)
  }
  // "Hide empty" returns to the default (added/filled-only) view.
  const collapseAllCategories = () => {
    setShowAllCategories(false)
    setOpenCategories({})
  }

  // ── Lab test picker (TagSearch-style typeahead) ───────────────────
  // Picking a category adds ALL its remaining test ids to addedLabTestIds in
  // one go, so every test in that category shows up on the page with input
  // boxes. Doctor fills in the ones they care about; empty ones simply won't
  // be persisted. We clear the query and refocus for rapid multi-add.
  const pickCategory = (categoryItem) => {
    if (!categoryItem || !Array.isArray(categoryItem.remainingIds)) return
    if (categoryItem.remainingIds.length === 0) return
    setAddedLabTestIds(prev => {
      const next = new Set(prev)
      for (const id of categoryItem.remainingIds) next.add(id)
      return next
    })
    setOutcomesSearchQuery('')
    setOutcomesPickerOpen(true)
    setDirty(true)
  }

  // Remove a test from the body — drops it from the added set AND deletes any
  // value rows it has across all dates (queueing server-side deletion if those
  // rows were already saved). Confirms before destroying any entered values.
  const removeAddedLabTest = (labTestId) => {
    if (!labTestId) return
    const targets = rxLabResults.filter(r => r.labTestId === labTestId)
    const hasAnyValue = targets.some(r =>
      (r.freeTextResult && String(r.freeTextResult).trim()) ||
      Object.values(r.values || {}).some(v => v && String(v).trim())
    )
    if (hasAnyValue) {
      const labTest = (labTestList || []).find(t => t.id === labTestId)
      const name = labTest?.name || 'this test'
      if (!window.confirm(`Remove ${name} and all entered values?`)) return
    }
    setAddedLabTestIds(prev => {
      if (!prev.has(labTestId)) return prev
      const next = new Set(prev)
      next.delete(labTestId)
      return next
    })
    setRxLabResults(prev => {
      const toRemove = prev.filter(r => r.labTestId === labTestId)
      toRemove.forEach(r => { if (r.id) setDeletedLabResultIds(d => [...d, r.id]) })
      return prev.filter(r => r.labTestId !== labTestId)
    })
    setDirty(true)
  }

  // Category → color (Ocean Blue palette + accents). Used as left-edge stripe.
  const categoryColor = (cat) => {
    const c = String(cat || '').toLowerCase()
    if (c.includes('haema') || c.includes('haemo'))   return 'bg-primary'         // blood-related → primary blue
    if (c.includes('biochem') || c.includes('bio chem')) return 'bg-accent'       // biochem → cyan
    if (c.includes('endocrine') || c.includes('thyroid')) return 'bg-purple-500'  // endocrine/thyroid
    if (c.includes('urine') || c.includes('patho'))    return 'bg-warning'         // urine/path → orange
    if (c.includes('micro') || c.includes('serolog'))  return 'bg-secondary'       // serology/micro → secondary
    if (c.includes('radio'))                           return 'bg-purple-500'      // imaging → purple
    if (c.includes('cardio') || c.includes('cardiac')) return 'bg-danger'          // cardio → red
    if (c.includes('oncol'))                           return 'bg-pink-600'        // oncology
    if (c.includes('lipid'))                           return 'bg-amber-500'       // lipid → amber
    if (c.includes('kidney') || c.includes('kft'))     return 'bg-teal-500'        // kidney → teal
    if (c.includes('liver')  || c.includes('lft'))     return 'bg-orange-500'      // liver → orange
    return 'bg-slate-400'                                                          // unknown → neutral
  }

  // Read out-of-range flag from clinic settings (loaded via /auth/me).
  // Default ON when not set, so existing clinics get reasonable behavior.
  const flagOutOfRange = useMemo(() => {
    const s = user?.clinic?.settings || {}
    return s.flagOutOfRangeLabValues !== false
  }, [user])

  // Is this string-value numerically out of [low, high]? Returns false for non-numeric values.
  // Treats one-sided ranges (low only or high only) sensibly.
  const isValueOutOfRange = (rawValue, low, high) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') return false
    const n = Number(String(rawValue).replace(/[^\d.\-]/g, ''))
    if (!Number.isFinite(n)) return false  // text values like "Negative" are never flagged
    if (typeof low === 'number' && n < low) return true
    if (typeof high === 'number' && n > high) return true
    return false
  }

  const updateMed = (i, field, val) => {
    setRxMeds(prev => {
      const u=[...prev]; u[i]={...u[i],[field]:val}
      if(field==='dosage')lastUsed.current.dosage=val
      if(field==='days')lastUsed.current.days=val
      if(field==='timing')lastUsed.current.timing=val
      if(field==='frequency')lastUsed.current.frequency=val
      // Recalc qty whenever dosage/days/frequency change
      if((field==='dosage'||field==='days'||field==='frequency')&&!NON_TABLET.includes(u[i].medicineType)) {
        u[i].qty = calcQty(
          field==='dosage'    ? val : u[i].dosage,
          field==='days'      ? val : u[i].days,
          u[i].medicineType || 'tablet',
          field==='frequency' ? val : (u[i].frequency || 'DAILY')
        )
      }
      return u
    })
  }

  // Called when GenericInput PATCHes the Medicine master.
  // Updates both the in-memory master list AND any rx rows currently using that medicine.
  const handleGenericSaved = (medicineId, genericName) => {
    setMedicines(prev => prev.map(m => m.id === medicineId ? { ...m, genericName } : m))
    setRxMeds(prev => prev.map(m => m.medicineId === medicineId ? { ...m, genericName } : m))
  }

  const handleMedSelect = useCallback((med, rowIdx) => {
    setDirty()
    if (!med) return
    const isNT = NON_TABLET.includes(med.type)
    // Priority: doctor's personal preference > medicine default > last used
    const pref   = doctorPrefs[med.id] || {}
    const dosage = isNT ? '' : (pref.dosage || med.defaultDosage || lastUsed.current.dosage)
    // pref.days is now a full string like "5 days" (was Int before migration)
    const rawDays = pref.days || (med.defaultDays ? `${med.defaultDays} days` : lastUsed.current.days)
    const days = rawDays || ''
    const timing = pref.timing || med.defaultTiming || lastUsed.current.timing
    // Frequency defaults to DAILY if no pref exists yet
    const frequency = pref.frequency || 'DAILY'
    // Notes also carry over from doctor's last-used settings for this medicine
    const notesEn = pref.notesEn || ''
    const notesHi = pref.notesHi || ''
    const notesMr = pref.notesMr || ''
    setRxMeds(prev => {
      const u=[...prev]
      u[rowIdx]={ ...u[rowIdx], medicineId:med.id, medicineName:med.name, medicineType:med.type, genericName: med.genericName || null, dosage, days, timing, frequency, notesEn, notesHi, notesMr, qty: isNT?'1':calcQty(dosage,days,med.type,frequency) }
      if (rowIdx===u.length-1) u.push({...emptyMed})
      return u
    })
    if (!isNT&&med.defaultDosage) lastUsed.current.dosage=med.defaultDosage
    if (med.defaultDays) lastUsed.current.days=`${med.defaultDays} days`
    if (med.defaultTiming) lastUsed.current.timing=med.defaultTiming
    setTimeout(()=>{ const el=document.getElementById(`med-input-${rowIdx+1}`); if(el)el.focus() },60)
  }, [doctorPrefs])

  // Called when doctor types a medicine name without selecting from dropdown
  const handleMedTyped = useCallback((name, rowIdx) => {
    if (!name?.trim()) return
    setRxMeds(prev => {
      const u = [...prev]
      // Only update if this row is blank or has same name (avoid overwriting selection)
      if (!u[rowIdx]) return prev
      u[rowIdx] = {
        ...u[rowIdx],
        medicineId:   '',           // no id yet — backend will auto-create
        medicineName: name.trim(),
        medicineType: inferMedicineType(name),  // smart-detect from name (cream/syrup/drops/capsule/etc.)
      }
      return u
    })
  }, [])

  const removeRow = i => setRxMeds(p=>p.filter((_,idx)=>idx!==i))
  const addRow    = () => setRxMeds(p => {
    const next=[...p,{...emptyMed}]
    setTimeout(()=>{ const el=document.getElementById(`med-input-${next.length-1}`); if(el)el.focus() },50)
    return next
  })
  const applyToAll = (field) => {
    // Use last-touched value for all fields (dosage, timing, days, frequency)
    const val = lastUsed.current[field]
    if (!val) return
    setRxMeds(prev => prev.map(m => {
      const u = { ...m, [field]: val }
      if ((field==='dosage' || field==='days' || field==='frequency') && !NON_TABLET.includes(m.medicineType)) {
        u.qty = calcQty(
          field==='dosage'    ? val : m.dosage,
          field==='days'      ? val : m.days,
          m.medicineType || 'tablet',
          field==='frequency' ? val : (m.frequency || 'DAILY')
        )
      }
      return u
    }))
    toast.success(`"${val}" applied to all rows`)
  }

  // Detect script — Devanagari (Hindi/Marathi) or English
  const detectLang = (text) => {
    if (/[ऀ-ॿ]/.test(text)) return printLang === 'mr' ? 'mr' : 'hi'
    return 'en'
  }
  const buildPayload = (text, type) => {
    const lang = detectLang(text)
    if (type === 'lab') return lang === 'en' ? { name: text } : { name: text, [`name${lang.charAt(0).toUpperCase()+lang.slice(1)}`]: text }
    if (lang === 'en') return { nameEn: text }
    if (lang === 'hi') return { nameEn: text, nameHi: text }
    return { nameEn: text, nameMr: text }
  }

  const autoSaveToMaster = async () => {
    for (const tag of complaintTags) {
      if (!complaints.some(c=>c.nameEn?.toLowerCase()===tag.toLowerCase()))
        try { await api.post('/master/complaints', buildPayload(tag, 'complaint')) } catch (e) { console.warn('[autoSave complaint]', tag, e?.response?.status, e?.response?.data) }
    }
    for (const tag of diagnosisTags) {
      if (!diagnoses.some(d=>d.nameEn?.toLowerCase()===tag.toLowerCase()))
        try { await api.post('/master/diagnoses', buildPayload(tag, 'diagnosis')) } catch (e) { console.warn('[autoSave diagnosis]', tag, e?.response?.status, e?.response?.data) }
    }
    const savedTests=[]
    for (const t of rxTests) {
      if (t.isNew) {
        try { const{data}=await api.post('/master/lab-tests', buildPayload(t.name,'lab')); savedTests.push({id:data.data.id,name:t.name}) }
        catch (e) { console.warn('[autoSave labTest]', t.name, e?.response?.status, e?.response?.data); savedTests.push(t) }
      } else savedTests.push(t)
    }
    for (const a of rxAdvice) {
      if (a.isNew) try { await api.post('/master/advice', buildPayload(a.name,'advice')) } catch (e) { console.warn('[autoSave advice]', a.name, e?.response?.status, e?.response?.data) }
    }
    // Save any new medicine notes to master (mirrors advice pattern)
    const existingNotes = new Set(savedMedNotes.map(n=>n.toLowerCase()))
    for (const m of rxMeds) {
      const note = m.notesEn?.trim()
      if (note && !existingNotes.has(note.toLowerCase())) {
        try {
          await api.post('/master/medicine-notes', buildPayload(note,'advice'))
          console.log('[autoSave note saved]', note)
        } catch (e) {
          console.warn('[autoSave note FAILED]', note, 'status:', e?.response?.status, 'data:', e?.response?.data)
        }
        existingNotes.add(note.toLowerCase())
      }
    }
    // Save any new custom field values to the per-clinic suggestion master so they
    // appear in the dropdown for the NEXT Rx. We compare case-insensitively against
    // the in-memory list to avoid spurious 409s; the backend also de-dupes via the
    // unique constraint, so a duplicate POST is harmless even if our cache is stale.
    const cfIdsSeen = new Set(customFieldsConfig.map(cf => cf.id))
    const existingByField = new Map()
    for (const v of customFieldValues) {
      if (!existingByField.has(v.fieldId)) existingByField.set(v.fieldId, new Set())
      existingByField.get(v.fieldId).add(String(v.nameEn || '').toLowerCase())
    }
    const newlyAdded = []
    for (const [cfId, vals] of Object.entries(customData || {})) {
      if (!cfIdsSeen.has(cfId) || !Array.isArray(vals)) continue
      const seen = existingByField.get(cfId) || new Set()
      for (const raw of vals) {
        const text = String(raw ?? '').trim()
        if (!text) continue
        if (seen.has(text.toLowerCase())) continue
        try {
          const { data } = await api.post('/master/custom-field-values', { fieldId: cfId, value: text })
          newlyAdded.push(data.data)
          seen.add(text.toLowerCase())
        } catch (e) {
          console.warn('[autoSave customFieldValue]', cfId, text, e?.response?.status, e?.response?.data)
        }
      }
    }
    // Update in-memory list so the dropdown shows new values immediately without a refetch.
    if (newlyAdded.length > 0) {
      setCustomFieldValues(prev => [...prev, ...newlyAdded])
    }
    return savedTests
  }

  // Load template into form
  const loadTemplate = (template) => {
    if (template.complaint) setComplaintTags(template.complaint.split('||').map(s=>s.trim()).filter(Boolean))
    if (template.diagnosis) setDiagnosisTags(template.diagnosis.split('||').map(s=>s.trim()).filter(Boolean))
    // Use template via API to get medicine names
    api.post(`/templates/${template.id}/use`).then(({data})=>{
      const t = data.data
      if (t.medicines?.length>0) setRxMeds([...t.medicines,{...emptyMed}])
      if (t.labTests?.length>0)  setRxTests(t.labTests.map((name,i)=>({id:'tlab_'+i,name})))
      if (t.advice)              setRxAdvice(t.advice.split('\n').filter(Boolean).map((a,i)=>({id:'adv_'+i,name:a})))
      // Custom field values from template — normalize to multi-tag arrays.
      // Old templates may have stored single strings; wrap them so the form's
      // TagInput sees a consistent {[cfId]: string[]} shape.
      if (t.customData && typeof t.customData === 'object') {
        const normalized = {}
        for (const [k, v] of Object.entries(t.customData)) {
          if (Array.isArray(v))      normalized[k] = v.filter(x => x != null && String(x).trim() !== '')
          else if (v == null)        normalized[k] = []
          else if (String(v).trim()) normalized[k] = [String(v)]
          else                       normalized[k] = []
        }
        setCustomData(prev => ({ ...prev, ...normalized }))
      }
      toast.success(`Template "${t.name}" loaded!`)
    }).catch(()=>toast.error('Failed to load template'))
  }

  // Save current form as template
  const handleSaveAsTemplate = async () => {
    const templateName = window.prompt('Template name:', complaintTags[0] || diagnosisTags[0] || '')
    if (!templateName?.trim()) return
    try {
      // Same cleanup we apply on Rx save: strip custom fields not in the current
      // config and trim/filter empty array entries. A template should never carry
      // values for a field that no longer exists.
      const cfIds = new Set(customFieldsConfig.map(cf => cf.id))
      const cleanCustomData = {}
      for (const [k, v] of Object.entries(customData || {})) {
        if (!cfIds.has(k)) continue
        const arr = Array.isArray(v)
          ? v.map(x => String(x ?? '').trim()).filter(Boolean)
          : (v != null && String(v).trim() ? [String(v).trim()] : [])
        if (arr.length > 0) cleanCustomData[k] = arr
      }
      await api.post('/templates/save-as', {
        name:       templateName.trim(),
        complaint:  complaintTags.join(' || '),
        diagnosis:  diagnosisTags.join(' || '),
        advice:     rxAdvice.map(a=>a.name).join('\n'),
        labTests:   rxTests.filter(t=>!t.isNew).map(t=>t.name),
        medicines:  rxMeds.filter(m=>m.medicineId||m.medicineName).map(m=>({ medicineId:m.medicineId, medicineName:m.medicineName, medicineType:m.medicineType, dosage:m.dosage, days: normalizeDays(m.days), timing:m.timing, frequency:m.frequency||'DAILY', qty:m.qty||null, notesEn:m.notesEn })),
        customData: Object.keys(cleanCustomData).length > 0 ? cleanCustomData : null,
      })
      toast.success(`Template "${templateName}" saved!`)
    } catch { toast.error('Failed to save template') }
  }

  const carryForward = () => {
    if (!lastRx) return
    setRxMeds(lastRx.medicines.map(m=>({medicineId:m.medicineId,medicineName:m.medicineName,medicineType:m.medicineType,genericName:m.genericName||null,dosage:m.dosage||'',days:m.days?String(m.days):'',timing:m.timing||'AF',frequency:m.frequency||'DAILY',qty:m.qty?String(m.qty):'',notesEn:''})))
    if (lastRx.complaint) setComplaintTags(lastRx.complaint.split('||').map(s=>s.trim()).filter(Boolean))
    if (lastRx.diagnosis) setDiagnosisTags(lastRx.diagnosis.split('||').map(s=>s.trim()).filter(Boolean))
    if (lastRx.advice)    setRxAdvice(lastRx.advice.split('\n').filter(Boolean).map((a,i)=>({id:'adv_'+i,name:a})))
    toast.success('Last prescription loaded!')
  }

  // handleSave supports two modes:
  //   'stay'  → save, reset dirty flag, stay on page (switches URL to /prescriptions/:id/edit for new saves)
  //   'print' → save, navigate to /prescriptions/:id?print=1 which auto-opens print dialog
  const handleSave = async (mode = 'stay') => {
    if (!patient) { toast.error('Please select a patient'); return }
    if (saving) return  // prevent double-click
    setSaving(true)
    try {
      const savedTests = await autoSaveToMaster()
      if (showVitals && Object.values(vitals).some(v=>v))
        await api.post(`/patients/${patient.id}/vitals`, vitals).catch(()=>{})
      // Strip custom field values down to fields actually configured by the clinic.
      // If a custom field has been deleted from cfg, its old values are dropped on save.
      // Each value is now an array of tags (multi-tag input). We filter out empty arrays
      // and trim each individual tag — empty trim'd tags get dropped silently.
      const cfIds = new Set(customFieldsConfig.map(cf => cf.id))
      const cleanCustomData = {}
      for (const [k, v] of Object.entries(customData || {})) {
        if (!cfIds.has(k)) continue
        const arr = Array.isArray(v)
          ? v.map(x => String(x ?? '').trim()).filter(Boolean)
          : (v != null && String(v).trim() ? [String(v).trim()] : [])
        if (arr.length > 0) cleanCustomData[k] = arr
      }
      // Snapshot vitals onto the Rx itself so the printed Rx always reflects the
      // values the doctor saw at write-time. Independent of the patient timeline POST
      // above (which writes a VitalRecord row). If nothing was entered, send null
      // so the controller stores NULL (and the Print tab's "Vitals" toggle simply
      // has nothing to render — toggle stays harmlessly on).
      const cleanVitals = (() => {
        if (!showVitals) return null
        const out = {}
        for (const [k, v] of Object.entries(vitals || {})) {
          if (v === null || v === undefined) continue
          const s = String(v).trim()
          if (s === '') continue
          out[k] = s
        }
        return Object.keys(out).length > 0 ? out : null
      })()
      const payload = {
        patientId:  patient.id,
        complaint:  complaintTags.join(' || '),
        diagnosis:  diagnosisTags.join(' || '),
        advice:     rxAdvice.map(a=>a.name).join('\n'),
        nextVisit:  nextVisit||null, printLang, customRxNo: customRxNo||null,
        medicines:  rxMeds.filter(m=>m.medicineId||m.medicineName).map(m=>({...m, days: normalizeDays(m.days)})),
        labTests:   savedTests.filter(t=>t.id&&!t.isNew).map(t=>({labTestId:t.id,labTestName:t.name})),
        customData: Object.keys(cleanCustomData).length > 0 ? cleanCustomData : null,
        vitals:     cleanVitals,
      }
      let savedId = editId
      if (isEdit) {
        await api.put(`/prescriptions/${editId}`, payload)
        toast.success('Prescription updated!')
      } else {
        const { data } = await api.post('/prescriptions', payload)
        savedId = data.data.id
        toast.success(`Prescription ${data.data.rxNo} saved!`)
      }

      // ── Save lab results (Test Outcomes) — fire-and-forget per row, non-blocking on Rx success ──
      try {
        // Delete removed ones
        for (const id of deletedLabResultIds) {
          await api.delete(`/lab-results/${id}`).catch(() => {})
        }
        if (deletedLabResultIds.length) setDeletedLabResultIds([])

        // Upsert each row
        for (const r of rxLabResults) {
          // Skip empty rows (no test name AND no values AND no free text)
          const hasValues = r.values && Object.values(r.values).some(v => v !== '' && v != null)
          const hasFreeText = !!(r.freeTextResult && r.freeTextResult.trim())
          if (!r.testName?.trim()) continue
          if (!hasValues && !hasFreeText && !r.notes?.trim()) continue  // empty rows are ignored

          const valuesPayload = (r.expectedFields || []).map(f => ({
            fieldKey:   f.key,
            fieldLabel: f.label,
            fieldUnit:  f.unit || null,
            value:      r.values?.[f.key] ?? '',
            normalLow:  typeof f.normalLow  === 'number' ? f.normalLow  : null,
            normalHigh: typeof f.normalHigh === 'number' ? f.normalHigh : null,
          })).filter(v => v.value !== '' && v.value != null)

          const body = {
            patientId:      patient.id,
            prescriptionId: savedId,
            labTestId:      r.labTestId || null,
            testName:       r.testName.trim(),
            testCategory:   r.testCategory || null,
            resultDate:     r.resultDate || format(new Date(),'yyyy-MM-dd'),
            freeTextResult: r.freeTextResult?.trim() || null,
            notes:          r.notes?.trim() || null,
            values:         valuesPayload,
          }
          if (r.id) {
            await api.patch(`/lab-results/${r.id}`, body).catch(() => {})
          } else {
            const { data } = await api.post('/lab-results', body).catch(() => ({}))
            // Stamp id back on the row so subsequent saves PATCH instead of duplicating
            if (data?.data?.id) {
              setRxLabResults(prev => prev.map(x => x.tempId === r.tempId ? { ...x, id: data.data.id } : x))
            }
          }
        }
      } catch {}

      setDirty(false)
      // Mark today's queue entry as Done — fire-and-forget, idempotent on backend
      if (patient?.id) {
        api.post(`/appointments/queue/today/${patient.id}/complete`, {}, { silent: true }).catch(() => {})
      }
      // Route based on requested mode
      if (mode === 'print') {
        navigate(`/prescriptions/${savedId}?print=1`)
      } else {
        // 'stay' — keep user on the form but switch to edit mode so further Saves update
        if (!isEdit) navigate(`/prescriptions/${savedId}/edit`, { replace: true })
      }
    } catch {} finally { setSaving(false) }
  }

  const ArrowDown = ({ active, onClick }) => (
    <button type="button" onClick={onClick}
      className={`w-5 h-5 flex items-center justify-center rounded transition-all flex-shrink-0 ${active?'text-primary hover:bg-blue-100 cursor-pointer':'text-slate-200 cursor-not-allowed'}`}>
      <svg width="9" height="12" viewBox="0 0 9 12" fill="none">
        <path d="M4.5 1v10M1.5 8.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )

  return (
    <>
    <div className="fade-in max-w-5xl mx-auto">
      {/* Sticky header — stays pinned while the form scrolls */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 mb-4 border-b border-blue-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={()=>navigate('/prescriptions')} className="btn-ghost btn-icon flex-shrink-0"><ArrowLeft className="w-5 h-5"/></button>
          <div className="flex-1 min-w-0">
            <h1 className="page-title text-base sm:text-xl truncate">{isEdit ? 'Edit Prescription' : 'New Prescription'}</h1>
            <p className="page-subtitle text-xs hidden sm:block">{format(new Date(),'EEEE, dd MMMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {!isEdit && <AutosaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt}/>}
            <select className="form-select w-24 sm:w-32 text-xs sm:text-sm" value={printLang} onChange={e=>setPrintLang(e.target.value)}>
              <option value="en">🇬🇧 EN</option>
              <option value="hi">🇮🇳 HI</option>
              <option value="mr">🇮🇳 MR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient block — sits OUTSIDE the reorderable section list. Always first. */}
      <div id="sec-patient" className="scroll-mt-20 mb-4"><Card>
        <h3 className="font-bold text-slate-700 mb-3">Patient</h3>
        {!patient ? (
            <div className="relative">
              <input autoFocus className="form-input" placeholder="Click to see all patients or search by name / phone..."
                value={ptSearch}
                onChange={e=>{setPtSearch(e.target.value);setShowPtDrop(true)}}
                onFocus={()=>fetchPatients('')}
                onBlur={()=>setTimeout(()=>setShowPtDrop(false),250)}/>
              {showPtDrop && ptResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  {ptResults.map(p=>(
                    <button key={p.id} type="button" onMouseDown={()=>{setPatient(p);setPtSearch('');setPtResults([]);setShowPtDrop(false);api.get(`/prescriptions/patient/${p.id}/last`).then(r=>{if(r.data.data)setLastRx(r.data.data)}).catch(()=>{})}}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-slate-50 last:border-0">
                      <div className="w-9 h-9 rounded-xl bg-primary text-white font-bold flex items-center justify-center flex-shrink-0">{p.name[0]}</div>
                      <div>
                        <p className="font-medium text-sm text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.patientCode} • {p.age}y {p.gender} • {p.phone}</p>
                        {p.allergies?.length>0 && <p className="text-xs text-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Allergy: {p.allergies.join(', ')}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-3 bg-background rounded-xl">
              <div className="w-11 h-11 rounded-xl bg-primary text-white font-bold text-lg flex items-center justify-center flex-shrink-0">{patient.name[0]}</div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{patient.name}</p>
                <p className="text-sm text-slate-400">{patient.patientCode} • {patient.age}y {patient.gender} • {patient.phone}</p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {patient.allergies?.map(a=><Badge key={a} variant="danger">⚠ {a}</Badge>)}
                  {patient.chronicConditions?.map(c=><Badge key={c} variant="warning">{c}</Badge>)}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {lastRx&&!isEdit && <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5"/>} onClick={carryForward}>Load Last Rx</Button>}
                {!isEdit && <Button variant="ghost" size="sm" onClick={()=>{setPatient(null);setLastRx(null)}}>Change</Button>}
              </div>
            </div>
          )}
        </Card></div>

      {/* Reorderable section list — flex-col + per-section `order` lets the doctor's
          preferred order (saved in pageDesign.fieldOrder) drive the layout. Patient
          block is OUTSIDE this container so it always stays at the top, and the
          action bar at the bottom is also OUTSIDE so it always stays at the bottom. */}
      <div className="flex flex-col gap-4">

        {/* Vitals */}
        <div id="sec-vitals" className="scroll-mt-20" style={{display: showSection('showVitals') ? '' : 'none', order: getSectionOrder('vitals')}}
             onBlur={handleSectionBlur('sec-vitals', Object.values(vitals).some(v => v && String(v).trim() !== ''))}><Card>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">Vitals <Badge variant="gray">Optional</Badge></h3>
            <button type="button" onClick={()=>setShowVitals(v=>!v)} className="text-sm text-primary hover:underline flex items-center gap-1">
              <Activity className="w-3.5 h-3.5"/>{showVitals ? 'Hide' : 'Record Vitals'}
            </button>
          </div>
          {showVitals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {[
                {key:'bp',     label:'Blood Pressure', ph:'120/80',    cfgKey:'vitalBP'},
                {key:'sugar',  label:'Blood Sugar',    ph:'110 mg/dL', cfgKey:'vitalSugar'},
                {key:'weight', label:'Weight (kg)',    ph:'70',        cfgKey:'vitalWeight'},
                {key:'temp',   label:'Temp (°F)',      ph:'98.6',      cfgKey:'vitalTemp'},
                {key:'spo2',   label:'SpO2 %',         ph:'98',        cfgKey:'vitalSpo2'},
                {key:'pulse',  label:'Pulse/min',      ph:'72',        cfgKey:'vitalPulse'},
                {key:'height', label:`Height (${vitals.heightUnit||'cm'})`, ph: vitals.heightUnit==='ft' ? '5.7' : '170', cfgKey:'vitalHeight'},
                {key:'bmi',    label:'BMI',            ph:'Auto',      cfgKey:'vitalBMI'},
              ].filter(f => {
                // Use rx_form config for vital field visibility
                if (pdLoaded && pageDesign && pageDesign[f.cfgKey] !== undefined) return pageDesign[f.cfgKey] !== false
                // Default: show standard 6 vitals, hide Height and BMI
                return f.cfgKey !== 'vitalHeight' && f.cfgKey !== 'vitalBMI'
              })
              .map(f=>(
                <div key={f.key} className="form-group">
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label mb-0">{f.label}</label>
                    {f.key==='height' && (
                      <button type="button" onClick={()=>setVitals(p=>({...p,heightUnit:p.heightUnit==='ft'?'cm':'ft',height:''}))}
                        className="text-xs text-primary hover:underline">{vitals.heightUnit==='ft'?'Switch to cm':'Switch to ft'}</button>
                    )}
                  </div>
                  {f.key === 'bp' ? (
                    <BloodPressureInput
                      value={vitals.bp||''}
                      onChange={v=>setVitals(p=>({...p,bp:v}))}
                    />
                  ) : f.key === 'bmi' ? (
                    <input className="form-input bg-slate-50 text-slate-500" placeholder="Auto" readOnly
                      value={vitals.bmi||''} title="Auto-calculated from Weight and Height"/>
                  ) : (
                    <input className="form-input" placeholder={f.ph} value={vitals[f.key]||''} onChange={e=>setVitals(p=>({...p,[f.key]:e.target.value}))}/>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card></div>

        {/* Complaint */}
        <div id="sec-complaint" className="scroll-mt-20" style={{display: showSection('showComplaint') ? '' : 'none', order: getSectionOrder('complaint')}}
             onBlur={handleSectionBlur('sec-complaint', complaintTags.length > 0)}><Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">Chief Complaint</h3>
            <div className="flex gap-2">
              {complaintTags.length>0 && <button type="button" onClick={()=>setComplaintTags([])} className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"><X className="w-3 h-3"/>Clear All</button>}
              <SectionTemplate label="Complaint Templates" section="complaint" templates={allTemplates} onApply={t=>{ if(t.complaint) setComplaintTags(p=>[...new Set([...p,...t.complaint.split('||').map(s=>s.trim()).filter(Boolean)])])}}/>
            </div>
          </div>
          <TagInput
            tags={complaintTags}
            onAdd={t=>{setComplaintTags(p=>[...p,t]);setDirty()}}
            onRemove={t=>setComplaintTags(p=>p.filter(x=>x!==t))}
            items={complaints}
            placeholder="Type complaint or select, press Enter to add another..."/>
        </Card></div>

        {/* Diagnosis */}
        <div id="sec-diagnosis" className="scroll-mt-20" style={{display: showSection('showDiagnosis') ? '' : 'none', order: getSectionOrder('diagnosis')}}
             onBlur={handleSectionBlur('sec-diagnosis', diagnosisTags.length > 0)}><Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">Diagnosis</h3>
            <div className="flex gap-2">
              {diagnosisTags.length>0 && <button type="button" onClick={()=>setDiagnosisTags([])} className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"><X className="w-3 h-3"/>Clear All</button>}
              <SectionTemplate label="Diagnosis Templates" section="diagnosis" templates={allTemplates} onApply={t=>{ if(t.diagnosis) setDiagnosisTags(p=>[...new Set([...p,...t.diagnosis.split('||').map(s=>s.trim()).filter(Boolean)])])}}/>
            </div>
          </div>
          <TagInput
            tags={diagnosisTags}
            onAdd={t=>{setDiagnosisTags(p=>[...p,t]);setDirty()}}
            onRemove={t=>setDiagnosisTags(p=>p.filter(x=>x!==t))}
            items={diagnoses}
            placeholder="Type diagnosis or select, press Enter to add another..."/>
        </Card></div>

        {/* Medicines */}
        <div id="sec-medicines" className="scroll-mt-20" style={{order: getSectionOrder('medicines')}}
             onFocusCapture={handleMedicinesFirstFocus}><Card>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              Medicines <Badge variant="primary">{rxMeds.filter(m=>m.medicineName).length}</Badge>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {rxMeds.filter(m=>m.medicineName).length>0 && <button type="button" onClick={()=>setRxMeds([{...emptyMed}])} className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"><X className="w-3 h-3"/>Clear All</button>}
              <SectionTemplate label="Medicine Templates" section="medicines" templates={allTemplates} onApply={t=>{ if(t.medicines?.length>0){api.post(`/templates/${t.id}/use`).then(({data})=>{setRxMeds(p=>{const existing=p.filter(m=>m.medicineName);const newMeds=data.data.medicines||[];return[...existing,...newMeds,{...emptyMed}]});toast.success(`${t.name} medicines loaded!`)}).catch(()=>{})} }}/><Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5"/>} onClick={addRow}>Add Row</Button></div>
          </div>
          <p className="text-xs text-slate-400 mb-3">💡 Click <strong className="text-primary">↓</strong> in headers to apply value to all rows</p>

          {/* ── Medicine table — desktop ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" style={{tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'26px'}}/><col style={{width:'180px'}}/><col style={{width:'100px'}}/>
              <col style={{width:'105px'}}/><col style={{width:'110px'}}/><col style={{width:'95px'}}/><col style={{width:'50px'}}/>
              <col/><col style={{width:'26px'}}/>
            </colgroup>
            <thead>
              <tr className="border-b-2 border-blue-100">
                <th className="pb-2"></th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Medicine</th>
                <th className="pb-2 px-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Dosage</span>
                    <ArrowDown active={rxMeds.some(m=>m.dosage)} onClick={()=>applyToAll('dosage')}/>
                  </div>
                </th>
                {/* When BEFORE Days */}
                <th className="pb-2 px-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase">When</span>
                    <ArrowDown active={rxMeds.some(m=>m.timing)} onClick={()=>applyToAll('timing')}/>
                  </div>
                </th>
                <th className="pb-2 px-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Freq.</span>
                    <ArrowDown active={rxMeds.some(m=>m.frequency)} onClick={()=>applyToAll('frequency')}/>
                  </div>
                </th>
                <th className="pb-2 px-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Duration</span>
                    <ArrowDown active={rxMeds.some(m=>m.days)} onClick={()=>applyToAll('days')}/>
                  </div>
                </th>
                <th className="text-center pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Qty</th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rxMeds.map((med, idx) => {
                const isNT = NON_TABLET.includes(med.medicineType)
                return (
                  <tr key={idx} className={med.medicineName?'bg-blue-50/20':''}>
                    <td className="py-1.5 pr-1">
                      <span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{idx+1}</span>
                    </td>
                    <td className="py-1.5 px-1">
                      <MedInput value={med.medicineName} medicineId={med.medicineId} onSelect={handleMedSelect} onTyped={handleMedTyped} medicines={medicines} rowIndex={idx} recentIds={recentMedIds}/>
                      {med.medicineId && (
                        <GenericInput
                          medicineId={med.medicineId}
                          value={med.genericName}
                          canEdit={canEditGeneric}
                          onSaved={handleGenericSaved}/>
                      )}
                    </td>
                    <td className="py-1.5 px-1">
                      {isNT ? <div className="h-8 px-2 flex items-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100">N/A</div>
                        : <ColDrop value={med.dosage} options={DOSAGE_OPTS} placeholder="Select" onChange={v=>updateMed(idx,'dosage',v)}/>}
                    </td>
                    <td className="py-1.5 px-1">
                      <ColDrop value={med.timing} options={TIMING_OPTS} placeholder="When" onChange={v=>updateMed(idx,'timing',v)}/>
                    </td>
                    <td className="py-1.5 px-1">
                      <ColDrop value={med.frequency||'DAILY'} options={FREQ_OPTS} placeholder="Freq." onChange={v=>updateMed(idx,'frequency',v)}/>
                    </td>
                    <td className="py-1.5 px-1">
                      <SmartDaysInput value={med.days} onChange={v=>updateMed(idx,'days',v)}/>
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" min="0"
                        className="w-full h-8 px-1 text-sm text-center font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white"
                        value={med.qty||''}
                        placeholder={isNT ? '1' : ''}
                        onChange={e=>updateMed(idx,'qty',e.target.value)}/>
                    </td>
                    {/* Notes — smart suggestions per medicine type, server-synced on submit */}
                    <td className="py-1.5 px-1">
                      <NotesInput
                        value={med.notesEn}
                        onChange={v=>updateMed(idx,'notesEn',v)}
                        medicineType={med.medicineType}
                        printLang={printLang}
                        savedNotes={savedMedNotes}
                        onNoteCommit={v => setSavedMedNotes(prev => [v, ...prev.filter(n => n.toLowerCase() !== v.toLowerCase())].slice(0, 100))}
                      />
                    </td>
                    <td className="py-1.5 pl-1">
                      <button type="button" onClick={()=>removeRow(idx)} className="w-6 h-8 flex items-center justify-center text-slate-300 hover:text-danger rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {/* ── Medicine rows — mobile card style ── */}
          <div className="md:hidden space-y-3">
            {rxMeds.map((med, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{idx+1}</span>
                  <button type="button" onClick={()=>removeRow(idx)} className="text-slate-300 hover:text-danger transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
                <div className="mb-2">
                  <p className="text-xs text-slate-400 mb-1">Medicine</p>
                  <MedInput value={med.medicineName} medicineId={med.medicineId}
                    onSelect={handleMedSelect} onTyped={handleMedTyped}
                    medicines={medicines} rowIndex={idx} recentIds={recentMedIds}/>
                  {med.medicineId && (
                    <GenericInput
                      medicineId={med.medicineId}
                      value={med.genericName}
                      canEdit={canEditGeneric}
                      onSaved={handleGenericSaved}/>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Dosage</p>
                    <ColDrop value={med.dosage} options={DOSAGE_OPTS}
                      placeholder="Select" onChange={v=>updateMed(idx,'dosage',v)}/>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">When</p>
                    <ColDrop value={med.timing} options={TIMING_OPTS}
                      placeholder="When" onChange={v=>updateMed(idx,'timing',v)}/>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Freq.</p>
                    <ColDrop value={med.frequency||'DAILY'} options={FREQ_OPTS}
                      placeholder="Freq." onChange={v=>updateMed(idx,'frequency',v)}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Duration</p>
                    <SmartDaysInput value={med.days} onChange={v=>updateMed(idx,'days',v)}/>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Qty</p>
                    <input type="number" min="0"
                      className="w-full h-8 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white font-bold text-center"
                      value={med.qty||''} onChange={e=>updateMed(idx,'qty',e.target.value)}/>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Notes</p>
                    <NotesInput value={med.notesEn} onChange={v=>updateMed(idx,'notesEn',v)}
                      medicineType={med.medicineType} printLang={printLang} savedNotes={savedMedNotes}
                      onNoteCommit={v => setSavedMedNotes(prev => [v, ...prev.filter(n => n.toLowerCase() !== v.toLowerCase())].slice(0, 100))}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow}
            className="mt-3 w-full border-2 border-dashed border-blue-100 rounded-xl py-2 text-sm text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4"/>Add Medicine Row
          </button>
        </Card></div>

        {/* Lab Tests */}
        <div id="sec-labtests" className="scroll-mt-20" style={{display: showSection('showLabTests') ? '' : 'none', order: getSectionOrder('labTests')}}
             onBlur={handleSectionBlur('sec-labtests', rxTests.length > 0)}><Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">Lab Tests</h3>
            <div className="flex gap-2">
              {rxTests.length>0 && <button type="button" onClick={()=>setRxTests([])} className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"><X className="w-3 h-3"/>Clear All</button>}
              <SectionTemplate label="Lab Test Templates" section="labTests" templates={allTemplates} onApply={t=>{ if(t.labTests?.length>0){ t.labTests.forEach((name,i)=>{ const item=labTestList.find(l=>l.name===name); if(item&&!rxTests.find(x=>x.id===item.id)) setRxTests(p=>[...p,{id:item.id,name}]); else if(!item) setRxTests(p=>[...p,{id:'new_'+Date.now()+i,name,isNew:true}]) }); toast.success('Lab tests loaded!') }}}/>
            </div>
          </div>
          <TagSearch
            tags={rxTests}
            onAdd={t=>{ if(!rxTests.find(x=>x.id===t.id)) setRxTests(p=>[...p,t]) }}
            onRemove={t=>setRxTests(p=>p.filter(x=>x.id!==t.id))}
            items={labTestList}
            placeholder="Search lab test or type new name (auto-saved)..."
            allowCustom={true}/>
        </Card></div>


        {/* Advice */}
        <div id="sec-advice" className="scroll-mt-20" style={{display: showSection('showAdvice') ? '' : 'none', order: getSectionOrder('advice')}}><Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">Advice & Precautions</h3>
            <div className="flex gap-2">
              {rxAdvice.length>0 && <button type="button" onClick={()=>setRxAdvice([])} className="text-xs text-slate-400 hover:text-danger flex items-center gap-1"><X className="w-3 h-3"/>Clear All</button>}
              <SectionTemplate label="Advice Templates" section="advice" templates={allTemplates} onApply={t=>{ if(t.advice){ t.advice.split('\n').filter(Boolean).forEach((a,i)=>{ if(!rxAdvice.find(x=>x.name===a)) setRxAdvice(p=>[...p,{id:'adv_'+Date.now()+i,name:a}]) }); toast.success('Advice loaded!') }}}/>
            </div>
          </div>
          <TagSearch
            tags={rxAdvice}
            onAdd={t=>{ if(!rxAdvice.find(x=>x.id===t.id)) setRxAdvice(p=>[...p,t]) }}
            onRemove={t=>setRxAdvice(p=>p.filter(x=>x.id!==t.id))}
            items={adviceList.map(a=>({id:a.id,name:a.nameEn}))}
            placeholder="Search advice or type new (auto-saved)..."
            allowCustom={true}/>
        </Card></div>

        {/* Custom fields — clinic-defined extra fields rendered as multi-tag TagInputs.
            Each TagInput's items are filtered locally from the flat customFieldValues
            list by fieldId — fetched once on mount, sliced per render. New values typed
            here get auto-saved to the master on Rx save (see autoSaveToMaster). */}
        {customFieldsConfig.map(cf => {
          const tags = Array.isArray(customData[cf.id]) ? customData[cf.id] : []
          // Only show suggestions for THIS custom field. Done locally to avoid N requests.
          const fieldItems = customFieldValues.filter(v => v.fieldId === cf.id)
          return (
            <div key={cf.id} id={`sec-cf-${cf.id}`} className="scroll-mt-20"
                 style={{order: getSectionOrder(cf.id)}}>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700">{cf.name}</h3>
                  {tags.length > 0 && (
                    <button type="button"
                            onClick={() => setCustomData(prev => ({ ...prev, [cf.id]: [] }))}
                            className="text-xs text-slate-400 hover:text-danger flex items-center gap-1">
                      <X className="w-3 h-3"/>Clear All
                    </button>
                  )}
                </div>
                <TagInput
                  tags={tags}
                  onAdd={(text) => {
                    setCustomData(prev => {
                      const cur = Array.isArray(prev[cf.id]) ? prev[cf.id] : []
                      if (cur.includes(text)) return prev
                      return { ...prev, [cf.id]: [...cur, text] }
                    })
                    setDirty()
                  }}
                  onRemove={(text) => {
                    setCustomData(prev => {
                      const cur = Array.isArray(prev[cf.id]) ? prev[cf.id] : []
                      return { ...prev, [cf.id]: cur.filter(t => t !== text) }
                    })
                  }}
                  items={fieldItems}
                  placeholder={`Type ${cf.name.toLowerCase()} or select, press Enter to add another...`}/>
              </Card>
            </div>
          )
        })}

        {/* Next Visit & Settings — kept as a single card so admin niceties
            (Custom Rx No, Print Language) live alongside the date the doctor
            actually cares about. Reorderable as the `nextVisit` section. */}
        <div id="sec-nextvisit" className="scroll-mt-20"
             style={{display: showSection('showNextVisit') ? '' : 'none', order: getSectionOrder('nextVisit')}}>
          <Card>
            <h3 className="font-bold text-slate-700 mb-3">Next Visit & Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Next Visit Date</label>
                <input type="date" className="form-input" value={nextVisit} onChange={e=>setNextVisit(e.target.value)}/>
                {nextVisit && <p className="text-xs text-success mt-1">✓ Auto-set from medicine duration</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Custom Rx No.</label>
                <input className="form-input font-mono" placeholder="Auto-generated if empty" value={customRxNo} onChange={e=>setCustomRxNo(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Print Language</label>
                <select className="form-select" value={printLang} onChange={e=>setPrintLang(e.target.value)}>
                  <option value="en">English</option><option value="hi">Hindi</option><option value="mr">Marathi</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

      </div>{/* end flex-col reorderable sections */}

        <div ref={bottomBarRef} className="flex flex-col sm:flex-row justify-between gap-3 pb-12">
          <Button variant="outline" icon={<BookOpen className="w-4 h-4"/>} onClick={handleSaveAsTemplate}>
            Save as Template
          </Button>
          <div className="flex gap-3 flex-wrap">
            <Button variant="ghost" onClick={()=>guardedAction(()=>navigate('/prescriptions'))}>Cancel</Button>
            <Button variant="outline" loading={saving} size="lg" icon={<Save className="w-5 h-5"/>} onClick={()=>handleSave('stay')}>
              {isEdit ? 'Update' : 'Save'}
            </Button>
            <Button variant="primary" loading={saving} size="lg" icon={<Printer className="w-5 h-5"/>} onClick={()=>handleSave('print')}>
              Save &amp; Print
            </Button>
          </div>
        </div>
    </div>
    <ConfirmDialog {...confirmProps} confirmLabel="Yes, Discard" cancelLabel="Keep Editing"/>

    {/* Right-side FAB rail.
        - Test Outcomes flask: stays visible always (per design).
        - Save + Print: auto-hide when bottom save bar is visible (avoid duplicate controls).
        Note: when bar is visible, only the bottom two FABs hide; the flask stays so
        doctor can always open the test outcomes workspace, even from the bottom of the form. */}
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5 items-end no-print print:hidden">
      {showSection('showTestOutcomes') && (
        <button
          type="button"
          onClick={() => setOutcomesOpen(true)}
          title="Open Test Outcomes"
          aria-label="Open Test Outcomes"
          className="w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 hover:shadow-2xl active:scale-95 transition flex items-center justify-center relative animate-in fade-in"
        >
          <FlaskConical className="w-6 h-6"/>
          {rxLabResults.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-success text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
              {rxLabResults.length > 9 ? '9+' : rxLabResults.length}
            </span>
          )}
        </button>
      )}
      {!bottomBarVisible && (
        <>
          <button
            type="button"
            onClick={() => handleSave('stay')}
            disabled={saving}
            title={isEdit ? 'Update' : 'Save'}
            aria-label={isEdit ? 'Update' : 'Save'}
            className="w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 hover:shadow-2xl active:scale-95 transition disabled:opacity-60 disabled:cursor-wait flex items-center justify-center animate-in fade-in"
          >
            {saving
              ? <span className="spinner w-5 h-5 border-white"/>
              : <Save className="w-6 h-6"/>}
          </button>
          <button
            type="button"
            onClick={() => handleSave('print')}
            disabled={saving}
            title="Save & Print"
            aria-label="Save & Print"
            className="w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 hover:shadow-2xl active:scale-95 transition disabled:opacity-60 disabled:cursor-wait flex items-center justify-center animate-in fade-in"
          >
            {saving
              ? <span className="spinner w-5 h-5 border-white"/>
              : <Printer className="w-6 h-6"/>}
          </button>
        </>
      )}
    </div>

    {/* Test Outcomes — full-screen modal that feels like a dedicated page.
        Lives inside the Rx form so state (rxLabResults) stays in one place — no routing,
        no draft sync, no data loss risk. Click left FAB to open. Outcomes auto-save when
        the parent Rx is saved (same flow as before).
        Design: categorized accordion. Click a category → ALL its individual test fields
        appear inline as rows with their own textbox + reference range hint. One date at top
        applies to the whole batch (cascades on change). Search filters across all fields. */}
    {outcomesOpen && (
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-center p-3 sm:p-6 no-print print:hidden animate-in fade-in">
        {/* Modal stays open until user explicitly clicks X or Done — clicking on the
            backdrop while filling forms used to close it accidentally. */}
        <div className="bg-background w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header — patient context + close */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5"/>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-800 text-base sm:text-lg truncate">Test Outcomes</h2>
                {patient && (
                  <p className="text-xs text-slate-500 truncate">
                    {patient.prefix ? patient.prefix + ' ' : ''}{patient.name}
                    {patient.patientCode && <span> · {patient.patientCode}</span>}
                    {patient.age && <span> · {patient.age}y</span>}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOutcomesOpen(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-2 transition flex-shrink-0"
              title="Close"
              aria-label="Close">
              <X className="w-5 h-5"/>
            </button>
          </div>

          {/* Top date picker — used only for ADDING a new date column. The actual
              date chips with edit/remove live inside each expanded category in
              context with the input rows below. Pick a date here and it gets
              added as a column visible in every category. */}
          <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-b border-slate-200 bg-blue-50/40 flex-shrink-0">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0"/>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex-shrink-0">
              Add Date:
            </span>
            <input
              type="date"
              className="form-input text-sm py-1 px-2 w-auto"
              onChange={(e) => {
                if (e.target.value) {
                  addDate(e.target.value)
                  e.target.value = ''   // reset so picking same date again still fires onChange
                }
              }}
              aria-label="Pick a date to add as a new column"
              title="Pick any date to add a new column. Edit or remove it from inside any category below."/>
            <span className="text-[10px] text-slate-500 ml-auto hidden sm:inline">
              {outcomesDates.length} date column{outcomesDates.length !== 1 ? 's' : ''} active · edit or remove from inside categories
            </span>
          </div>

          {/* Search picker — TagSearch-style typeahead.
              • Click → dropdown shows full lab-tests catalog (sorted by category → name)
              • Type → live filter
              • Click a result → test added to body for value entry, dropdown stays open
              • Already-added tests are excluded from results
              The body itself is no longer filtered by this query — it shows added tests only. */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="relative flex-1 min-w-[200px]"
                 onBlur={(e) => {
                   // Close dropdown only when focus leaves the whole container
                   if (!e.currentTarget.contains(e.relatedTarget)) {
                     setTimeout(() => setOutcomesPickerOpen(false), 150)
                   }
                 }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <input
                type="text"
                className="form-input pl-9 text-sm py-1.5"
                placeholder="Click to browse all tests, or type to search (Hb, LDL, TSH)…"
                value={outcomesSearchQuery}
                onFocus={() => setOutcomesPickerOpen(true)}
                onChange={(e) => { setOutcomesSearchQuery(e.target.value); setOutcomesPickerOpen(true) }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOutcomesPickerOpen(false)
                  if (e.key === 'Enter' && outcomesPickerItems.length > 0) {
                    e.preventDefault()
                    pickCategory(outcomesPickerItems[0])
                  }
                }}/>
              {outcomesSearchQuery && (
                <button type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOutcomesSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
                  title="Clear search">
                  <X className="w-3.5 h-3.5"/>
                </button>
              )}
              {outcomesPickerOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                  {(labTestList || []).length === 0 ? (
                    <div className="px-3 py-3 text-xs text-amber-800 bg-amber-50">
                      No lab tests in master data yet. Ask your admin to <strong>Load Default Data</strong> in Master Data → Lab Tests.
                    </div>
                  ) : outcomesPickerItems.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-500">
                      {outcomesSearchQuery.trim()
                        ? <>No categories match <strong>"{outcomesSearchQuery}"</strong>.</>
                        : <>All categories already added.</>}
                    </div>
                  ) : (
                    outcomesPickerItems.map((cat) => {
                      const partial = cat.totalCount > cat.remainingIds.length
                      return (
                        <button key={cat.name} type="button"
                          onMouseDown={(e) => { e.preventDefault(); pickCategory(cat) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-b-0 flex items-center justify-between gap-2 transition">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Plus className="w-4 h-4 text-primary flex-shrink-0"/>
                            <span className={`w-1 h-5 rounded-full flex-shrink-0 ${categoryColor(cat.name)}`}/>
                            <span className="text-sm font-bold text-slate-800 uppercase tracking-wide truncate">{cat.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium flex-shrink-0">
                            {partial
                              ? `+${cat.remainingIds.length} of ${cat.totalCount}`
                              : `${cat.totalCount} test${cat.totalCount > 1 ? 's' : ''}`}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <button type="button"
              onClick={expandAllCategories}
              className={`text-xs px-2 py-1 rounded transition ${showAllCategories ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-primary hover:bg-blue-50'}`}
              title="Show every category in the catalog">
              {showAllCategories ? 'Showing all' : 'Browse all'}
            </button>
            <button type="button"
              onClick={collapseAllCategories}
              className="text-xs text-slate-600 hover:text-primary px-2 py-1 rounded hover:bg-blue-50 transition"
              title="Show only added tests">
              Hide empty
            </button>
          </div>

          {/* Body — scrollable. Categories listed; click to expand → field rows with inline textboxes. */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {outcomesFilteredCategories.length === 0 && outcomesOrphanRows.length === 0 ? (
              (labTestList || []).length === 0 ? (
                /* Master data not loaded yet */
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-center">
                  No lab tests in master data yet. Ask your admin to <strong>Load Default Data</strong> in Master Data → Lab Tests.
                </div>
              ) : outcomesSearchQuery.trim() ? (
                /* User searched but nothing matched */
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-center">
                  No tests match <strong>"{outcomesSearchQuery}"</strong>. Try a shorter query.
                </div>
              ) : (
                /* Default — nothing entered yet, friendly entry hint */
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl py-10 px-6 text-center">
                  <Search className="w-10 h-10 text-primary/40 mx-auto mb-3"/>
                  <p className="text-sm text-slate-700 font-medium">Search to record a test result</p>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Type a test name or field above (try <strong>Hb</strong>, <strong>LDL</strong>, or <strong>TSH</strong>)
                    <br className="hidden sm:inline"/>
                    {' '}— or {' '}
                    <button type="button" onClick={expandAllCategories}
                      className="text-primary hover:underline font-medium">
                      browse all categories
                    </button>.
                  </p>
                </div>
              )
            ) : (
              outcomesFilteredCategories.map(([cat, rows]) => {
                const open = isCategoryOpen(cat)
                // Group rows by labTestId so each test (CBC, HbA1c, Lipid Profile)
                // gets its own visual block with a header + remove button. Map
                // preserves insertion order so the layout is stable across renders.
                const testGroups = new Map()
                for (const row of rows) {
                  if (!testGroups.has(row.labTestId)) {
                    testGroups.set(row.labTestId, { labTestName: row.labTestName, rows: [] })
                  }
                  testGroups.get(row.labTestId).rows.push(row)
                }
                // Count cells (per row × per date) that have a non-empty value
                let filledInCat = 0
                for (const row of rows) {
                  for (const d of outcomesDates) {
                    const v = getRowValue(row, d)
                    if (v && String(v).trim()) filledInCat++
                  }
                }
                const testsInCat = testGroups.size
                // Grid template — label column (flexible) + N fixed-width input columns + 1 trailing column for ✕
                // colWidth = 9rem so the date chip ([📅 04/29/2026 ✕]) fits cleanly above its input column
                const colWidth = '9rem'
                const gridTemplate = `minmax(0, 1fr) ${outcomesDates.map(() => colWidth).join(' ')} 1.25rem`
                return (
                  <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button"
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50 transition text-left">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-1.5 h-6 rounded-full flex-shrink-0 ${categoryColor(cat)}`}/>
                        <span className="font-semibold text-sm text-slate-800 uppercase tracking-wide truncate">{cat}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">({testsInCat} test{testsInCat>1?'s':''})</span>
                        {filledInCat > 0 && (
                          <span className="text-[10px] bg-success/10 text-success font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            {filledInCat} filled
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`}/>
                    </button>
                    {open && (
                      <div className="border-t border-slate-100 overflow-x-auto">
                        {/* Date chips row — uses the SAME grid template as the input rows below
                            so each chip sits directly above its input column. Chip = column.
                            Edit the date inside a chip to change that whole column; click ✕ to
                            remove it (always confirms). Adding a date is handled exclusively by
                            the picker at the top of the modal. */}
                        <div className="grid items-center gap-x-3 px-4 py-2 bg-blue-50/30 border-b border-slate-100"
                             style={{ gridTemplateColumns: gridTemplate }}>
                          <span/>{/* spacer for the test-label column */}
                          {outcomesDates.map((date) => (
                            <div key={date}
                              className="inline-flex items-center justify-self-center gap-0.5 bg-white border border-blue-200 rounded-lg pl-1.5 pr-0.5 py-0.5 hover:border-blue-300 transition shadow-sm">
                              <Calendar className="w-3 h-3 text-primary flex-shrink-0"/>
                              <input
                                type="date"
                                value={date}
                                onChange={(e) => changeDate(date, e.target.value)}
                                className="bg-transparent border-0 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-0 p-0 cursor-pointer"
                                aria-label="Edit date"/>
                              {outcomesDates.length > 1 && (
                                <button type="button"
                                  onClick={() => removeDate(date)}
                                  className="ml-0.5 text-slate-400 hover:text-white hover:bg-danger rounded p-0.5 transition flex-shrink-0"
                                  title={`Remove ${date} column`}
                                  aria-label={`Remove ${date} column`}>
                                  <X className="w-3 h-3"/>
                                </button>
                              )}
                            </div>
                          ))}
                          <span/>{/* trailing spacer to align with row's per-test ✕ column */}
                        </div>
                        {Array.from(testGroups.entries()).map(([labTestId, group], groupIdx) => {
                          // For single-field tests we skip the per-test header and put a tiny ✕ on
                          // the row itself — saves a whole line of vertical space per test, which
                          // adds up fast for biochemistry-style panels with 10+ entries.
                          // Multi-field tests (CBC, Lipid Profile) keep the header so the test name
                          // is unambiguous when several fields stack underneath.
                          const isSingle = group.rows.length === 1
                          return (
                          <div key={labTestId || `freetext-${groupIdx}`} className={groupIdx > 0 ? 'border-t border-slate-100' : ''}>
                            {!isSingle && (
                              <div className="flex items-center justify-between gap-2 px-4 py-1 bg-slate-50/40">
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide truncate">{group.labTestName}</span>
                                {labTestId && (
                                  <button type="button"
                                    onClick={() => removeAddedLabTest(labTestId)}
                                    className="text-slate-300 hover:text-danger hover:bg-danger/10 rounded p-0.5 transition flex-shrink-0"
                                    title={`Remove ${group.labTestName}`}
                                    aria-label={`Remove ${group.labTestName}`}>
                                    <X className="w-3 h-3"/>
                                  </button>
                                )}
                              </div>
                            )}
                            {group.rows.map((row) => {
                              const hasRange = typeof row.normalLow === 'number' || typeof row.normalHigh === 'number'
                              const rangeStr = hasRange
                                ? (typeof row.normalLow === 'number' && typeof row.normalHigh === 'number'
                                    ? `${row.normalLow}–${row.normalHigh}`
                                    : typeof row.normalLow === 'number' ? `≥ ${row.normalLow}` : `≤ ${row.normalHigh}`)
                                : null
                              // Row is "any-flagged" if at least one date's value is out of range
                              const anyFlagged = !row.isFreeText && flagOutOfRange && outcomesDates.some(d => {
                                const v = getRowValue(row, d)
                                return isValueOutOfRange(v, row.normalLow, row.normalHigh)
                              })
                              return (
                                <div key={row.rowKey}
                                  className={`grid items-center gap-x-3 px-4 py-1 border-t border-slate-50 transition ${anyFlagged ? 'bg-red-50/30' : 'hover:bg-blue-50/30'}`}
                                  style={{ gridTemplateColumns: gridTemplate }}>
                                  {/* Label cell — right-aligned, with reference range pill */}
                                  <div className="text-right text-sm text-slate-700 min-w-0 flex items-center justify-end gap-2">
                                    <span className="truncate">
                                      {row.label}
                                      {row.unit && <span className="text-slate-400 ml-1">({row.unit})</span>}
                                    </span>
                                    {rangeStr && (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${anyFlagged ? 'bg-danger/15 text-danger' : 'bg-slate-100 text-slate-500'}`}
                                            title="Normal reference range">
                                        {rangeStr}
                                      </span>
                                    )}
                                  </div>
                                  {/* One input per date column */}
                                  {outcomesDates.map(d => {
                                    const v = getRowValue(row, d)
                                    const flagged = !row.isFreeText && flagOutOfRange && isValueOutOfRange(v, row.normalLow, row.normalHigh)
                                    if (row.isFreeText) {
                                      return (
                                        <input
                                          key={d}
                                          type="text"
                                          className="form-input text-sm py-1 px-2 w-full"
                                          placeholder="—"
                                          value={v}
                                          onChange={(e) => setRowValue(row, d, e.target.value)}
                                          title={`Result on ${d}`}/>
                                      )
                                    }
                                    return (
                                      <input
                                        key={d}
                                        type="text"
                                        inputMode="decimal"
                                        className={`form-input text-sm py-1 px-2 w-full text-right ${flagged ? 'bg-red-50 border-red-300 text-danger font-semibold focus:border-red-400 focus:ring-red-200' : ''}`}
                                        placeholder="—"
                                        value={v}
                                        onChange={(e) => setRowValue(row, d, e.target.value)}
                                        title={flagged ? `Out of normal range on ${d}` : `Value on ${d}`}/>
                                    )
                                  })}
                                  {/* Trailing ✕ — single-field tests use this to remove themselves;
                                      multi-field tests render an empty span to keep grid alignment. */}
                                  {isSingle && labTestId ? (
                                    <button type="button"
                                      onClick={() => removeAddedLabTest(labTestId)}
                                      className="text-slate-300 hover:text-danger transition flex items-center justify-center"
                                      title={`Remove ${group.labTestName}`}
                                      aria-label={`Remove ${group.labTestName}`}>
                                      <X className="w-3.5 h-3.5"/>
                                    </button>
                                  ) : <span/>}
                                </div>
                              )
                            })}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Orphan rows — saved values that don't map to current master data.
                Surfaced separately so users can review/clean up legacy free-text outcomes.
                Each orphan keeps its own resultDate displayed since it may not align
                with the current dates list. */}
            {outcomesOrphanRows.length > 0 && (
              <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0"/>
                  <span className="font-semibold text-sm text-slate-800 uppercase tracking-wide">Custom (Saved)</span>
                  <span className="text-xs text-slate-400">({outcomesOrphanRows.length})</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">— legacy entries not in current master</span>
                </div>
                <div className="border-t border-amber-100">
                  {outcomesOrphanRows.map((r) => (
                    <div key={r.tempId}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2 border-b border-slate-50 last:border-b-0">
                      <span className="text-sm text-right text-slate-700 truncate">{r.testName}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">
                        {r.resultDate}
                      </span>
                      <input
                        type="text"
                        className="form-input text-sm py-1 w-40 sm:w-56 flex-shrink-0"
                        placeholder="Result…"
                        value={r.freeTextResult || ''}
                        onChange={(e) => updateOutcomeMeta(r.tempId, 'freeTextResult', e.target.value)}/>
                      <button type="button"
                        onClick={() => removeOutcome(r.tempId)}
                        className="text-slate-400 hover:text-danger p-1 flex-shrink-0"
                        title="Remove">
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer — count + Done button. Test outcomes save when the parent Rx is saved. */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-white flex-shrink-0">
            <p className="text-xs text-slate-500 hidden sm:block">
              {outcomesFilledCount > 0
                ? `${outcomesFilledCount} value${outcomesFilledCount > 1 ? 's' : ''} entered across ${outcomesDates.length} date${outcomesDates.length > 1 ? 's' : ''} · saves with prescription`
                : 'Pick a category, enter values per date column. Saves with the prescription.'}
            </p>
            <div className="flex gap-2 ml-auto">
              <Button variant="primary" onClick={() => setOutcomesOpen(false)} icon={<X className="w-4 h-4"/>}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Resume-draft modal */}
    <Modal
      open={!!resumeDraft}
      onClose={() => setResumeDraft(null)}
      title="Unsaved draft found"
      footer={<>
        <Button variant="outline" onClick={discardDraft}>Discard Draft</Button>
        <Button variant="primary" onClick={() => applyDraft(resumeDraft)}>Continue Editing</Button>
      </>}
    >
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          You were filling a prescription for <strong>{patient?.name}</strong>
          {resumeDraft?.updatedAt && <> {' — '}last saved {timeSince(resumeDraft.updatedAt)}.</>}
        </p>
        <p className="text-slate-500 text-xs">
          Click <strong>Continue Editing</strong> to restore it, or <strong>Discard Draft</strong> to start fresh.
        </p>
      </div>
    </Modal>
    </>
  )
}

function timeSince(iso) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
