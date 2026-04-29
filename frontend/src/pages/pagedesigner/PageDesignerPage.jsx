import { useEffect, useState } from 'react'
import { Save, RotateCcw, Eye, Printer, Receipt, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, Button, Badge, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'

// ── Toggle switch ─────────────────────────────────────────
function Toggle({ checked, onChange, label, sub, locked = false }) {
  // Locked toggles cannot be turned off — used for forced branding (watermark, footer credit, etc.)
  const effectiveChecked = locked ? true : checked
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          {label}
          {locked && (
            <span title="This setting is locked on by SimpleRx EMR" className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
              Locked
            </span>
          )}
        </p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <button type="button"
        onClick={() => { if (!locked) onChange(!checked) }}
        disabled={locked}
        title={locked ? 'This setting cannot be changed' : undefined}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4
          ${effectiveChecked ? 'bg-primary' : 'bg-slate-200'}
          ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
          ${effectiveChecked ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{transform: effectiveChecked?'translateX(18px)':'translateX(2px)'}}/>
      </button>
    </div>
  )
}

// ── Section container ─────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary"/>}
          <span className="font-bold text-slate-700">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  )
}

// ── Radio group ───────────────────────────────────────────
function RadioGroup({ label, value, onChange, options }) {
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0">
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${value === opt.value
                ? 'bg-primary text-white border-primary'
                : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary bg-white'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Color picker ──────────────────────────────────────────
function ColorPicker({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-2">
        <input type="color" value={value||'#1565C0'} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"/>
        <span className="text-xs text-slate-400 font-mono">{value||'#1565C0'}</span>
      </div>
    </div>
  )
}

// ── Default configs ───────────────────────────────────────
const DEFAULT_RX = {
  paperSize:'A4', showClinicName:true, showClinicAddress:true, showClinicPhone:true,
  showClinicTagline:true, showDoctorName:true, showDoctorQual:true, showDoctorSpec:true,
  showDoctorRegNo:true, headerBorder:true, headerColor:'#1565C0',
  showPatient:true, showAge:true, showGender:true, showAllergy:true,
  showComplaint:true, showDiagnosis:true, showMedicines:true, showLabTests:true,
  showLabResults:true, showAdvice:true, showNextVisit:true, showVitals:false,
  showDosage:true, showWhen:true, showDays:true, showQty:true, showNotes:true,
  fontFamily:'default', baseFontSize:'md', medicineNameBold:true,
  showSignature:true, showGeneratedBy:true, showRxSymbol:true,
  primaryColor:'#1565C0', showRxNo:true,
}
const DEFAULT_BILL = {
  paperSize:'A4', showClinicName:true, showClinicAddress:true, showClinicPhone:true,
  showDoctorName:true, showPatient:true, showAge:true, showGender:true,
  showBillNo:true, showDate:true, showItemName:true, showQty:true,
  showRate:true, showAmount:true, showSubtotal:true, showDiscount:true,
  showTotal:true, showPaymentMode:true, showBalance:true, showNotes:true,
  showSignature:false, headerColor:'#1565C0', primaryColor:'#1565C0',
  baseFontSize:'md', fontFamily:'default', thankYouMessage:'Thank you for visiting!',
}

export default function PageDesignerPage() {
  const { user }  = useAuthStore()
  const [tab,     setTab]     = useState('prescription')
  const [rxCfg,   setRxCfg]  = useState({ ...DEFAULT_RX })
  const [billCfg, setBillCfg]= useState({ ...DEFAULT_BILL })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const cfg    = tab === 'prescription' ? rxCfg    : billCfg
  const setCfg = tab === 'prescription' ? setRxCfg : setBillCfg
  const set    = (key, val) => setCfg(p => ({ ...p, [key]: val }))

  useEffect(() => {
    // Load prescription design
    api.get('/page-design?type=prescription').then(({ data }) => {
      if (data.data?.config) setRxCfg(c => ({ ...DEFAULT_RX, ...data.data.config }))
    }).catch(() => {})
    // Load bill design
    api.get('/page-design?type=bill').then(({ data }) => {
      if (data.data?.config) setBillCfg(c => ({ ...DEFAULT_BILL, ...data.data.config }))
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/page-design', { type: tab, config: cfg })
      setSaved(true)
      toast.success(`${tab === 'prescription' ? 'Prescription' : 'Bill'} layout saved!`)
      setTimeout(() => setSaved(false), 2000)
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  const handleReset = async () => {
    if (!window.confirm('Reset to default settings?')) return
    try {
      await api.delete(`/page-design/reset?type=${tab}`)
      if (tab === 'prescription') setRxCfg({ ...DEFAULT_RX })
      else setBillCfg({ ...DEFAULT_BILL })
      toast.success('Reset to defaults!')
    } catch { toast.error('Failed to reset') }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Page Designer" subtitle="Customize how prescriptions and bills look when printed"/>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        {[
          { key:'prescription', label:'Prescription Print', icon: Printer },
          { key:'bill',         label:'Bill / Receipt',     icon: Receipt },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Settings panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Paper & Typography */}
          <Section title="Paper & Typography">
            <RadioGroup label="Paper Size" value={cfg.paperSize} onChange={v => set('paperSize', v)}
              options={[{value:'A4',label:'A4'},{value:'A5',label:'A5'},{value:'half',label:'Half Page'}]}/>
            <RadioGroup label="Font Size" value={cfg.baseFontSize} onChange={v => set('baseFontSize', v)}
              options={[{value:'sm',label:'Small'},{value:'md',label:'Medium'},{value:'lg',label:'Large'}]}/>
            <RadioGroup label="Font Style" value={cfg.fontFamily} onChange={v => set('fontFamily', v)}
              options={[{value:'default',label:'Sans-serif (Default)'},{value:'serif',label:'Serif'},{value:'mono',label:'Monospace'}]}/>
            <ColorPicker label="Primary / Header Color" value={cfg.primaryColor||cfg.headerColor} onChange={v => { set('primaryColor', v); set('headerColor', v) }}/>
          </Section>

          {/* Clinic Header */}
          <Section title="Clinic Header">
            <Toggle checked={cfg.showClinicName}    onChange={v=>set('showClinicName',v)}    label="Clinic Name"/>
            <Toggle checked={cfg.showClinicTagline} onChange={v=>set('showClinicTagline',v)} label="Tagline / Motto"/>
            <Toggle checked={cfg.showClinicAddress} onChange={v=>set('showClinicAddress',v)} label="Address"/>
            <Toggle checked={cfg.showClinicPhone}   onChange={v=>set('showClinicPhone',v)}   label="Phone Number"/>
            <Toggle checked={cfg.headerBorder}      onChange={v=>set('headerBorder',v)}      label="Header Border Line"/>
          </Section>

          {/* Doctor Info */}
          <Section title="Doctor Information">
            <Toggle checked={cfg.showDoctorName}    onChange={v=>set('showDoctorName',v)}  label="Doctor Name"/>
            <Toggle checked={cfg.showDoctorQual}    onChange={v=>set('showDoctorQual',v)}  label="Qualification" sub="e.g. MBBS, MD"/>
            <Toggle checked={cfg.showDoctorSpec}    onChange={v=>set('showDoctorSpec',v)}  label="Specialization"/>
            <Toggle checked={cfg.showDoctorRegNo}   onChange={v=>set('showDoctorRegNo',v)} label="Registration Number"/>
          </Section>

          {/* Patient Section */}
          <Section title="Patient Details">
            <Toggle checked={cfg.showPatient}  onChange={v=>set('showPatient',v)}  label="Patient Name"/>
            <Toggle checked={cfg.showAge}      onChange={v=>set('showAge',v)}      label="Age"/>
            <Toggle checked={cfg.showGender}   onChange={v=>set('showGender',v)}   label="Gender"/>
            <Toggle checked={cfg.showAllergy}  onChange={v=>set('showAllergy',v)}  label="Allergy Warning"/>
            <Toggle checked={cfg.showRxNo}     onChange={v=>set('showRxNo',v)}     label="Rx Number"/>
          </Section>

          {/* Prescription fields — only for Rx */}
          {tab === 'prescription' && (
            <>
              <Section title="Print — Prescription Sections">
              <p className="text-xs text-slate-400 mb-3 bg-blue-50 px-3 py-2 rounded-lg">These control what appears on the <strong>printed prescription</strong>. To control what shows on the prescription form while writing, go to <strong>Clinic Setup → Prescription Form</strong>.</p>
                <Toggle checked={cfg.showComplaint}  onChange={v=>set('showComplaint',v)}  label="Chief Complaint"/>
                <Toggle checked={cfg.showDiagnosis}  onChange={v=>set('showDiagnosis',v)}  label="Diagnosis"/>
                <Toggle checked={cfg.showVitals}     onChange={v=>set('showVitals',v)}     label="Vitals" sub="BP, Sugar, Weight etc."/>
                <Toggle checked={cfg.showMedicines}  onChange={v=>set('showMedicines',v)}  label="Medicines Table"/>
                <Toggle checked={cfg.showLabTests}   onChange={v=>set('showLabTests',v)}   label="Lab Tests"/>
                <Toggle checked={cfg.showLabResults} onChange={v=>set('showLabResults',v)} label="Test Outcomes" sub="Recorded values for ordered tests, with date columns"/>
                <Toggle checked={cfg.showAdvice}     onChange={v=>set('showAdvice',v)}     label="Advice & Precautions"/>
                <Toggle checked={cfg.showNextVisit}  onChange={v=>set('showNextVisit',v)}  label="Next Visit Date"/>
              </Section>

              <Section title="Medicine Table Columns">
                <Toggle checked={cfg.showDosage}         onChange={v=>set('showDosage',v)}         label="Dosage" sub="e.g. 1-0-1"/>
                <Toggle checked={cfg.showWhen}           onChange={v=>set('showWhen',v)}           label="When / Timing" sub="After Food, Before Food etc."/>
                <Toggle checked={cfg.showDays}           onChange={v=>set('showDays',v)}           label="Days"/>
                <Toggle checked={cfg.showQty}            onChange={v=>set('showQty',v)}            label="Quantity"/>
                <Toggle checked={cfg.showNotes}          onChange={v=>set('showNotes',v)}          label="Notes" sub="Instructions below medicine name"/>
                <Toggle checked={cfg.showRxSymbol}       onChange={v=>set('showRxSymbol',v)}       label="℞ Symbol"/>
                <Toggle checked={cfg.medicineNameBold}   onChange={v=>set('medicineNameBold',v)}   label="Bold Medicine Names"/>
              </Section>
            </>
          )}

          {/* Bill fields — only for bill */}
          {tab === 'bill' && (
            <Section title="Bill Sections">
              <Toggle checked={cfg.showBillNo}      onChange={v=>set('showBillNo',v)}      label="Bill Number"/>
              <Toggle checked={cfg.showDate}        onChange={v=>set('showDate',v)}        label="Date"/>
              <Toggle checked={cfg.showItemName}    onChange={v=>set('showItemName',v)}    label="Item Name"/>
              <Toggle checked={cfg.showQty}         onChange={v=>set('showQty',v)}         label="Quantity"/>
              <Toggle checked={cfg.showRate}        onChange={v=>set('showRate',v)}        label="Rate"/>
              <Toggle checked={cfg.showAmount}      onChange={v=>set('showAmount',v)}      label="Amount"/>
              <Toggle checked={cfg.showSubtotal}    onChange={v=>set('showSubtotal',v)}    label="Subtotal"/>
              <Toggle checked={cfg.showDiscount}    onChange={v=>set('showDiscount',v)}    label="Discount"/>
              <Toggle checked={cfg.showTotal}       onChange={v=>set('showTotal',v)}       label="Total"/>
              <Toggle checked={cfg.showPaymentMode} onChange={v=>set('showPaymentMode',v)} label="Payment Mode"/>
              <Toggle checked={cfg.showBalance}     onChange={v=>set('showBalance',v)}     label="Balance Due"/>
              <Toggle checked={cfg.showNotes}       onChange={v=>set('showNotes',v)}       label="Payment Notes"/>
              <div className="py-2.5 border-b border-slate-50">
                <p className="text-sm font-medium text-slate-700 mb-1.5">Thank You Message</p>
                <input className="form-input text-sm" placeholder="e.g. Thank you for visiting!"
                  value={cfg.thankYouMessage||''} onChange={e=>set('thankYouMessage',e.target.value)}/>
              </div>
            </Section>
          )}

          {/* Footer */}
          <Section title="Footer">
            <Toggle checked={cfg.showSignature}   onChange={v=>set('showSignature',v)}   label="Doctor Signature Line"/>
            <Toggle checked={true} onChange={()=>{}} locked label="Generated by SimpleRx EMR" sub="Footer timestamp — always shown"/>
          </Section>

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-2 pb-8">
            <Button variant="ghost" icon={<RotateCcw className="w-4 h-4"/>} onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button variant="primary" size="lg" loading={saving}
              icon={saved ? <Check className="w-5 h-5"/> : <Save className="w-5 h-5"/>}
              onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Layout'}
            </Button>
          </div>
        </div>

        {/* ── Live preview panel ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5"/>Live Preview
            </p>
            <div className={`bg-white rounded-xl border-2 border-blue-100 overflow-hidden shadow-card
              ${cfg.baseFontSize==='sm' ? 'text-xs' : cfg.baseFontSize==='lg' ? 'text-sm' : 'text-xs'}`}
              style={{ fontFamily: cfg.fontFamily==='serif' ? 'Georgia,serif' : cfg.fontFamily==='mono' ? 'monospace' : 'inherit' }}>

              {/* Preview header */}
              <div className={`p-3 ${cfg.headerBorder!==false ? 'border-b-2' : ''}`}
                style={{ borderColor: cfg.primaryColor||cfg.headerColor||'#1565C0' }}>
                <div className="flex justify-between items-start">
                  <div>
                    {cfg.showClinicName    && <p className="font-bold text-sm" style={{color:cfg.primaryColor||'#1565C0'}}>Sharma Medical Clinic</p>}
                    {cfg.showClinicTagline && <p className="text-xs text-slate-500 italic">Your Health, Our Priority</p>}
                    {cfg.showClinicAddress && <p className="text-xs text-slate-400">123 Main Street, Pune</p>}
                    {cfg.showClinicPhone   && <p className="text-xs text-slate-400">📞 9876543210</p>}
                  </div>
                  <div className="text-right">
                    {cfg.showDoctorName   && <p className="font-bold text-xs">Dr. Rajesh Sharma</p>}
                    {cfg.showDoctorQual   && <p className="text-xs text-slate-500">MBBS, MD</p>}
                    {cfg.showDoctorSpec   && <p className="text-xs text-slate-500">General Physician</p>}
                    {cfg.showDoctorRegNo  && <p className="text-xs text-slate-400">Reg: MH-12345</p>}
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                {/* Patient */}
                {cfg.showPatient && (
                  <div className="border-b border-slate-200 pb-2 text-xs flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold tracking-wide">MH0001</span>
                    <span className="font-semibold">
                      Suraj Dingane
                      {(cfg.showAge || cfg.showGender) && (
                        <span className="font-normal text-slate-700">
                          {' '}({[
                            cfg.showAge    && '33 yrs',
                            cfg.showGender && 'Male',
                          ].filter(Boolean).join(', ')})
                        </span>
                      )}
                      <span className="text-slate-700"> - 9876543210</span>
                    </span>
                    <span className="ml-auto text-slate-500" style={{fontSize:'9px'}}>Date: 25-Apr-2026</span>
                  </div>
                )}

                {/* Complaint / Diagnosis */}
                {tab === 'prescription' && (
                  <div className="grid grid-cols-2 gap-2">
                    {cfg.showComplaint && <div><p className="text-xs text-slate-400 uppercase tracking-wide" style={{fontSize:'9px'}}>COMPLAINT</p><p className="text-xs font-medium">Fever</p></div>}
                    {cfg.showDiagnosis && <div><p className="text-xs text-slate-400 uppercase tracking-wide" style={{fontSize:'9px'}}>DIAGNOSIS</p><p className="text-xs font-medium">Viral Fever</p></div>}
                  </div>
                )}

                {/* Medicines */}
                {(tab==='prescription'?cfg.showMedicines:cfg.showItemName) && (
                  <div>
                    {tab==='prescription' && cfg.showRxSymbol && (
                      <p className="font-bold text-sm italic" style={{color:cfg.primaryColor||'#1565C0'}}>℞ MEDICINES</p>
                    )}
                    <table className="w-full" style={{fontSize:'9px'}}>
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-1 text-slate-400">{tab==='prescription'?'MEDICINE':'ITEM'}</th>
                          {tab==='prescription' && cfg.showDosage && <th className="text-center py-1 text-slate-400">DOSAGE</th>}
                          {tab==='prescription' && cfg.showWhen   && <th className="text-center py-1 text-slate-400">WHEN</th>}
                          {tab==='prescription' && cfg.showDays   && <th className="text-center py-1 text-slate-400">DAYS</th>}
                          {(tab==='bill'?cfg.showQty:cfg.showQty) && <th className="text-center py-1 text-slate-400">QTY</th>}
                          {tab==='bill' && cfg.showRate   && <th className="text-right py-1 text-slate-400">RATE</th>}
                          {tab==='bill' && cfg.showAmount && <th className="text-right py-1 text-slate-400">AMT</th>}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-50">
                          <td className={`py-1 ${cfg.medicineNameBold?'font-semibold':''}`}>
                            {tab==='prescription'?'Paracetamol 500mg':'Consultation'}
                          </td>
                          {tab==='prescription' && cfg.showDosage && <td className="text-center">1-0-1</td>}
                          {tab==='prescription' && cfg.showWhen   && <td className="text-center">After Food</td>}
                          {tab==='prescription' && cfg.showDays   && <td className="text-center">3d</td>}
                          {cfg.showQty && <td className="text-center font-bold" style={{color:cfg.primaryColor||'#1565C0'}}>{tab==='bill'?'1':'6'}</td>}
                          {tab==='bill' && cfg.showRate   && <td className="text-right">₹300</td>}
                          {tab==='bill' && cfg.showAmount && <td className="text-right font-bold">₹300</td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Bill totals */}
                {tab === 'bill' && (
                  <div className="text-right space-y-0.5" style={{fontSize:'9px'}}>
                    {cfg.showSubtotal && <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>₹300</span></div>}
                    {cfg.showDiscount && <div className="flex justify-between"><span className="text-slate-400">Discount</span><span>₹0</span></div>}
                    {cfg.showTotal    && <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>Total</span><span>₹300</span></div>}
                    {cfg.showPaymentMode && <div className="flex justify-between"><span className="text-slate-400">Payment</span><span>Cash</span></div>}
                    {cfg.thankYouMessage && <p className="text-center text-slate-400 italic pt-1">{cfg.thankYouMessage}</p>}
                  </div>
                )}

                {/* Lab Tests */}
                {tab==='prescription' && cfg.showLabTests && (
                  <div style={{fontSize:'9px'}}>
                    <p className="text-slate-400 uppercase tracking-wide mb-1">LAB TESTS</p>
                    <div className="flex gap-1 flex-wrap">
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">CBC</span>
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs">BSF</span>
                    </div>
                  </div>
                )}

                {/* Advice */}
                {tab==='prescription' && cfg.showAdvice && (
                  <div className="bg-amber-50 rounded p-1.5" style={{fontSize:'9px'}}>
                    <p className="font-semibold text-amber-700 uppercase tracking-wide mb-0.5">ADVICE</p>
                    <p className="text-slate-600">• Drink plenty of water</p>
                  </div>
                )}

                {/* Next Visit */}
                {tab==='prescription' && cfg.showNextVisit && (
                  <p style={{fontSize:'9px',color:cfg.primaryColor||'#1565C0'}} className="font-semibold">
                    📅 Next Visit: 27 Apr 2026
                  </p>
                )}

                {/* Footer */}
                <div className="border-t border-slate-100 pt-2 flex justify-between items-end">
                  <p className="text-slate-300" style={{fontSize:'8px'}}>Generated by SimpleRx EMR</p>
                  {cfg.showSignature   && (
                    <div className="text-right">
                      <div className="border-b border-slate-300 w-16 mb-0.5"/>
                      <p className="text-slate-500" style={{fontSize:'8px'}}>Signature</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Paper', value: cfg.paperSize },
                { label: 'Font',  value: cfg.baseFontSize==='sm'?'Small':cfg.baseFontSize==='lg'?'Large':'Medium' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-blue-50 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="font-bold text-sm text-slate-700">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
