import { useEffect, useState, useRef, useCallback } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Save, Copy, AlertTriangle, ChevronDown, X, Activity, BookOpen, Zap } from 'lucide-react'
import { Button, Badge, Card, PageHeader, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

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
const FREQ_MAP    = { '1-0-0':1,'0-1-0':1,'0-0-1':1,'1-0-1':2,'1-1-0':2,'0-1-1':2,'1-1-1':3,'1-1-1-1':4,'OD':1,'BD':2,'TDS':3,'QID':4,'HS':1 }
const NON_TABLET  = ['liquid','drops','cream','inhaler','injection','powder']
const emptyMed    = { medicineId:'',medicineName:'',medicineType:'tablet',dosage:'',days:'',timing:'',qty:'',notesEn:'' }

// Syrup/liquid notes options (bilingual)
const LIQUID_NOTES_EN = ['5ml twice daily','5ml thrice daily','2.5ml twice daily','10ml twice daily','2 drops twice daily','2 drops thrice daily','1 teaspoon thrice daily','2 teaspoons twice daily','As directed','Apply thin layer twice daily']
const LIQUID_NOTES_MR = ['दिवसातून 2 वेळा 5ml','दिवसातून 3 वेळा 5ml','दिवसातून 2 वेळा 2.5ml','दिवसातून 2 वेळा 10ml','दिवसातून 2 वेळा 2 थेंब','दिवसातून 3 वेळा 2 थेंब','दिवसातून 3 वेळा 1 चमचा','दिवसातून 2 वेळा 2 चमचे','सांगितल्याप्रमाणे','दिवसातून 2 वेळा पातळ थर लावा']

const calcQty = (dosage, days, type='tablet') => {
  // Liquid/syrup/drops → qty always 1 bottle (editable)
  if (['liquid','drops','cream','inhaler','injection','powder','sachet'].includes(type)) return '1'
  const t=FREQ_MAP[dosage]
  // Extract number from days string like "7 days", "2 weeks"
  const d = days ? parseInt(String(days).match(/\d+/)?.[0]) : 0
  const multiplier = String(days).toLowerCase().includes('week') ? 7
    : String(days).toLowerCase().includes('month') ? 30
    : String(days).toLowerCase().includes('year') ? 365 : 1
  return (t && d) ? String(t * d * multiplier) : ''
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
function MedInput({ value, medicineId, onSelect, onTyped, medicines, rowIndex }) {
  const [q,setQ]       = useState(value||'')
  const [open,setOpen] = useState(false)
  const [foc,setFoc]   = useState(false)
  const ref            = useRef(null)
  const [pos,setPos]   = useState({top:0,left:0,width:0})

  // Keep local input in sync with parent (e.g. edit mode load)
  useEffect(()=>setQ(value||''),[value])

  const filtered = foc
    ? (q.length>=1 ? medicines.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())) : medicines).slice(0,14)
    : []

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
      {open && filtered.length > 0 && (
        <div style={{ position:'fixed',top:pos.top,left:pos.left,width:Math.max(pos.width+80,280),zIndex:9999 }}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-56 overflow-y-auto">
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
          {q.length>1 && !medicines.find(m=>m.name.toLowerCase()===q.toLowerCase()) && (
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

// ── Notes field with dropdown for liquids/non-tablets ─────
function NotesInput({ value, onChange, medicineType, printLang, savedNotes=[] }) {
  const [open,setOpen] = useState(false)
  const [q,setQ]       = useState('')
  const [pos,setPos]   = useState({top:0,left:0,width:0})
  const ref = useRef(null)
  const isNT = NON_TABLET.includes(medicineType)
  // Show liquid notes for non-tablets, general for tablets
  const baseOptions = isNT ? (printLang==='mr' ? LIQUID_NOTES_MR : LIQUID_NOTES_EN) : []
  // Merge with saved custom notes (including Marathi)
  const allOptions = [...new Set([...savedNotes, ...baseOptions])]
  const filtered = q ? allOptions.filter(n=>n.toLowerCase().includes(q.toLowerCase())) : allOptions

  const calc = () => {
    if (ref.current) {
      const r=ref.current.getBoundingClientRect()
      const ab=window.innerHeight-r.bottom<200&&r.top>200
      setPos({top:ab?r.top-200-2:r.bottom+2,left:r.left,width:r.width})
    }
  }
  return (
    <div className="relative">
      <input ref={ref}
        className="w-full h-8 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white"
        placeholder="Notes (optional)..."
        value={q || value || ''}
        onChange={e=>{setQ(e.target.value);calc();setOpen(true)}}
        onFocus={()=>{calc();setOpen(true)}}
        onBlur={()=>setTimeout(()=>{setOpen(false);if(q){onChange(q);setQ('')}},200)}
        onKeyDown={e=>{if(e.key==='Enter'&&q){onChange(q);setQ('');setOpen(false);e.preventDefault()}if(e.key==='Escape')setOpen(false)}}
      />
      {open && filtered.length > 0 && (
        <div style={{position:'fixed',top:pos.top,left:pos.left,width:Math.max(pos.width,200),zIndex:9999}}
          className="bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto">
          {filtered.map(note=>(
            <button key={note} type="button"
              onMouseDown={e=>{e.preventDefault();onChange(note);setQ('');setOpen(false)}}
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
  const relevant = (templates||[]).filter(t => {
    if (section==='complaint')  return t.complaint
    if (section==='diagnosis')  return t.diagnosis
    if (section==='medicines')  return t.medicines?.length > 0
    if (section==='labTests')   return t.labTests?.length > 0
    if (section==='advice')     return t.advice
    return false
  })
  if (relevant.length === 0) return null
  return (
    <div className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-1 text-xs text-primary font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100">
        <Zap className="w-3 h-3"/>Templates
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)}/>
          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-blue-100 z-50 max-h-72 overflow-y-auto">
            <div className="px-3 py-2 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            </div>
            {relevant.map(t=>(
              <button key={t.id} type="button" onClick={()=>{ onApply(t); setOpen(false) }}
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
            ))}
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

  const [medicines,   setMedicines]   = useState([])
  const [labTestList, setLabTestList] = useState([])
  const [complaints,  setComplaints]  = useState([])
  const [diagnoses,   setDiagnoses]   = useState([])
  const [adviceList,  setAdviceList]  = useState([])

  const [patient,    setPatient]    = useState(null)
  const [ptSearch,   setPtSearch]   = useState('')
  const [ptResults,  setPtResults]  = useState([])
  const [showPtDrop, setShowPtDrop] = useState(false)

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
  const lastUsed    = useRef({ dosage:'1-0-1', days:'5', timing:'' })
  const [rxTests,   setRxTests]   = useState([])
  const [rxAdvice,  setRxAdvice]  = useState([])
  const [nextVisit, setNextVisit] = useState('')
  const [printLang, setPrintLang] = useState('en')
  const [customRxNo,setCustomRxNo]= useState('')
  const [saving,    setSaving]    = useState(false)
  const [lastRx,    setLastRx]    = useState(null)
  const [doctorPrefs,  setDoctorPrefs]  = useState({})
  const [savedMedNotes, setSavedMedNotes] = useState([]) // all notes ever typed across medicines
  const [allTemplates, setAllTemplates] = useState([])
  const [pageDesign,   setPageDesign]   = useState(null)
  const [pdLoaded,     setPdLoaded]     = useState(false)
  // Auto-open vitals when rx_form config loads and showVitals is true
  useEffect(() => { if (pdLoaded && pageDesign?.showVitals === true) setShowVitals(true) }, [pdLoaded])
  // Before config loads: show all. After load: hide if explicitly set to false
  const showSection = (key) => !pdLoaded ? true : (pageDesign === null ? true : pageDesign[key] !== false)

  useEffect(() => {
    // Load sequentially in small groups to avoid overwhelming Render free tier
    const loadMaster = async () => {
      try {
        const [meds, labs] = await Promise.all([
          api.get('/master/medicines'),
          api.get('/master/lab-tests'),
        ])
        setMedicines(meds.data.data)
        setLabTestList(labs.data.data)
      } catch {}
      try {
        const [comp, diag] = await Promise.all([
          api.get('/master/complaints'),
          api.get('/master/diagnoses'),
        ])
        setComplaints(comp.data.data)
        setDiagnoses(diag.data.data)
      } catch {}
      try {
        const [adv, tmpl] = await Promise.all([
          api.get('/master/advice'),
          api.get('/templates'),
        ])
        setAdviceList(adv.data.data)
        setAllTemplates(tmpl.data.data)
      } catch {}
      try {
        const pd = await api.get('/page-design?type=rx_form')
        if (pd.data.data?.config) { setPageDesign(pd.data.data.config); setPdLoaded(true) }
        else setPdLoaded(true)
      } catch { setPdLoaded(true) }
      // Load doctor's medicine preferences last (non-critical)
      try {
        const prefs = await api.get('/prescriptions/doctor-preferences')
        setDoctorPrefs(prefs.data.data || {})
        // Load saved notes from localStorage
        const notes = JSON.parse(localStorage.getItem('pulsedesk_notes') || '[]')
        setSavedMedNotes(notes)
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
        dosage:m.dosage||'', days:m.days?String(m.days):'', timing:m.timing||'AF',
        qty:m.qty?String(m.qty):'', notesEn:m.notesEn||''
      })) : [{...emptyMed}])
      setRxTests(rx.labTests.map(t=>({ id:t.labTestId, name:t.labTestName })))
      setRxAdvice(rx.advice ? rx.advice.split('\n').filter(Boolean).map((a,i)=>({ id:'adv_'+i, name:a })) : [])
      setNextVisit(rx.nextVisit ? format(new Date(rx.nextVisit),'yyyy-MM-dd') : '')
      setPrintLang(rx.printLang||'en')
    }).catch(()=>navigate('/prescriptions'))
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

  const updateMed = (i, field, val) => {
    setRxMeds(prev => {
      const u=[...prev]; u[i]={...u[i],[field]:val}
      if(field==='dosage')lastUsed.current.dosage=val
      if(field==='days')lastUsed.current.days=val
      if(field==='timing')lastUsed.current.timing=val
      if(field==='notesEn'&&val?.trim()){setSavedMedNotes(prev=>{const updated=[...new Set([val,...prev])].slice(0,50);localStorage.setItem('pulsedesk_notes',JSON.stringify(updated));return updated})}
      if((field==='dosage'||field==='days')&&!NON_TABLET.includes(u[i].medicineType))
        u[i].qty=calcQty(field==='dosage'?val:u[i].dosage,field==='days'?val:u[i].days,u[i].medicineType||'tablet')
      return u
    })
  }

  const handleMedSelect = useCallback((med, rowIdx) => {
    setDirty()
    if (!med) return
    const isNT = NON_TABLET.includes(med.type)
    // Priority: doctor's personal preference > medicine default > last used
    const pref   = doctorPrefs[med.id] || {}
    const dosage = isNT ? '' : (pref.dosage || med.defaultDosage || lastUsed.current.dosage)
    const days   = pref.days ? String(pref.days) : (med.defaultDays ? String(med.defaultDays) : lastUsed.current.days)  // pref.days is raw number from DB
    const timing = pref.timing || med.defaultTiming || lastUsed.current.timing
    setRxMeds(prev => {
      const u=[...prev]
      u[rowIdx]={ ...u[rowIdx], medicineId:med.id, medicineName:med.name, medicineType:med.type, dosage, days, timing, notesEn:'', qty: isNT?'':calcQty(dosage,days) }
      if (rowIdx===u.length-1) u.push({...emptyMed})
      return u
    })
    if (!isNT&&med.defaultDosage) lastUsed.current.dosage=med.defaultDosage
    if (med.defaultDays) lastUsed.current.days=String(med.defaultDays)
    if (med.defaultTiming) lastUsed.current.timing=med.defaultTiming
    setTimeout(()=>{ const el=document.getElementById(`med-input-${rowIdx+1}`); if(el)el.focus() },60)
  }, [])

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
        medicineType: 'tablet',     // default type for manually typed medicines
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
    const val=lastUsed.current[field]; if(!val)return
    setRxMeds(prev=>prev.map(m=>{ const u={...m,[field]:val}; if((field==='dosage'||field==='days')&&!NON_TABLET.includes(m.medicineType))u.qty=calcQty(field==='dosage'?val:m.dosage,field==='days'?val:m.days); return u }))
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
        try { await api.post('/master/complaints', buildPayload(tag, 'complaint')) } catch {}
    }
    for (const tag of diagnosisTags) {
      if (!diagnoses.some(d=>d.nameEn?.toLowerCase()===tag.toLowerCase()))
        try { await api.post('/master/diagnoses', buildPayload(tag, 'diagnosis')) } catch {}
    }
    const savedTests=[]
    for (const t of rxTests) {
      if (t.isNew) {
        try { const{data}=await api.post('/master/lab-tests', buildPayload(t.name,'lab')); savedTests.push({id:data.data.id,name:t.name}) }
        catch { savedTests.push(t) }
      } else savedTests.push(t)
    }
    for (const a of rxAdvice) {
      if (a.isNew) try { await api.post('/master/advice', buildPayload(a.name,'advice')) } catch {}
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
      toast.success(`Template "${t.name}" loaded!`)
    }).catch(()=>toast.error('Failed to load template'))
  }

  // Save current form as template
  const handleSaveAsTemplate = async () => {
    const templateName = window.prompt('Template name:', complaintTags[0] || diagnosisTags[0] || '')
    if (!templateName?.trim()) return
    try {
      await api.post('/templates/save-as', {
        name:       templateName.trim(),
        complaint:  complaintTags.join(' || '),
        diagnosis:  diagnosisTags.join(' || '),
        advice:     rxAdvice.map(a=>a.name).join('\n'),
        labTests:   rxTests.filter(t=>!t.isNew).map(t=>t.name),
        medicines:  rxMeds.filter(m=>m.medicineId||m.medicineName).map(m=>({ medicineId:m.medicineId, medicineName:m.medicineName, medicineType:m.medicineType, dosage:m.dosage, days: m.days ? parseInt(String(m.days)) || m.days : null, timing:m.timing, notesEn:m.notesEn })),
      })
      toast.success(`Template "${templateName}" saved!`)
    } catch { toast.error('Failed to save template') }
  }

  const carryForward = () => {
    if (!lastRx) return
    setRxMeds(lastRx.medicines.map(m=>({medicineId:m.medicineId,medicineName:m.medicineName,medicineType:m.medicineType,dosage:m.dosage||'',days:m.days?String(m.days):'',timing:m.timing||'AF',qty:m.qty?String(m.qty):'',notesEn:''})))
    if (lastRx.complaint) setComplaintTags(lastRx.complaint.split('||').map(s=>s.trim()).filter(Boolean))
    if (lastRx.diagnosis) setDiagnosisTags(lastRx.diagnosis.split('||').map(s=>s.trim()).filter(Boolean))
    if (lastRx.advice)    setRxAdvice(lastRx.advice.split('\n').filter(Boolean).map((a,i)=>({id:'adv_'+i,name:a})))
    toast.success('Last prescription loaded!')
  }

  const handleSave = async () => {
    if (!patient) { toast.error('Please select a patient'); return }
    if (saving) return  // ✅ prevent double-click duplicate
    setSaving(true)
    try {
      const savedTests = await autoSaveToMaster()
      if (showVitals && Object.values(vitals).some(v=>v))
        await api.post(`/patients/${patient.id}/vitals`, vitals).catch(()=>{})
      const payload = {
        patientId:  patient.id,
        complaint:  complaintTags.join(' || '),
        diagnosis:  diagnosisTags.join(' || '),
        advice:     rxAdvice.map(a=>a.name).join('\n'),
        nextVisit:  nextVisit||null, printLang, customRxNo: customRxNo||null,
        medicines:  rxMeds.filter(m=>m.medicineId||m.medicineName),
        labTests:   savedTests.filter(t=>t.id&&!t.isNew).map(t=>({labTestId:t.id,labTestName:t.name})),
      }
      if (isEdit) {
        await api.put(`/prescriptions/${editId}`, payload)
        toast.success('Prescription updated!'); setDirty(false)
        navigate(`/prescriptions/${editId}`)
      } else {
        const {data} = await api.post('/prescriptions', payload)
        toast.success(`Prescription ${data.data.rxNo} saved!`)
        navigate(`/prescriptions/${data.data.id}`)
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
      {/* Header — no step numbers */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={()=>navigate('/prescriptions')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
        <div className="flex-1">
          <h1 className="page-title">{isEdit ? 'Edit Prescription' : 'New Prescription'}</h1>
          <p className="page-subtitle">{format(new Date(),'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="form-select w-36 text-sm" value={printLang} onChange={e=>setPrintLang(e.target.value)}>
            <option value="en">🇬🇧 English</option>
            <option value="hi">🇮🇳 Hindi</option>
            <option value="mr">🇮🇳 Marathi</option>
          </select>
          <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Patient */}
        <Card>
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
        </Card>

        {/* Vitals */}
        <div style={{display: showSection('showVitals') ? '' : 'none'}}><Card>
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
        <div style={{display: showSection('showComplaint') ? '' : 'none'}}><Card>
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
        <div style={{display: showSection('showDiagnosis') ? '' : 'none'}}><Card>
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
        <Card>
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
              <col style={{width:'26px'}}/><col style={{width:'200px'}}/><col style={{width:'108px'}}/>
              <col style={{width:'115px'}}/><col style={{width:'100px'}}/><col style={{width:'54px'}}/>
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
                    <span className="text-xs font-semibold text-slate-400 uppercase">Days</span>
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
                      <MedInput value={med.medicineName} medicineId={med.medicineId} onSelect={handleMedSelect} onTyped={handleMedTyped} medicines={medicines} rowIndex={idx}/>
                    </td>
                    <td className="py-1.5 px-1">
                      {isNT ? <div className="h-8 px-2 flex items-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100">N/A</div>
                        : <ColDrop value={med.dosage} options={DOSAGE_OPTS} placeholder="Select" onChange={v=>updateMed(idx,'dosage',v)}/>}
                    </td>
                    <td className="py-1.5 px-1">
                      <ColDrop value={med.timing} options={TIMING_OPTS} placeholder="When" onChange={v=>updateMed(idx,'timing',v)}/>
                    </td>
                    <td className="py-1.5 px-1">
                      <SmartDaysInput value={med.days} onChange={v=>updateMed(idx,'days',v)}/>
                    </td>
                    <td className="py-1.5 px-1">
                      {isNT ? <div className="h-8 flex items-center justify-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100">—</div>
                        : <input type="number" min="0" className="w-full h-8 px-1 text-sm text-center font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white" value={med.qty} onChange={e=>updateMed(idx,'qty',e.target.value)}/>}
                    </td>
                    {/* Notes — editable for ALL, dropdown options for liquids */}
                    <td className="py-1.5 px-1">
                      <NotesInput
                        value={med.notesEn}
                        onChange={v=>updateMed(idx,'notesEn',v)}
                        medicineType={med.medicineType}
                        printLang={printLang}
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
                    medicines={medicines} rowIndex={idx}/>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
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
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Days</p>
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
                      medicineType={med.medicineType} printLang={printLang} savedNotes={savedMedNotes}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow}
            className="mt-3 w-full border-2 border-dashed border-blue-100 rounded-xl py-2 text-sm text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4"/>Add Medicine Row
          </button>
        </Card>

        {/* Lab Tests */}
        <div style={{display: showSection('showLabTests') ? '' : 'none'}}><Card>
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
        <div style={{display: showSection('showAdvice') ? '' : 'none'}}><Card>
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

        {/* Settings */}
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

        <div className="flex flex-col sm:flex-row justify-between gap-3 pb-8">
          <Button variant="outline" icon={<BookOpen className="w-4 h-4"/>} onClick={handleSaveAsTemplate}>
            Save as Template
          </Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={()=>guardedAction(()=>navigate('/prescriptions'))}>Cancel</Button>
            <Button variant="primary" loading={saving} size="lg" icon={<Save className="w-5 h-5"/>} onClick={handleSave}>
              {isEdit ? 'Update Prescription' : 'Save Prescription'}
            </Button>
          </div>
        </div>
      </div>
    </div>
    <ConfirmDialog {...confirmProps} confirmLabel="Yes, Discard" cancelLabel="Keep Editing"/>
    </>
  )
}
