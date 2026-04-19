import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, X, ChevronDown } from 'lucide-react'
import { Button, Badge, Card } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const DOSAGE_OPTS = ['1-0-0','0-1-0','0-0-1','1-0-1','1-1-0','0-1-1','1-1-1','1-1-1-1','OD','BD','TDS','QID','HS','SOS','STAT']
const DAYS_OPTS   = ['1','2','3','5','7','10','14','15','21','30']
const TIMING_OPTS = [
  { code:'AF',label:'After Food' },{ code:'BF',label:'Before Food' },
  { code:'ES',label:'Empty Stomach' },{ code:'HS',label:'At Bedtime' },
  { code:'WM',label:'With Milk' },{ code:'WW',label:'With Water' },
  { code:'MO',label:'Morning Only' },{ code:'AN',label:'At Night' },
]
const NON_TABLET = ['liquid','drops','cream','inhaler','injection','powder']
const emptyMed   = { medicineId:'', medicineName:'', medicineType:'tablet', dosage:'', days:'', timing:'AF', notesEn:'' }

// Simple inline dropdown
function InlineDrop({ value, options, onChange, placeholder, disabled }) {
  const [open,setOpen] = useState(false)
  const lbl = options.find(o=>(o.code||o)===value); const disp = lbl?(lbl.label||lbl):(value||'')
  if (disabled) return <div className="h-8 px-2 flex items-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100 w-full">N/A</div>
  return (
    <div className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)}
        className={`w-full h-8 px-2 text-xs text-left rounded-lg border transition-all flex items-center justify-between ${value?'border-blue-200 bg-white text-slate-700 font-medium':'border-slate-200 bg-white text-slate-400'} hover:border-primary`}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}>
        <span className="truncate">{disp||<span className="text-slate-300">{placeholder}</span>}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-40"/>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-0.5 bg-white rounded-xl shadow-xl border border-blue-100 max-h-44 overflow-y-auto min-w-[130px] w-full">
          {options.map((opt,i)=>{ const code=opt.code||opt; const lbl=opt.label||opt; return(
            <button key={i} type="button" onMouseDown={e=>{e.preventDefault();onChange(code);setOpen(false)}}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${code===value?'bg-blue-50 text-primary font-bold':'text-slate-700'}`}>{lbl}</button>
          )})}
        </div>
      )}
    </div>
  )
}

// Med search input
function MedSearch({ value, onChange, medicines }) {
  const [q,setQ] = useState(value||''); const [open,setOpen] = useState(false)
  useEffect(()=>setQ(value||''),[value])
  const filtered = q.length>=1 ? medicines.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())).slice(0,10) : medicines.slice(0,10)
  const TC = { tablet:'bg-blue-50 text-blue-700',capsule:'bg-purple-50 text-purple-700',liquid:'bg-cyan-50 text-cyan-700',drops:'bg-green-50 text-green-700',cream:'bg-orange-50 text-orange-700',inhaler:'bg-indigo-50 text-indigo-700',injection:'bg-red-50 text-red-700',sachet:'bg-yellow-50 text-yellow-700' }
  return (
    <div className="relative">
      <input className="w-full h-8 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white"
        placeholder="Search medicine..." value={q} autoComplete="off"
        onChange={e=>{setQ(e.target.value);onChange({medicineName:e.target.value});setOpen(true)}}
        onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),200)}
        onKeyDown={e=>{if(e.key==='Enter'&&filtered.length>0){onChange(filtered[0]);setQ(filtered[0].name);setOpen(false)}}}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 w-72 mt-0.5 bg-white rounded-xl shadow-xl border border-blue-100 max-h-52 overflow-y-auto">
          {filtered.map(m=>(
            <button key={m.id} type="button" onMouseDown={e=>{e.preventDefault();onChange(m);setQ(m.name);setOpen(false)}}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b border-slate-50 last:border-0">
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TC[m.type]||'bg-slate-100 text-slate-600'}`}>{m.type}</span>
              <div className="min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{m.name}</p></div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Tag input
function TagInput({ tags, onAdd, onRemove, items, placeholder }) {
  const [q,setQ] = useState(''); const [open,setOpen] = useState(false); const ref = useRef(null)
  const filtered = q.length>=1 ? items.filter(i=>i.nameEn?.toLowerCase().includes(q.toLowerCase())&&!tags.includes(i.nameEn)).slice(0,8) : items.filter(i=>!tags.includes(i.nameEn)).slice(0,8)
  const add = (text) => { const v=text.trim(); if(v&&!tags.includes(v))onAdd(v); setQ('') }
  return (
    <div>
      {tags.length>0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag=>(
            <span key={tag} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-lg font-medium">
              {tag}<button type="button" onClick={()=>onRemove(tag)} className="hover:text-danger"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      )}
      <input ref={ref} className="form-input" placeholder={placeholder} value={q}
        onChange={e=>{setQ(e.target.value);setOpen(true)}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),180)}
        onKeyDown={e=>{if(e.key==='Enter'&&q.trim()){add(q);e.preventDefault()}if(e.key==='Escape')setOpen(false)}}
      />
      {open && (filtered.length>0||(q.trim()&&!items.find(i=>i.nameEn?.toLowerCase()===q.toLowerCase()))) && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto" style={{width:'100%',maxWidth:360}}>
          {filtered.map(item=>(<button key={item.id} type="button" onMouseDown={e=>{e.preventDefault();add(item.nameEn)}} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm font-medium text-slate-700">{item.nameEn}</button>))}
          {q.trim()&&!items.find(i=>i.nameEn?.toLowerCase()===q.toLowerCase())&&(<button type="button" onMouseDown={e=>{e.preventDefault();add(q)}} className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-success text-sm font-medium">+ Add "{q}"</button>)}
        </div>
      )}
    </div>
  )
}

// Lab/Advice tag search
function TagSearch({ tags, onAdd, onRemove, items, placeholder }) {
  const [q,setQ] = useState(''); const [open,setOpen] = useState(false)
  const nameOf = (i) => i.nameEn||i.name||''
  const filtered = q.length>=1 ? items.filter(i=>nameOf(i).toLowerCase().includes(q.toLowerCase())&&!tags.find(t=>t.id===i.id)).slice(0,10) : items.filter(i=>!tags.find(t=>t.id===i.id)).slice(0,10)
  return (
    <div>
      {tags.length>0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag=>(
            <span key={tag.id||tag.name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-primary text-xs px-2.5 py-1 rounded-lg font-medium">
              {tag.name}<button type="button" onClick={()=>onRemove(tag)} className="hover:text-danger"><X className="w-3 h-3"/></button>
            </span>
          ))}
        </div>
      )}
      <input className="form-input" placeholder={placeholder} value={q}
        onChange={e=>{setQ(e.target.value);setOpen(true)}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),180)}
        onKeyDown={e=>e.key==='Escape'&&setOpen(false)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-blue-100 max-h-48 overflow-y-auto" style={{width:'100%',maxWidth:360}}>
          {filtered.map(item=>(<button key={item.id} type="button" onMouseDown={e=>{e.preventDefault();onAdd(item);setQ('');setOpen(false)}} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0 text-sm font-medium text-slate-700">{nameOf(item)}</button>))}
        </div>
      )}
    </div>
  )
}

export default function TemplateEditorPage() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const isEdit   = !!id

  const [medicines,  setMedicines]  = useState([])
  const [labList,    setLabList]    = useState([])
  const [complaints, setComplaints] = useState([])
  const [diagnoses,  setDiagnoses]  = useState([])
  const [adviceList, setAdviceList] = useState([])

  const [name,           setName]           = useState('')
  const [complaintTags,  setComplaintTags]  = useState([])
  const [diagnosisTags,  setDiagnosisTags]  = useState([])
  const [meds,           setMeds]           = useState([{...emptyMed}])
  const [labTags,        setLabTags]        = useState([])
  const [adviceTags,     setAdviceTags]     = useState([])
  const [nextVisitDays,  setNextVisitDays]  = useState('')
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/master/medicines').then(r=>setMedicines(r.data.data)),
      api.get('/master/lab-tests').then(r=>setLabList(r.data.data)),
      api.get('/master/complaints').then(r=>setComplaints(r.data.data)),
      api.get('/master/diagnoses').then(r=>setDiagnoses(r.data.data)),
      api.get('/master/advice').then(r=>setAdviceList(r.data.data)),
    ])
    if (isEdit) {
      api.get(`/templates/${id}`).then(({data}) => {
        const t = data.data
        setName(t.name)
        setComplaintTags(t.complaint ? t.complaint.split('||').map(s=>s.trim()).filter(Boolean) : [])
        setDiagnosisTags(t.diagnosis ? t.diagnosis.split('||').map(s=>s.trim()).filter(Boolean) : [])
        setMeds(t.medicines.length > 0 ? t.medicines.map(m=>({
          medicineId: m.medicineId, medicineName:'', medicineType:'tablet',
          dosage: m.dosage||'', days: m.days?String(m.days):'', timing: m.timing||'AF', notesEn: m.notesEn||''
        })) : [{...emptyMed}])
        setLabTags(t.labTests?.map((name,i)=>({ id:'lab_'+i, name })) || [])
        setAdviceTags(t.advice ? t.advice.split('\n').filter(Boolean).map((a,i)=>({id:'adv_'+i,name:a})) : [])
        setNextVisitDays(t.nextVisit ? String(t.nextVisit) : '')

        // Load medicine names
        t.medicines.forEach((m, idx) => {
          api.get('/master/medicines').then(r => {
            const med = r.data.data.find(x=>x.id===m.medicineId)
            if (med) setMeds(prev => { const u=[...prev]; if(u[idx]) u[idx]={...u[idx],medicineName:med.name,medicineType:med.type}; return u })
          })
        })
      }).catch(()=>navigate('/templates'))
    }
  }, [id, isEdit])

  const updateMed = (i, field, val) => setMeds(prev=>{const u=[...prev];u[i]={...u[i],[field]:val};return u})
  const selectMed = (i, med) => {
    if (!med || !med.id) { updateMed(i,'medicineName',med?.medicineName||''); return }
    const isNT = NON_TABLET.includes(med.type)
    setMeds(prev=>{
      const u=[...prev]
      u[i]={ ...u[i], medicineId:med.id, medicineName:med.name, medicineType:med.type, dosage:isNT?'':(med.defaultDosage||'1-0-1'), days:med.defaultDays?String(med.defaultDays):'5', timing:med.defaultTiming||'AF', notesEn:'' }
      return u
    })
  }
  const addMedRow  = () => setMeds(p=>[...p,{...emptyMed}])
  const removeMed  = i => setMeds(p=>p.filter((_,idx)=>idx!==i))

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        complaint:  complaintTags.join(' || '),
        diagnosis:  diagnosisTags.join(' || '),
        advice:     adviceTags.map(a=>a.name).join('\n'),
        nextVisit:  nextVisitDays || null,
        labTests:   labTags.map(t=>t.name),
        medicines:  meds.filter(m=>m.medicineId).map(m=>({
          medicineId: m.medicineId,
          dosage:     m.dosage||null,
          days:       m.days||null,
          timing:     m.timing||null,
          notesEn:    m.notesEn||null,
        })),
      }
      if (isEdit) {
        await api.put(`/templates/${id}`, payload)
        toast.success('Template updated!')
      } else {
        await api.post('/templates', payload)
        toast.success('Template created!')
      }
      navigate('/templates')
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={()=>navigate('/templates')} className="btn-ghost btn-icon"><ArrowLeft className="w-5 h-5"/></button>
        <div className="flex-1">
          <h1 className="page-title">{isEdit ? 'Edit Template' : 'New Template'}</h1>
          <p className="page-subtitle">Define a reusable prescription template</p>
        </div>
        <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={handleSave}>
          {isEdit ? 'Update' : 'Save Template'}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Template Name</h3>
          <input className="form-input text-lg font-semibold" placeholder="e.g. Fever, Hypertension, Diabetes, Common Cold..."
            value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          <p className="text-xs text-slate-400 mt-1.5">Choose a clear name so doctors can quickly find and use this template</p>
        </Card>

        {/* Complaint */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Chief Complaint</h3>
          <div className="relative">
            <TagInput tags={complaintTags} onAdd={t=>setComplaintTags(p=>[...p,t])} onRemove={t=>setComplaintTags(p=>p.filter(x=>x!==t))} items={complaints} placeholder="Add complaint tags..."/>
          </div>
        </Card>

        {/* Diagnosis */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Diagnosis</h3>
          <div className="relative">
            <TagInput tags={diagnosisTags} onAdd={t=>setDiagnosisTags(p=>[...p,t])} onRemove={t=>setDiagnosisTags(p=>p.filter(x=>x!==t))} items={diagnoses} placeholder="Add diagnosis tags..."/>
          </div>
        </Card>

        {/* Medicines */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700">Medicines</h3>
            <Button variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5"/>} onClick={addMedRow}>Add Row</Button>
          </div>
          <table className="w-full" style={{tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'28px'}}/><col style={{width:'200px'}}/><col style={{width:'110px'}}/><col style={{width:'115px'}}/><col style={{width:'100px'}}/><col/><col style={{width:'28px'}}/>
            </colgroup>
            <thead>
              <tr className="border-b-2 border-blue-100">
                <th className="pb-2"></th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Medicine</th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Dosage</th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">When</th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Days</th>
                <th className="text-left pb-2 px-1 text-xs font-semibold text-slate-400 uppercase">Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {meds.map((med,idx)=>{
                const isNT = NON_TABLET.includes(med.medicineType)
                return (
                  <tr key={idx} className={med.medicineId?'bg-blue-50/20':''}>
                    <td className="py-1.5 pr-1"><span className="w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{idx+1}</span></td>
                    <td className="py-1.5 px-1"><MedSearch value={med.medicineName} onChange={m=>selectMed(idx,m)} medicines={medicines}/></td>
                    <td className="py-1.5 px-1">{isNT?<div className="h-8 px-2 flex items-center text-xs text-slate-300 bg-slate-50 rounded-lg border border-slate-100">N/A</div>:<InlineDrop value={med.dosage} options={DOSAGE_OPTS} placeholder="Dosage" onChange={v=>updateMed(idx,'dosage',v)}/>}</td>
                    <td className="py-1.5 px-1"><InlineDrop value={med.timing} options={TIMING_OPTS} placeholder="When" onChange={v=>updateMed(idx,'timing',v)}/></td>
                    <td className="py-1.5 px-1"><InlineDrop value={med.days} options={DAYS_OPTS.map(d=>({code:d,label:`${d}d`}))} placeholder="Days" onChange={v=>updateMed(idx,'days',v)}/></td>
                    <td className="py-1.5 px-1"><input className="w-full h-8 px-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white" placeholder="Notes..." value={med.notesEn} onChange={e=>updateMed(idx,'notesEn',e.target.value)}/></td>
                    <td className="py-1.5 pl-1"><button type="button" onClick={()=>removeMed(idx)} className="w-6 h-8 flex items-center justify-center text-slate-300 hover:text-danger rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button type="button" onClick={addMedRow} className="mt-3 w-full border-2 border-dashed border-blue-100 rounded-xl py-2 text-sm text-slate-400 hover:border-primary hover:text-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4"/>Add Medicine Row
          </button>
        </Card>

        {/* Lab Tests */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Lab Tests</h3>
          <div className="relative">
            <TagSearch tags={labTags} onAdd={t=>{ if(!labTags.find(x=>x.id===t.id))setLabTags(p=>[...p,t]) }} onRemove={t=>setLabTags(p=>p.filter(x=>x.id!==t.id))} items={labList} placeholder="Search and add lab tests..."/>
          </div>
        </Card>

        {/* Advice */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Advice & Precautions</h3>
          <div className="relative">
            <TagSearch tags={adviceTags} onAdd={t=>{ if(!adviceTags.find(x=>x.id===t.id))setAdviceTags(p=>[...p,t]) }} onRemove={t=>setAdviceTags(p=>p.filter(x=>x.id!==t.id))} items={adviceList.map(a=>({id:a.id,name:a.nameEn}))} placeholder="Search and add advice..."/>
          </div>
        </Card>

        {/* Next visit */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-3">Default Next Visit</h3>
          <div className="flex items-center gap-3">
            <input type="number" min="1" max="365" className="form-input w-24" placeholder="Days" value={nextVisitDays} onChange={e=>setNextVisitDays(e.target.value)}/>
            <span className="text-sm text-slate-500">days after prescription date</span>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="ghost" onClick={()=>navigate('/templates')}>Cancel</Button>
          <Button variant="primary" loading={saving} size="lg" icon={<Save className="w-5 h-5"/>} onClick={handleSave}>
            {isEdit ? 'Update Template' : 'Save Template'}
          </Button>
        </div>
      </div>
    </div>
  )
}
