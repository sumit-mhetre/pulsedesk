import { useEffect, useState } from 'react'
import {
  Save, RotateCcw, Eye, Check, ChevronDown, ChevronUp,
  Building2, FileText, Printer, Receipt, Palette, ImageIcon, FileCheck,
  Plus, Trash2, Star, X, Edit3, Stethoscope,
} from 'lucide-react'
import { Card, Button, PageHeader } from '../../components/ui'
import ImageUploader from '../../components/branding/ImageUploader'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { setGlobalDirty, useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import useAuthStore from '../../store/authStore'

// ─── Shared UI Primitives ─────────────────────────────────
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
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <button type="button"
        onClick={() => { if (!locked) onChange(!checked) }}
        disabled={locked}
        title={locked ? 'This setting cannot be changed' : undefined}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4
          ${effectiveChecked ? 'bg-primary' : 'bg-slate-200'}
          ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: effectiveChecked ? 'translateX(18px)' : 'translateX(2px)' }}/>
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
  showOPD: true, showPatient: true, showAge: true, showGender: true,
  showPhone: true, showEmail: false, showAddress: false, showBloodGroup: false,
  showAllergy: true, showChronicConditions: false,
  showComplaint: true, showDiagnosis: true, showMedicines: true, showLabTests: true,
  showLabResults: true, showAdvice: true, showNextVisit: true, showVitals: false,
  showDosage: true, showWhen: true, showFrequency: true, showDays: true, showQty: true, showNotes: true,
  showGeneric: false,  // Print generic/composition below medicine name — OFF by default
  compactPrint: true,  // Combine Timing-Freq-Duration into one column for denser layout
  fontFamily: 'default', baseFontSize: 'md', medicineNameBold: true,
  showSignature: true, showSignatureImage: true, showStampImage: true, showLogo: true,
  showFooterImage: true, showGeneratedBy: true, showRxSymbol: true,
  primaryColor: '#1565C0', showRxNo: true,
  // Spacing controls (mm for padding, dropdown for line spacing)
  paddingTop: 8, paddingBottom: 8,
  lineSpacing: 'normal',  // 'tight' | 'normal' | 'comfortable' | 'airy'
  defaultPrintLang: 'en', // 'en' | 'hi' | 'mr' — pre-fills the Rx form's language dropdown
}

const DEFAULT_BILL_PRINT = {
  paperSize: 'A4', showClinicName: true, showClinicAddress: true, showClinicPhone: true,
  showDoctorName: true, showOPD: true, showPatient: true, showAge: true, showGender: true,
  showPhone: true, showEmail: false, showAddress: false,
  showBillNo: true, showDate: true, showItemName: true, showQty: true,
  showRate: true, showAmount: true, showSubtotal: true, showDiscount: true,
  showTotal: true, showPaymentMode: true, showBalance: true, showNotes: true,
  showSignature: false, showSignatureImage: false, showLogo: true, showFooterImage: false,
  headerColor: '#1565C0', primaryColor: '#1565C0',
  baseFontSize: 'md', fontFamily: 'default', thankYouMessage: 'Thank you for visiting!',
  paddingTop: 8, paddingBottom: 8,
  lineSpacing: 'normal',
}

const TABS = [
  { key: 'clinic',     label: 'Clinic Info',        icon: Building2 },
  { key: 'branding',   label: 'Branding',           icon: Palette   },
  { key: 'clinical',   label: 'Clinical',           icon: Stethoscope },
  { key: 'rxform',     label: 'Prescription Form',  icon: FileText  },
  { key: 'rxprint',    label: 'Prescription Print', icon: Printer   },
  { key: 'billprint',  label: 'Bill / Receipt',     icon: Receipt   },
  { key: 'doctemplates', label: 'Cert Templates',  icon: FileCheck },
]

