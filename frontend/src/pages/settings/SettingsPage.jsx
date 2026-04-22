import { useEffect, useState } from 'react'
import {
  Save, RotateCcw, Eye, Check, ChevronDown, ChevronUp,
  Building2, FileText, Printer, Receipt,
} from 'lucide-react'
import { Card, Button, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { setGlobalDirty } from '../../hooks/useUnsavedChanges'

// ─── Shared UI Primitives ─────────────────────────────────
function Toggle({ checked, onChange, label, sub }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4
          ${checked ? 'bg-primary' : 'bg-slate-200'}`}>
        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}/>
      </button>
    </div>
  )
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }) {
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

function ColorPicker({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#1565C0'} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"/>
        <span className="text-xs text-slate-400 font-mono">{value || '#1565C0'}</span>
      </div>
    </div>
  )
}

// ─── Defaults ─────────────────────────────────────────────
const DEFAULT_RX_FORM = {
  showComplaint: true, showDiagnosis: true, showVitals: false, showMedicines: true,
  showLabTests: true, showAdvice: true, showNextVisit: true,
  vitalBP: true, vitalSugar: true, vitalWeight: true, vitalTemp: true,
  vitalSpo2: true, vitalPulse: true, vitalHeight: false, vitalBMI: false,
}

const DEFAULT_RX_PRINT = {
  paperSize: 'A4', showClinicName: true, showClinicAddress: true, showClinicPhone: true,
  showClinicTagline: true, showDoctorName: true, showDoctorQual: true, showDoctorSpec: true,
  showDoctorRegNo: true, headerBorder: true, headerColor: '#1565C0',
  showPatient: true, showAge: true, showGender: true, showAllergy: true,
  showComplaint: true, showDiagnosis: true, showMedicines: true, showLabTests: true,
  showAdvice: true, showNextVisit: true, showVitals: false,
  showDosage: true, showWhen: true, showFrequency: true, showDays: true, showQty: true, showNotes: true,
  fontFamily: 'default', baseFontSize: 'md', medicineNameBold: true,
  showSignature: true, showGeneratedBy: true, showRxSymbol: true,
  primaryColor: '#1565C0', showRxNo: true,
}

const DEFAULT_BILL_PRINT = {
  paperSize: 'A4', showClinicName: true, showClinicAddress: true, showClinicPhone: true,
  showDoctorName: true, showPatient: true, showAge: true, showGender: true,
  showBillNo: true, showDate: true, showItemName: true, showQty: true,
  showRate: true, showAmount: true, showSubtotal: true, showDiscount: true,
  showTotal: true, showPaymentMode: true, showBalance: true, showNotes: true,
  showSignature: false, headerColor: '#1565C0', primaryColor: '#1565C0',
  baseFontSize: 'md', fontFamily: 'default', thankYouMessage: 'Thank you for visiting!',
}

const TABS = [
  { key: 'clinic',    label: 'Clinic Info',        icon: Building2 },
  { key: 'rxform',    label: 'Prescription Form',  icon: FileText  },
  { key: 'rxprint',   label: 'Prescription Print', icon: Printer   },
  { key: 'billprint', label: 'Bill / Receipt',     icon: Receipt   },
]

// ═══════════════════════════════════════════════════════════
//  Main Settings Page
// ═══════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic')
  const [fetching,  setFetching]  = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Clinic info state
  const [clinic, setClinic] = useState({
    name: '', address: '', phone: '', mobile: '',
    email: '', tagline: '', gst: '', opdSeriesPrefix: '',
  })

  // Three separate page-design configs (by `type` param)
  const [rxForm,    setRxForm]    = useState({ ...DEFAULT_RX_FORM })
  const [rxPrint,   setRxPrint]   = useState({ ...DEFAULT_RX_PRINT })
  const [billPrint, setBillPrint] = useState({ ...DEFAULT_BILL_PRINT })

  // ─── Load all data on mount ───
  useEffect(() => {
    Promise.all([
      api.get('/clinics/me'),
      api.get('/page-design?type=rx_form').catch(() => ({ data: { data: null } })),
      api.get('/page-design?type=prescription').catch(() => ({ data: { data: null } })),
      api.get('/page-design?type=bill').catch(() => ({ data: { data: null } })),
    ]).then(([clinicRes, rxFormRes, rxPrintRes, billRes]) => {
      const c = clinicRes.data.data
      setClinic({
        name:            c.name || '',
        address:         c.address || '',
        phone:           c.phone || '',
        mobile:          c.mobile || '',
        email:           c.email || '',
        tagline:         c.tagline || '',
        gst:             c.gst || '',
        opdSeriesPrefix: c.opdSeriesPrefix || '',
      })
      if (rxFormRes.data.data?.config)  setRxForm(f   => ({ ...f,                ...rxFormRes.data.data.config }))
      if (rxPrintRes.data.data?.config) setRxPrint(c  => ({ ...DEFAULT_RX_PRINT,  ...rxPrintRes.data.data.config }))
      if (billRes.data.data?.config)    setBillPrint(c=> ({ ...DEFAULT_BILL_PRINT, ...billRes.data.data.config }))
    }).catch(() => toast.error('Failed to load settings')).finally(() => setFetching(false))
  }, [])

  // ─── Save handlers ───
  const setClinicField = (k) => (e) => { setClinic(f => ({ ...f, [k]: e.target.value })); setGlobalDirty(true) }

  const saveClinicInfo = async (e) => {
    e?.preventDefault()
    setSaving(true)
    try {
      await api.put('/clinics/me', clinic)
      toast.success('Clinic info updated!')
      setGlobalDirty(false)
      flashSaved()
    } catch { toast.error('Failed to save clinic info') }
    finally { setSaving(false) }
  }

  const saveRxForm = async () => {
    setSaving(true)
    try {
      const existing = await api.get('/page-design?type=rx_form').catch(() => ({ data: { data: { config: {} } } }))
      const merged = { ...(existing.data.data?.config || {}), ...rxForm }
      await api.post('/page-design', { type: 'rx_form', config: merged })
      toast.success('Prescription form settings saved!')
      setGlobalDirty(false)
      flashSaved()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const savePrintDesign = async (type) => {
    const cfg = type === 'prescription' ? rxPrint : billPrint
    setSaving(true)
    try {
      await api.post('/page-design', { type, config: cfg })
      toast.success(`${type === 'prescription' ? 'Prescription' : 'Bill'} layout saved!`)
      setGlobalDirty(false)
      flashSaved()
    } catch { toast.error('Failed to save layout') }
    finally { setSaving(false) }
  }

  const resetPrintDesign = async (type) => {
    if (!window.confirm('Reset to default settings? This cannot be undone.')) return
    try {
      await api.delete(`/page-design/reset?type=${type}`)
      if (type === 'prescription') setRxPrint({ ...DEFAULT_RX_PRINT })
      else                          setBillPrint({ ...DEFAULT_BILL_PRINT })
      toast.success('Reset to defaults!')
    } catch { toast.error('Failed to reset') }
  }

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner text-primary w-8 h-8"/>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader title="Settings" subtitle="Clinic info, prescription form, and print layouts"/>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-100 pb-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap
              ${activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 1 — Clinic Info                                   */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'clinic' && (
        <form onSubmit={saveClinicInfo}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Basic Information">
              <div className="form-group">
                <label className="form-label">Clinic Name *</label>
                <input className="form-input" placeholder="e.g. Sharma Medical Clinic"
                  value={clinic.name} onChange={setClinicField('name')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Tagline</label>
                <input className="form-input" placeholder="e.g. Your Health, Our Priority"
                  value={clinic.tagline} onChange={setClinicField('tagline')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="Full clinic address"
                  value={clinic.address} onChange={setClinicField('address')}/>
              </div>
              <div className="form-group">
                <label className="form-label">GST Number</label>
                <input className="form-input" placeholder="e.g. 27AABCS1429B1Z1"
                  value={clinic.gst} onChange={setClinicField('gst')}/>
              </div>
              <div className="form-group">
                <label className="form-label">OPD Series Prefix</label>
                <input className="form-input font-mono" placeholder="e.g. MH, JK or MH1000"
                  value={clinic.opdSeriesPrefix || ''} onChange={setClinicField('opdSeriesPrefix')}/>
                <p className="text-xs text-slate-400 mt-1">
                  Patient codes: <strong className="font-mono">{clinic.opdSeriesPrefix || 'SHA'}0001</strong>, <strong className="font-mono">{clinic.opdSeriesPrefix || 'SHA'}0002</strong>…
                </p>
              </div>
            </Card>

            <Card title="Contact Details">
              <div className="form-group">
                <label className="form-label">Landline</label>
                <input className="form-input" placeholder="e.g. 020-27654321"
                  value={clinic.phone} onChange={setClinicField('phone')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Mobile *</label>
                <input type="tel" className="form-input" placeholder="e.g. 9876543210"
                  value={clinic.mobile} onChange={setClinicField('mobile')}/>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" placeholder="clinic@email.com"
                  value={clinic.email} onChange={setClinicField('email')}/>
              </div>
              <div className="mt-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-primary mb-1">Tip</p>
                <p className="text-xs text-slate-500">These details appear on prescription and bill headers.</p>
              </div>
            </Card>
          </div>
          <div className="flex justify-end mt-6">
            <Button type="submit" variant="primary" loading={saving}
              icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}>
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 2 — Prescription Form                             */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'rxform' && (
        <div className="max-w-2xl space-y-5">
          <Card title="Prescription Sections" subtitle="Choose which sections appear while writing a prescription">
            <Toggle checked={rxForm.showComplaint}  onChange={v => { setRxForm(f => ({ ...f, showComplaint: v }));  setGlobalDirty(true) }} label="Chief Complaint"     sub="Patient's main complaints"/>
            <Toggle checked={rxForm.showDiagnosis}  onChange={v => { setRxForm(f => ({ ...f, showDiagnosis: v }));  setGlobalDirty(true) }} label="Diagnosis"           sub="Clinical diagnosis"/>
            <Toggle checked={rxForm.showVitals}     onChange={v => { setRxForm(f => ({ ...f, showVitals: v }));     setGlobalDirty(true) }} label="Vitals"              sub="BP, Sugar, Weight, Temp, SpO2, Pulse"/>
            <Toggle checked={rxForm.showMedicines}  onChange={v => { setRxForm(f => ({ ...f, showMedicines: v }));  setGlobalDirty(true) }} label="Medicines"           sub="Prescription medicines table"/>
            <Toggle checked={rxForm.showLabTests}   onChange={v => { setRxForm(f => ({ ...f, showLabTests: v }));   setGlobalDirty(true) }} label="Lab Tests"           sub="Diagnostic tests"/>
            <Toggle checked={rxForm.showAdvice}     onChange={v => { setRxForm(f => ({ ...f, showAdvice: v }));     setGlobalDirty(true) }} label="Advice & Precautions" sub="Instructions to patient"/>
            <Toggle checked={rxForm.showNextVisit}  onChange={v => { setRxForm(f => ({ ...f, showNextVisit: v }));  setGlobalDirty(true) }} label="Next Visit Date"     sub="Follow-up date"/>
          </Card>

          {rxForm.showVitals && (
            <Card title="Vitals Fields" subtitle="Choose which vital parameters to record">
              <Toggle checked={rxForm.vitalBP     ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalBP: v }));     setGlobalDirty(true) }} label="Blood Pressure" sub="Systolic / Diastolic"/>
              <Toggle checked={rxForm.vitalSugar  ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalSugar: v }));  setGlobalDirty(true) }} label="Blood Sugar"    sub="mg/dL"/>
              <Toggle checked={rxForm.vitalWeight ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalWeight: v })); setGlobalDirty(true) }} label="Weight"         sub="kg"/>
              <Toggle checked={rxForm.vitalTemp   ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalTemp: v }));   setGlobalDirty(true) }} label="Temperature"    sub="°F"/>
              <Toggle checked={rxForm.vitalSpo2   ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalSpo2: v }));   setGlobalDirty(true) }} label="SpO2"           sub="Oxygen saturation %"/>
              <Toggle checked={rxForm.vitalPulse  ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalPulse: v }));  setGlobalDirty(true) }} label="Pulse Rate"     sub="bpm"/>
              <Toggle checked={rxForm.vitalHeight ?? false} onChange={v => { setRxForm(f => ({ ...f, vitalHeight: v })); setGlobalDirty(true) }} label="Height"         sub="cm"/>
              <Toggle checked={rxForm.vitalBMI    ?? false} onChange={v => { setRxForm(f => ({ ...f, vitalBMI: v }));    setGlobalDirty(true) }} label="BMI"            sub="Auto-calculated"/>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">These control the <strong>writing form</strong>. For how prescriptions <strong>print</strong>, use the Prescription Print tab.</p>
            <Button variant="primary" loading={saving}
              icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              onClick={saveRxForm}>
              {saved ? 'Saved!' : 'Save Settings'}
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 3 — Prescription Print                            */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'rxprint' && (
        <PrintDesignPanel
          type="prescription"
          cfg={rxPrint} setCfg={setRxPrint}
          onSave={() => savePrintDesign('prescription')}
          onReset={() => resetPrintDesign('prescription')}
          saving={saving} saved={saved}
        />
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 4 — Bill / Receipt Print                          */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'billprint' && (
        <PrintDesignPanel
          type="bill"
          cfg={billPrint} setCfg={setBillPrint}
          onSave={() => savePrintDesign('bill')}
          onReset={() => resetPrintDesign('bill')}
          saving={saving} saved={saved}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  PrintDesignPanel — shared UI for Rx Print & Bill Print
// ═══════════════════════════════════════════════════════════
function PrintDesignPanel({ type, cfg, setCfg, onSave, onReset, saving, saved }) {
  const set = (key, val) => { setCfg(p => ({ ...p, [key]: val })); setGlobalDirty(true) }
  const isRx = type === 'prescription'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Settings panel */}
      <div className="lg:col-span-2 space-y-4">

        {/* Paper & typography */}
        <CollapsibleSection title="Paper & Typography">
          <RadioGroup label="Paper Size"  value={cfg.paperSize}    onChange={v => set('paperSize', v)}
            options={[{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }, { value: 'half', label: 'Half Page' }]}/>
          <RadioGroup label="Font Size"   value={cfg.baseFontSize} onChange={v => set('baseFontSize', v)}
            options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]}/>
          <RadioGroup label="Font Style"  value={cfg.fontFamily}   onChange={v => set('fontFamily', v)}
            options={[{ value: 'default', label: 'Sans-serif' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Monospace' }]}/>
          <ColorPicker label="Primary / Header Color" value={cfg.primaryColor || cfg.headerColor}
            onChange={v => { set('primaryColor', v); set('headerColor', v) }}/>
        </CollapsibleSection>

        {/* Clinic header */}
        <CollapsibleSection title="Clinic Header">
          <Toggle checked={cfg.showClinicName}    onChange={v => set('showClinicName', v)}    label="Clinic Name"/>
          <Toggle checked={cfg.showClinicTagline} onChange={v => set('showClinicTagline', v)} label="Tagline / Motto"/>
          <Toggle checked={cfg.showClinicAddress} onChange={v => set('showClinicAddress', v)} label="Address"/>
          <Toggle checked={cfg.showClinicPhone}   onChange={v => set('showClinicPhone', v)}   label="Phone Number"/>
          {isRx && <Toggle checked={cfg.headerBorder} onChange={v => set('headerBorder', v)} label="Header Border Line"/>}
        </CollapsibleSection>

        {/* Doctor info */}
        {isRx && (
          <CollapsibleSection title="Doctor Information">
            <Toggle checked={cfg.showDoctorName}  onChange={v => set('showDoctorName', v)}  label="Doctor Name"/>
            <Toggle checked={cfg.showDoctorQual}  onChange={v => set('showDoctorQual', v)}  label="Qualification" sub="e.g. MBBS, MD"/>
            <Toggle checked={cfg.showDoctorSpec}  onChange={v => set('showDoctorSpec', v)}  label="Specialization"/>
            <Toggle checked={cfg.showDoctorRegNo} onChange={v => set('showDoctorRegNo', v)} label="Registration Number"/>
          </CollapsibleSection>
        )}

        {/* Patient section */}
        <CollapsibleSection title="Patient Details">
          <Toggle checked={cfg.showPatient} onChange={v => set('showPatient', v)} label="Patient Name"/>
          <Toggle checked={cfg.showAge}     onChange={v => set('showAge', v)}     label="Age"/>
          <Toggle checked={cfg.showGender}  onChange={v => set('showGender', v)}  label="Gender"/>
          {isRx && <>
            <Toggle checked={cfg.showAllergy} onChange={v => set('showAllergy', v)} label="Allergy Warning"/>
            <Toggle checked={cfg.showRxNo}    onChange={v => set('showRxNo', v)}    label="Rx Number"/>
          </>}
        </CollapsibleSection>

        {/* Prescription-only sections */}
        {isRx && (
          <>
            <CollapsibleSection title="Print — Prescription Sections">
              <p className="text-xs text-slate-400 mb-3 bg-blue-50 px-3 py-2 rounded-lg">
                Controls what appears on the <strong>printed prescription</strong>. For the writing form, see the <strong>Prescription Form</strong> tab.
              </p>
              <Toggle checked={cfg.showComplaint} onChange={v => set('showComplaint', v)} label="Chief Complaint"/>
              <Toggle checked={cfg.showDiagnosis} onChange={v => set('showDiagnosis', v)} label="Diagnosis"/>
              <Toggle checked={cfg.showVitals}    onChange={v => set('showVitals', v)}    label="Vitals" sub="BP, Sugar, Weight etc."/>
              <Toggle checked={cfg.showMedicines} onChange={v => set('showMedicines', v)} label="Medicines Table"/>
              <Toggle checked={cfg.showLabTests}  onChange={v => set('showLabTests', v)}  label="Lab Tests"/>
              <Toggle checked={cfg.showAdvice}    onChange={v => set('showAdvice', v)}    label="Advice & Precautions"/>
              <Toggle checked={cfg.showNextVisit} onChange={v => set('showNextVisit', v)} label="Next Visit Date"/>
            </CollapsibleSection>

            <CollapsibleSection title="Medicine Table Columns">
              <Toggle checked={cfg.showDosage}       onChange={v => set('showDosage', v)}       label="Dosage" sub="e.g. 1-0-1"/>
              <Toggle checked={cfg.showWhen}         onChange={v => set('showWhen', v)}         label="When / Timing" sub="After Food, Before Food etc."/>
              <Toggle checked={cfg.showFrequency}    onChange={v => set('showFrequency', v)}    label="Frequency" sub="Daily, Alternate Days, Weekly etc."/>
              <Toggle checked={cfg.showDays}         onChange={v => set('showDays', v)}         label="Duration"/>
              <Toggle checked={cfg.showQty}          onChange={v => set('showQty', v)}          label="Quantity"/>
              <Toggle checked={cfg.showNotes}        onChange={v => set('showNotes', v)}        label="Notes" sub="Instructions below medicine name"/>
              <Toggle checked={cfg.showRxSymbol}     onChange={v => set('showRxSymbol', v)}     label="℞ Symbol"/>
              <Toggle checked={cfg.medicineNameBold} onChange={v => set('medicineNameBold', v)} label="Bold Medicine Names"/>
            </CollapsibleSection>
          </>
        )}

        {/* Bill-only sections */}
        {!isRx && (
          <CollapsibleSection title="Bill Sections">
            <Toggle checked={cfg.showBillNo}      onChange={v => set('showBillNo', v)}      label="Bill Number"/>
            <Toggle checked={cfg.showDate}        onChange={v => set('showDate', v)}        label="Date"/>
            <Toggle checked={cfg.showItemName}    onChange={v => set('showItemName', v)}    label="Item Name"/>
            <Toggle checked={cfg.showQty}         onChange={v => set('showQty', v)}         label="Quantity"/>
            <Toggle checked={cfg.showRate}        onChange={v => set('showRate', v)}        label="Rate"/>
            <Toggle checked={cfg.showAmount}      onChange={v => set('showAmount', v)}      label="Amount"/>
            <Toggle checked={cfg.showSubtotal}    onChange={v => set('showSubtotal', v)}    label="Subtotal"/>
            <Toggle checked={cfg.showDiscount}    onChange={v => set('showDiscount', v)}    label="Discount"/>
            <Toggle checked={cfg.showTotal}       onChange={v => set('showTotal', v)}       label="Total"/>
            <Toggle checked={cfg.showPaymentMode} onChange={v => set('showPaymentMode', v)} label="Payment Mode"/>
            <Toggle checked={cfg.showBalance}     onChange={v => set('showBalance', v)}     label="Balance Due"/>
            <Toggle checked={cfg.showNotes}       onChange={v => set('showNotes', v)}       label="Payment Notes"/>
            <div className="py-2.5 border-b border-slate-50">
              <p className="text-sm font-medium text-slate-700 mb-1.5">Thank You Message</p>
              <input className="form-input text-sm" placeholder="e.g. Thank you for visiting!"
                value={cfg.thankYouMessage || ''} onChange={e => set('thankYouMessage', e.target.value)}/>
            </div>
          </CollapsibleSection>
        )}

        {/* Footer */}
        <CollapsibleSection title="Footer">
          <Toggle checked={cfg.showSignature}   onChange={v => set('showSignature', v)}   label="Doctor Signature Line"/>
          <Toggle checked={cfg.showGeneratedBy} onChange={v => set('showGeneratedBy', v)} label="Generated by PulseDesk" sub="Footer timestamp"/>
        </CollapsibleSection>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-2 pb-8">
          <Button variant="ghost" icon={<RotateCcw className="w-4 h-4"/>} onClick={onReset}>
            Reset to Defaults
          </Button>
          <Button variant="primary" size="lg" loading={saving}
            icon={saved ? <Check className="w-5 h-5"/> : <Save className="w-5 h-5"/>}
            onClick={onSave}>
            {saved ? 'Saved!' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* Live preview panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5"/>Live Preview
          </p>
          <div className={`bg-white rounded-xl border-2 border-blue-100 overflow-hidden shadow-card
            ${cfg.baseFontSize === 'sm' ? 'text-xs' : cfg.baseFontSize === 'lg' ? 'text-sm' : 'text-xs'}`}
            style={{ fontFamily: cfg.fontFamily === 'serif' ? 'Georgia,serif' : cfg.fontFamily === 'mono' ? 'monospace' : 'inherit' }}>

            {/* Preview header */}
            <div className={`p-3 ${cfg.headerBorder !== false ? 'border-b-2' : ''}`}
              style={{ borderColor: cfg.primaryColor || cfg.headerColor || '#1565C0' }}>
              <div className="flex justify-between items-start">
                <div>
                  {cfg.showClinicName    && <p className="font-bold text-sm" style={{ color: cfg.primaryColor || '#1565C0' }}>Sharma Medical Clinic</p>}
                  {cfg.showClinicTagline && <p className="text-xs text-slate-500 italic">Your Health, Our Priority</p>}
                  {cfg.showClinicAddress && <p className="text-xs text-slate-400">123 Main Street, Pune</p>}
                  {cfg.showClinicPhone   && <p className="text-xs text-slate-400">📞 9876543210</p>}
                </div>
                {isRx && (
                  <div className="text-right">
                    {cfg.showDoctorName  && <p className="font-bold text-xs">Dr. Rajesh Sharma</p>}
                    {cfg.showDoctorQual  && <p className="text-xs text-slate-500">MBBS, MD</p>}
                    {cfg.showDoctorSpec  && <p className="text-xs text-slate-500">General Physician</p>}
                    {cfg.showDoctorRegNo && <p className="text-xs text-slate-400">Reg: MH-12345</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 space-y-2">
              {/* Patient */}
              {cfg.showPatient && (
                <div className="bg-blue-50/50 rounded-lg p-2 text-xs">
                  <div className="grid grid-cols-2 gap-0.5">
                    <span className="text-slate-400">Patient:</span><span className="font-semibold">Suraj Dingane</span>
                    {cfg.showAge    && <><span className="text-slate-400">Age:</span><span>33 yrs</span></>}
                    {cfg.showGender && <><span className="text-slate-400">Gender:</span><span>Male</span></>}
                  </div>
                </div>
              )}

              {/* Rx-specific preview */}
              {isRx && (
                <>
                  {cfg.showComplaint && <p className="text-xs"><span className="text-slate-400">COMPLAINT:</span> Headache, mild fever</p>}
                  {cfg.showDiagnosis && <p className="text-xs"><span className="text-slate-400">DIAGNOSIS:</span> Viral Fever</p>}
                  {cfg.showMedicines && (
                    <div className="border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-1 mb-1">
                        {cfg.showRxSymbol && <span className="text-base font-bold" style={{ color: cfg.primaryColor || '#1565C0' }}>℞</span>}
                        <span className="text-[10px] font-bold text-slate-500">MEDICINES</span>
                      </div>
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-slate-400 border-b">
                            <th className="text-left py-0.5">MEDICINE</th>
                            {cfg.showDosage && <th className="text-center">DOSAGE</th>}
                            {cfg.showWhen   && <th className="text-center">TIMING</th>}
                            {cfg.showDays   && <th className="text-center">DURATION</th>}
                            {cfg.showQty    && <th className="text-center">QTY</th>}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-50">
                            <td className={`py-1 ${cfg.medicineNameBold ? 'font-semibold' : ''}`}>Paracetamol 500mg</td>
                            {cfg.showDosage && <td className="text-center">1-0-1</td>}
                            {cfg.showWhen   && <td className="text-center">After Food</td>}
                            {cfg.showDays   && <td className="text-center">5 days</td>}
                            {cfg.showQty    && <td className="text-center">10</td>}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {cfg.showAdvice && <p className="text-xs"><span className="text-slate-400">ADVICE:</span> Rest, drink fluids</p>}
                  {cfg.showNextVisit && <p className="text-xs"><span className="text-slate-400">Next Visit:</span> 30 Apr 2026</p>}
                </>
              )}

              {/* Bill-specific preview */}
              {!isRx && (
                <>
                  <div className="flex justify-between text-xs">
                    {cfg.showBillNo && <span className="text-slate-400">Bill #: <span className="text-slate-700 font-mono">B0001</span></span>}
                    {cfg.showDate   && <span className="text-slate-400">Date: <span className="text-slate-700">22 Apr 2026</span></span>}
                  </div>
                  <table className="w-full text-[10px] border-t pt-1">
                    <thead>
                      <tr className="text-slate-400 border-b">
                        {cfg.showItemName && <th className="text-left py-0.5">ITEM</th>}
                        {cfg.showQty      && <th className="text-center">QTY</th>}
                        {cfg.showRate     && <th className="text-right">RATE</th>}
                        {cfg.showAmount   && <th className="text-right">AMT</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50">
                        {cfg.showItemName && <td className="py-1">Consultation</td>}
                        {cfg.showQty      && <td className="text-center">1</td>}
                        {cfg.showRate     && <td className="text-right">500</td>}
                        {cfg.showAmount   && <td className="text-right">500</td>}
                      </tr>
                    </tbody>
                  </table>
                  <div className="text-right space-y-0.5 text-xs">
                    {cfg.showSubtotal    && <p className="text-slate-500">Subtotal: <span className="font-mono">₹500</span></p>}
                    {cfg.showDiscount    && <p className="text-slate-500">Discount: <span className="font-mono">₹50</span></p>}
                    {cfg.showTotal       && <p className="font-bold" style={{ color: cfg.primaryColor || '#1565C0' }}>Total: ₹450</p>}
                    {cfg.showPaymentMode && <p className="text-slate-400 text-[10px]">Paid by Cash</p>}
                  </div>
                  {cfg.thankYouMessage && (
                    <p className="text-center text-[10px] italic text-slate-400 pt-2 border-t">{cfg.thankYouMessage}</p>
                  )}
                </>
              )}

              {/* Footer */}
              {(cfg.showSignature || cfg.showGeneratedBy) && (
                <div className="border-t border-slate-100 pt-2 flex justify-between text-[10px]">
                  {cfg.showSignature   && <span className="text-slate-400">_______________<br/>Doctor's Signature</span>}
                  {cfg.showGeneratedBy && <span className="text-slate-300 italic self-end">Generated by PulseDesk</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