// ═══════════════════════════════════════════════════════════
//  Main Settings Page
// ═══════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic')
  const [fetching,  setFetching]  = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Hook activates beforeunload listener when global dirty flag is set.
  // The page already calls setGlobalDirty(true/false) on field changes / saves,
  // so we just need this to be mounted. Existing dirty/clean calls keep working.
  useUnsavedChanges()

  // Clinic info state
  const [clinic, setClinic] = useState({
    name: '', address: '', phone: '', mobile: '',
    email: '', tagline: '', gst: '', opdSeriesPrefix: '',
    logo: null, headerImageUrl: null, footerImageUrl: null, letterheadUrl: null,
    hideTextOnHeader: true, letterheadMode: false,
  })

  // Clinical settings state — separate from clinic info because saving has a different shape.
  // Maps to Clinic.settings JSON column on backend (shallow-merged on save).
  const [clinical, setClinical] = useState({
    flagOutOfRangeLabValues: true,   // default ON when no setting saved yet
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
        name:             c.name || '',
        address:          c.address || '',
        phone:            c.phone || '',
        mobile:           c.mobile || '',
        email:            c.email || '',
        tagline:          c.tagline || '',
        gst:              c.gst || '',
        opdSeriesPrefix:  c.opdSeriesPrefix || '',
        logo:             c.logo || null,
        headerImageUrl:   c.headerImageUrl || null,
        footerImageUrl:   c.footerImageUrl || null,
        letterheadUrl:    c.letterheadUrl || null,
        hideTextOnHeader: c.hideTextOnHeader !== false,  // default true
        letterheadMode:   !!c.letterheadMode,
      })
      // Clinical settings — hydrate from clinic.settings JSON. Default to ON when not set.
      const s = c.settings || {}
      setClinical({
        flagOutOfRangeLabValues: s.flagOutOfRangeLabValues !== false,
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

  const saveClinical = async () => {
    setSaving(true)
    try {
      // Backend shallow-merges settings, so we only need to send the key(s) that changed.
      await api.put('/clinics/me', { settings: clinical })
      toast.success('Clinical settings saved!')
      setGlobalDirty(false)
      flashSaved()
    } catch { toast.error('Failed to save clinical settings') }
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
      {/*  Tab 2 — Branding (centralized image management)        */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="max-w-3xl space-y-5">
          {/* NEW — full-width header banner (recommended for most clinics) */}
          <Card
            title="Header Banner (recommended)"
            subtitle="Full-width image with your logo + clinic name + address — replaces the text header on print"
          >
            <div className="space-y-4">
              <ImageUploader
                kind="header"
                value={clinic.headerImageUrl}
                onChange={(url) => setClinic(c => ({ ...c, headerImageUrl: url }))}
                label="Header Image"
                description="Recommended: 2400×500 px PNG, designed in Canva/Photoshop. Includes your logo, clinic name, address, phone, etc."
                aspectHint="wide"
              />
              {clinic.headerImageUrl && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Hide text header</p>
                    <p className="text-xs text-slate-500 mt-0.5">When ON, clinic name/address/phone text is NOT printed (since it's already in your banner). Turn OFF if you want both image AND text.</p>
                  </div>
                  <Toggle
                    checked={clinic.hideTextOnHeader}
                    onChange={(v) => { setClinic(c => ({ ...c, hideTextOnHeader: v })); setGlobalDirty(true) }}
                    label=""
                  />
                </div>
              )}
            </div>
          </Card>

          <Card title="Clinic Branding" subtitle="Used when no header banner is uploaded — shows logo + text in header">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ImageUploader
                kind="logo"
                value={clinic.logo}
                onChange={(url) => setClinic(c => ({ ...c, logo: url }))}
                label="Clinic Logo"
                description="Small square logo, appears next to clinic name. Skip this if you've uploaded a header banner above."
                aspectHint="square"
              />
              <ImageUploader
                kind="footer"
                value={clinic.footerImageUrl}
                onChange={(url) => setClinic(c => ({ ...c, footerImageUrl: url }))}
                label="Footer Image (optional)"
                description="Disclaimer banner, partner logos, etc. Shown above SimpleRx watermark."
                aspectHint="wide"
              />
            </div>
          </Card>

          <Card title="Letterhead" subtitle="For clinics with pre-printed prescription pads">
            <div className="space-y-4">
              <ImageUploader
                kind="letterhead"
                value={clinic.letterheadUrl}
                onChange={(url) => setClinic(c => ({ ...c, letterheadUrl: url }))}
                label="Letterhead Background"
                description="Upload a scan of your pre-printed letterhead. When letterhead mode is on, the print page hides the clinic header (logo, name, address, doctor info) so it doesn't overlap."
                aspectHint="16:9"
              />

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Letterhead Mode</p>
                  <p className="text-xs text-slate-500 mt-0.5">When ON, hides clinic header + logo on print so your pre-printed letterhead shows through cleanly.</p>
                </div>
                <Toggle
                  checked={clinic.letterheadMode}
                  onChange={(v) => { setClinic(c => ({ ...c, letterheadMode: v })); setGlobalDirty(true) }}
                  label=""
                />
              </div>
            </div>
          </Card>

          <Card title="Doctor Signature & Stamp" subtitle="Your personal signature and stamp — appear on YOUR prescriptions only">
            <DoctorBrandingSection/>
          </Card>

          <div className="flex justify-end">
            <Button variant="primary" loading={saving}
              onClick={saveClinicInfo}
              icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}>
              {saved ? 'Saved!' : 'Save Branding'}
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab — Clinical Settings                                */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'clinical' && (
        <div className="max-w-2xl space-y-5">
          <Card title="Lab Results" subtitle="How lab values are displayed when doctors record test outcomes">
            <Toggle
              checked={clinical.flagOutOfRangeLabValues}
              onChange={v => { setClinical(c => ({ ...c, flagOutOfRangeLabValues: v })); setGlobalDirty(true) }}
              label="Highlight out-of-range values"
              sub="When ON, lab values outside the configured normal range get a soft red background. Doctors still make all clinical decisions — this is just a visual cue."
            />
          </Card>
          <div className="flex justify-end pt-2">
            <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={saveClinical}>
              Save Clinical Settings
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab — Prescription Form                                */}
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

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 5 — Document Templates (fitness, medical, referral) */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'doctemplates' && <DocTemplatesPanel/>}
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
          <Toggle checked={cfg.showLogo ?? true}  onChange={v => set('showLogo', v)}     label="Clinic Logo"        sub="Upload via Branding tab"/>
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
          <Toggle checked={cfg.showOPD ?? true}    onChange={v => set('showOPD', v)}    label="OPD / Patient Code"  sub="e.g. MH0001 — printed in bold"/>
          <Toggle checked={cfg.showPatient}        onChange={v => set('showPatient', v)} label="Patient Name"/>
          <Toggle checked={cfg.showAge}            onChange={v => set('showAge', v)}     label="Age"/>
          <Toggle checked={cfg.showGender}         onChange={v => set('showGender', v)}  label="Gender"/>
          <Toggle checked={cfg.showPhone ?? true}  onChange={v => set('showPhone', v)}   label="Mobile Number"       sub="Printed after dash on patient line"/>
          <Toggle checked={!!cfg.showEmail}        onChange={v => set('showEmail', v)}   label="Email Address"/>
          <Toggle checked={!!cfg.showAddress}      onChange={v => set('showAddress', v)} label="Address"/>
          <Toggle checked={!!cfg.showBloodGroup}   onChange={v => set('showBloodGroup', v)} label="Blood Group"/>
          {isRx && <>
            <Toggle checked={cfg.showAllergy} onChange={v => set('showAllergy', v)} label="Allergy Warning"/>
            <Toggle checked={!!cfg.showChronicConditions} onChange={v => set('showChronicConditions', v)} label="Chronic Conditions"/>
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
              <Toggle checked={cfg.showLabResults} onChange={v => set('showLabResults', v)} label="Test Outcomes" sub="Recorded values for ordered tests, with date columns"/>
              <Toggle checked={cfg.showAdvice}    onChange={v => set('showAdvice', v)}    label="Advice & Precautions"/>
              <Toggle checked={cfg.showNextVisit} onChange={v => set('showNextVisit', v)} label="Next Visit Date"/>
            </CollapsibleSection>

            <CollapsibleSection title="Medicine Table Columns">
              <Toggle checked={cfg.compactPrint !== false} onChange={v => set('compactPrint', v)} label="Compact Columns" sub="Combine Timing – Freq. – Duration into a single column (saves horizontal space)"/>
              <Toggle checked={cfg.showDosage}       onChange={v => set('showDosage', v)}       label="Dosage" sub="e.g. 1-0-1"/>
              <Toggle checked={cfg.showWhen}         onChange={v => set('showWhen', v)}         label="When / Timing" sub="After Food, Before Food etc."/>
              <Toggle checked={cfg.showFrequency}    onChange={v => set('showFrequency', v)}    label="Frequency" sub="Daily, Alternate Days, Weekly etc."/>
              <Toggle checked={cfg.showDays}         onChange={v => set('showDays', v)}         label="Duration"/>
              <Toggle checked={cfg.showQty}          onChange={v => set('showQty', v)}          label="Quantity"/>
              <Toggle checked={cfg.showNotes}        onChange={v => set('showNotes', v)}        label="Notes" sub="Instructions below medicine name"/>
              <Toggle checked={cfg.showGeneric === true} onChange={v => set('showGeneric', v)} label="Generic Name" sub="Prints active ingredient below medicine name (e.g. Paracetamol 500mg)"/>
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

        {/* Spacing — paddings and line height */}
        <CollapsibleSection title="Spacing & Layout">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Top padding (mm)</label>
                <input
                  type="number"
                  min="0" max="50" step="1"
                  className="form-input w-full"
                  value={cfg.paddingTop ?? 8}
                  onChange={e => set('paddingTop', Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                />
                <p className="text-xs text-slate-400 mt-1">Space after header / before content. 0–50 mm.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Bottom padding (mm)</label>
                <input
                  type="number"
                  min="0" max="50" step="1"
                  className="form-input w-full"
                  value={cfg.paddingBottom ?? 8}
                  onChange={e => set('paddingBottom', Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                />
                <p className="text-xs text-slate-400 mt-1">Space after content / before footer. 0–50 mm.</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Line spacing</label>
              <select
                className="form-select w-full"
                value={cfg.lineSpacing || 'normal'}
                onChange={e => set('lineSpacing', e.target.value)}
              >
                <option value="tight">Tight (1.2× — most compact)</option>
                <option value="normal">Normal (1.5× — default)</option>
                <option value="comfortable">Comfortable (1.75× — more breathing room)</option>
                <option value="airy">Airy (2.0× — most spacious)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Affects spacing between lines and sections in the body.</p>
            </div>

            {isRx && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Default Print Language</label>
                <select
                  className="form-select w-full"
                  value={cfg.defaultPrintLang || 'en'}
                  onChange={e => set('defaultPrintLang', e.target.value)}
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="hi">🇮🇳 Hindi</option>
                  <option value="mr">🇮🇳 Marathi</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Pre-selected when doctor opens a new prescription. They can still change it per-Rx if needed.</p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Footer */}
        <CollapsibleSection title="Footer">
          {isRx && <Toggle checked={cfg.showSignatureImage ?? true}  onChange={v => set('showSignatureImage', v)} label="Doctor Signature Image"  sub="Use uploaded signature instead of blank line"/>}
          {isRx && <Toggle checked={cfg.showStampImage ?? true}      onChange={v => set('showStampImage', v)}     label="Doctor Stamp / Seal"     sub="Uploaded via Branding tab"/>}
          <Toggle checked={cfg.showFooterImage ?? false} onChange={v => set('showFooterImage', v)} label="Footer Image"           sub="Banner uploaded via Branding tab"/>
          <Toggle checked={cfg.showSignature}   onChange={v => set('showSignature', v)}   label="Doctor Signature Line"  sub="Blank line for handwritten signature"/>
          <Toggle checked={true} onChange={()=>{}} locked label="Generated by SimpleRx EMR" sub="Footer timestamp — always shown"/>
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
              {/* Patient — preview uses the same layout as actual print page */}
              <div className="border-b border-slate-200 pb-2 text-xs flex flex-wrap items-baseline gap-x-2">
                {(cfg.showOPD ?? true) && <span className="font-bold tracking-wide">MH0001</span>}
                {cfg.showPatient && (
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
                    {(cfg.showPhone ?? true) && <span className="text-slate-700"> - 9876543210</span>}
                  </span>
                )}
                <span className="ml-auto text-slate-500" style={{fontSize:'9px'}}>Date: 25-Apr-2026</span>
              </div>
              {/* Optional contact row */}
              {(cfg.showEmail || cfg.showAddress || cfg.showBloodGroup) && (
                <p className="text-[10px] text-slate-500 -mt-1">
                  {[
                    cfg.showEmail       && 'patient@email.com',
                    cfg.showAddress     && '123 Main St, Pune',
                    cfg.showBloodGroup  && 'B+',
                  ].filter(Boolean).join(' • ')}
                </p>
              )}
              {isRx && cfg.showChronicConditions && (
                <p className="text-[10px]"><span className="font-semibold">Chronic:</span> Hypertension, Diabetes</p>
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

              {/* Footer — watermark always shown */}
              <div className="border-t border-slate-100 pt-2 flex justify-between text-[10px]">
                {cfg.showSignature   && <span className="text-slate-400">_______________<br/>Doctor's Signature</span>}
                <span className="text-slate-300 italic self-end ml-auto">Generated by SimpleRx EMR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DoctorBrandingSection ─────────────────────────────────
// Doctor's own signature + stamp. Each doctor manages their own.
// Uses authStore so other parts of the app immediately see the new URLs.
function DoctorBrandingSection() {
  const { user, setUser } = useAuthStore()
  const isDoctor = user?.role === 'DOCTOR' || user?.role === 'ADMIN'

  if (!user) return null

  const updateUserField = (key, url) => {
    setUser({ ...user, [key]: url })
  }

  if (!isDoctor) {
    return (
      <p className="text-xs text-slate-500 italic py-3">
        Signatures and stamps are per-doctor. Sign in as a doctor account to manage these.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ImageUploader
        kind="signature"
        value={user.signature}
        onChange={(url) => updateUserField('signature', url)}
        label="My Signature"
        description="Will replace the 'Signature' line on YOUR prescriptions only."
        aspectHint="wide"
      />
      <ImageUploader
        kind="stamp"
        value={user.stamp}
        onChange={(url) => updateUserField('stamp', url)}
        label="My Stamp / Seal (optional)"
        description="Doctor's seal — printed next to the signature."
        aspectHint="square"
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  Document Templates panel — manages reusable templates for
//  fitness certs, medical certs, and referrals.
// ═══════════════════════════════════════════════════════════

const DOC_TYPES = [
  { key: 'FITNESS_CERT', label: 'Fitness Certificate' },
  { key: 'MEDICAL_CERT', label: 'Medical Certificate (Sick Leave)' },
  { key: 'REFERRAL',     label: 'Referral Letter' },
]

function DocTemplatesPanel() {
  const [tab, setTab] = useState('FITNESS_CERT')
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // template object | null | 'new'

  const load = () => {
    setLoading(true)
    api.get(`/document-templates?type=${tab}`, { silent: true })
      .then(r => setTemplates(Array.isArray(r?.data?.data) ? r.data.data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [tab])

  const handleDelete = async (tpl) => {
    if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/document-templates/${tpl.id}`)
      toast.success('Template deleted')
      load()
    } catch {}
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card title="Certificate Templates" subtitle="Pre-fill common patterns to save typing — doctors can edit anything before saving">
        {/* Type tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {DOC_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setEditing(null) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition
                ${tab === t.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-slate-400 italic py-4">Loading…</p>
        ) : (
          <>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4">No templates for this type yet.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(tpl => (
                  <div key={tpl.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-primary/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 flex items-center gap-2">
                        {tpl.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500"/>}
                        {tpl.name}
                      </p>
                      {tpl.diagnosis && <p className="text-xs text-slate-500 mt-0.5 truncate">Dx: {tpl.diagnosis}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditing(tpl)}
                        className="p-1.5 rounded text-slate-500 hover:text-primary hover:bg-blue-50" title="Edit">
                        <Edit3 className="w-4 h-4"/>
                      </button>
                      <button type="button" onClick={() => handleDelete(tpl)}
                        className="p-1.5 rounded text-slate-500 hover:text-danger hover:bg-rose-50" title="Delete">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4"/>}
              onClick={() => setEditing('new')} className="mt-3">
              New Template
            </Button>
          </>
        )}
      </Card>

      {/* Editor */}
      {editing && (
        <TemplateEditor
          type={tab}
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function TemplateEditor({ type, template, onClose, onSaved }) {
  const isNew = !template
  const [name, setName]           = useState(template?.name || '')
  const [isDefault, setIsDefault] = useState(!!template?.isDefault)
  const [diagnosis, setDiagnosis] = useState(template?.diagnosis || '')
  const [remarks,   setRemarks]   = useState(template?.remarks || '')
  const [data, setData]           = useState(template?.data || {})
  const [saving, setSaving]       = useState(false)

  const save = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return }
    setSaving(true)
    try {
      const body = { type, name: name.trim(), isDefault, diagnosis, remarks, data }
      if (isNew) {
        await api.post('/document-templates', body)
        toast.success('Template created')
      } else {
        await api.put(`/document-templates/${template.id}`, body)
        toast.success('Template updated')
      }
      onSaved?.()
    } catch {} finally { setSaving(false) }
  }

  const setDataField = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-slate-800">{isNew ? 'New Template' : `Edit: ${template.name}`}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
          <X className="w-5 h-5"/>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="form-label">Template Name *</label>
          <input type="text" className="form-input" placeholder="e.g. Sports fitness — adult"
            value={name} onChange={e => setName(e.target.value)}/>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}/>
          <span>Mark as default (★ shown first in picker)</span>
        </label>

        {/* Type-specific quick fields */}
        {type === 'FITNESS_CERT' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Default verdict</label>
              <select className="form-select" value={data.verdict || 'FIT'}
                onChange={e => setDataField('verdict', e.target.value)}>
                <option value="FIT">Fit</option>
                <option value="FIT_WITH_RESTRICTIONS">Fit with restrictions</option>
                <option value="UNFIT">Not fit</option>
              </select>
            </div>
            <div>
              <label className="form-label">Default fitness for</label>
              <input type="text" className="form-input" placeholder="e.g. Employment"
                value={data.fitnessFor || ''} onChange={e => setDataField('fitnessFor', e.target.value)}/>
            </div>
            <div>
              <label className="form-label">Validity (months)</label>
              <input type="number" min="0" className="form-input"
                value={data.validityMonths ?? ''} onChange={e => setDataField('validityMonths', e.target.value === '' ? null : parseInt(e.target.value) || 0)}/>
            </div>
            <div>
              <label className="form-label">Restrictions (if any)</label>
              <input type="text" className="form-input"
                value={data.restrictions || ''} onChange={e => setDataField('restrictions', e.target.value)}/>
            </div>
          </div>
        )}

        {type === 'MEDICAL_CERT' && (
          <div>
            <label className="form-label">Default rest duration (days)</label>
            <input type="number" min="1" max="90" className="form-input md:w-1/3"
              value={data.defaultRestDays || ''} onChange={e => setDataField('defaultRestDays', e.target.value === '' ? null : parseInt(e.target.value) || 0)}/>
            <p className="text-xs text-slate-400 mt-1">Doctor can edit at issue time. Leave blank to require manual entry.</p>
          </div>
        )}

        {type === 'REFERRAL' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Default specialty</label>
              <input type="text" className="form-input" placeholder="e.g. Cardiologist"
                value={data.referredToSpecialty || ''} onChange={e => setDataField('referredToSpecialty', e.target.value)}/>
            </div>
            <div className="col-span-2">
              <label className="form-label">Default reason for referral</label>
              <textarea className="form-input" rows={2}
                value={data.reasonForReferral || ''} onChange={e => setDataField('reasonForReferral', e.target.value)}/>
            </div>
          </div>
        )}

        <div>
          <label className="form-label">Default diagnosis (optional)</label>
          <textarea className="form-input" rows={2}
            value={diagnosis} onChange={e => setDiagnosis(e.target.value)}/>
        </div>

        <div>
          <label className="form-label">Default remarks (optional)</label>
          <textarea className="form-input" rows={2}
            value={remarks} onChange={e => setRemarks(e.target.value)}/>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {isNew ? 'Create Template' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
