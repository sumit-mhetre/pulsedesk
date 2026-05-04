import { useEffect, useState, createContext, useContext } from 'react'
import {
  Save, RotateCcw, Eye, Check, ChevronDown, ChevronUp,
  Building2, FileText, Printer, Receipt, Palette, ImageIcon, FileCheck,
  Plus, Trash2, Star, X, Edit3, Stethoscope, GripVertical,
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

// ─────────────────────────────────────────────
// ACCORDION — only one section open at a time, all start closed
// ─────────────────────────────────────────────
// Pattern: parent provides AccordionContext; children read openId and toggle.
// Wrap a tab in <AccordionProvider> and use <AccordionItem id="..."> for each
// collapsible section inside. Opening one closes any other.
//
// CollapsibleSection (used by PrintDesignPanel) opts in by passing an id —
// when an id is provided AND a context exists, it behaves as an accordion item.
// Otherwise it falls back to internal state with defaultOpen, so the component
// is backward-compatible for any non-accordion uses.
const AccordionContext = createContext(null)

function AccordionProvider({ children, defaultOpenId = null }) {
  const [openId, setOpenId] = useState(defaultOpenId)
  // useEffect handled by callers if they need to reset on parent state change.
  const toggle = (id) => setOpenId(prev => prev === id ? null : id)
  const setOpen = (id) => setOpenId(id)
  return (
    <AccordionContext.Provider value={{ openId, toggle, setOpen, isControlled: true }}>
      {children}
    </AccordionContext.Provider>
  )
}

// AccordionItem — generic collapsible card that renders title + chevron + children.
// Children render only when this item's id matches the provider's openId.
// headerExtra is an optional slot for badges/counts shown on the header strip.
function AccordionItem({ id, title, subtitle, headerExtra, icon: Icon, children }) {
  const ctx = useContext(AccordionContext)
  const open = ctx?.openId === id
  const onToggle = () => ctx?.toggle(id)
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary flex-shrink-0"/>}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-700 text-sm">{title}</div>
            {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerExtra}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {children}
        </div>
      )}
    </Card>
  )
}

function CollapsibleSection({ id, title, icon: Icon, children, defaultOpen = true }) {
  // Accordion-aware: if an id is provided AND a wrapping AccordionProvider exists,
  // defer open/close to the shared context. Otherwise use local state with
  // defaultOpen so non-accordion uses still work.
  const ctx = useContext(AccordionContext)
  const inAccordion = !!(ctx && id)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = inAccordion ? ctx.openId === id : internalOpen
  const handleToggle = () => {
    if (inAccordion) ctx.toggle(id)
    else setInternalOpen(o => !o)
  }
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={handleToggle}
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
  showCustomRxNo: false,  // OFF by default - hide Custom Rx No. field from the writing form
  showTestOutcomes: true,  // Flask FAB on the writing form for recording lab values
  vitalBP: true, vitalSugar: true, vitalWeight: true, vitalTemp: true,
  vitalSpo2: true, vitalPulse: true, vitalHeight: false, vitalBMI: false,
  // Custom fields the doctor adds (text inputs for now; v2 may add type=radio/dropdown/etc)
  // Each: { id: 'cf_xxxx', name: 'Field Name', type: 'text' }
  customFields: [],
  // Section order for the writing form AND the printed Rx (same order). Built-in section
  // keys are: complaint, diagnosis, vitals, medicines, labTests, advice, nextVisit.
  // Custom fields appear here as their cf_* id. Falls back to built-in default order if empty/missing.
  fieldOrder: ['complaint', 'diagnosis', 'vitals', 'medicines', 'labTests', 'advice', 'nextVisit'],
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
  showCustomFields: true,    // Print clinic-defined custom field values, gated by this
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
  { key: 'clinic',     label: 'Clinic Info',           icon: Building2 },
  { key: 'branding',   label: 'Letterhead & Logos',    icon: Palette   },
  { key: 'clinical',   label: 'Lab Settings',          icon: Stethoscope },
  { key: 'rxform',     label: 'Prescription Layout',   icon: FileText  },
  { key: 'rxprint',    label: 'Prescription Style',    icon: Printer   },
  { key: 'billprint',  label: 'Bill Style',            icon: Receipt   },
  { key: 'doctemplates', label: 'Certificate Templates', icon: FileCheck },
]

// ═══════════════════════════════════════════════════════════
//  Main Settings Page
// ═══════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('clinic')
  const [fetching,  setFetching]  = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Doctor (current user) — read from authStore so the live preview can show
  // the real signature, stamp, name, qualification, etc. when toggles enable them.
  const { user } = useAuthStore()

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
    // Doctor Data Privacy toggles - all default false (privacy-first).
    shareAppointments: false, sharePrescriptions: false,
    shareTemplates:    false, shareMasterData:    false,
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
        // Doctor Data Privacy - default false everywhere if server returns null/missing
        shareAppointments:  !!c.shareAppointments,
        sharePrescriptions: !!c.sharePrescriptions,
        shareTemplates:     !!c.shareTemplates,
        shareMasterData:    !!c.shareMasterData,
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

  // Combined save for the merged "Prescription Form & Print" tab. The Sections card
  // on that tab touches BOTH rxForm and rxPrint configs (form-side `showXxx` and
  // print-side `showXxx` are separate keys backing the same UX), so a single click
  // needs to persist both. Other cards on the tab (Custom Fields, Section Order,
  // Vitals Fields) live entirely on the form side, so this still covers them.
  const saveFormAndPrint = async () => {
    setSaving(true)
    try {
      const existing = await api.get('/page-design?type=rx_form').catch(() => ({ data: { data: { config: {} } } }))
      const mergedForm = { ...(existing.data.data?.config || {}), ...rxForm }
      await Promise.all([
        api.post('/page-design', { type: 'rx_form',      config: mergedForm }),
        api.post('/page-design', { type: 'prescription', config: rxPrint    }),
      ])
      toast.success('Form & Print settings saved!')
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
        <AccordionProvider>
        <form onSubmit={saveClinicInfo} className="max-w-3xl space-y-3">
          <AccordionItem id="basic-info" title="Basic Information" subtitle="Clinic name, address, GST, OPD prefix">
            <div className="p-4 space-y-3">
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
                <input className="form-input font-mono" placeholder="e.g. MH, MH15 or leave blank"
                  value={clinic.opdSeriesPrefix || ''} onChange={setClinicField('opdSeriesPrefix')}/>
                <p className="text-xs text-slate-400 mt-1">
                  {(() => {
                    // Mirror of backend generator: split letters + optional starting number,
                    // then preview the first two codes the system will produce.
                    const raw = (clinic.opdSeriesPrefix || '').trim()
                    const m = raw.match(/^([a-zA-Z]+)(\d*)$/)
                    const letters = m ? m[1].toUpperCase() : (raw.toUpperCase() || 'SHA')
                    const start   = m && m[2] ? parseInt(m[2], 10) : 1
                    return (
                      <>Patient codes: <strong className="font-mono">{letters}{start}</strong>, <strong className="font-mono">{letters}{start+1}</strong>, <strong className="font-mono">{letters}{start+2}</strong>…</>
                    )
                  })()}
                </p>
              </div>
            </div>
          </AccordionItem>

          <AccordionItem id="contact-details" title="Contact Details" subtitle="Landline, mobile, email">
            <div className="p-4 space-y-3">
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
            </div>
          </AccordionItem>

          <AccordionItem
            id="doctor-privacy"
            title="Doctor Data Privacy"
            subtitle="Control whether doctors share their templates and master data with each other">
            <div className="p-4 space-y-1">
              <p className="text-xs text-slate-500 mb-3">
                When a toggle is OFF (default), each doctor only sees their own data + any pre-existing shared data.
                When ON, all doctors in this clinic see each other's items. The clinic admin always sees everything.
              </p>
              <Toggle
                checked={clinic.shareTemplates}
                onChange={v => { setClinic(c => ({ ...c, shareTemplates: v })); setGlobalDirty(true) }}
                label="Share Prescription Templates"
                sub="When ON, doctors see each other's saved templates. When OFF, templates are private to each doctor."
              />
              <Toggle
                checked={clinic.shareMasterData}
                onChange={v => { setClinic(c => ({ ...c, shareMasterData: v })); setGlobalDirty(true) }}
                label="Share Complaints, Diagnoses & Advice"
                sub="When ON, doctors see each other's added complaints, diagnoses and advice options. When OFF, each doctor's master-data additions are private."
              />
              <Toggle
                checked={clinic.sharePrescriptions}
                onChange={v => { setClinic(c => ({ ...c, sharePrescriptions: v })); setGlobalDirty(true) }}
                label="Share Prescriptions"
                sub="When ON, doctors can see prescriptions written by others. When OFF, each doctor only sees prescriptions they wrote (admin and receptionist always see all)."
              />
              <Toggle
                checked={clinic.shareAppointments}
                onChange={v => { setClinic(c => ({ ...c, shareAppointments: v })); setGlobalDirty(true) }}
                label="Share Appointments"
                sub="When ON, doctors see each other's appointment queue. When OFF, each doctor's queue is private (admin, receptionist and nurse always see all)."
              />
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">Note</p>
                <p className="text-xs text-amber-800">
                  Patients always remain shared across doctors (the receptionist can see and book for any doctor).
                  Existing items created before this feature was added stay visible to everyone.
                </p>
              </div>
            </div>
          </AccordionItem>

          <div className="flex justify-end mt-4">
            <Button type="submit" variant="primary" loading={saving}
              icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}>
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </form>
        </AccordionProvider>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab 2 — Branding (centralized image management)        */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'branding' && (
        <AccordionProvider>
        <div className="max-w-3xl space-y-3">
          <AccordionItem
            id="header-banner"
            title="Header Banner (recommended)"
            subtitle="Full-width image with your logo + clinic name + address — replaces the text header on print">
            <div className="p-4">
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
            </div>
          </AccordionItem>

          <AccordionItem
            id="clinic-branding"
            title="Clinic Branding"
            subtitle="Used when no header banner is uploaded — shows logo + text in header">
            <div className="p-4">
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
            </div>
          </AccordionItem>

          <AccordionItem
            id="letterhead"
            title="Letterhead"
            subtitle="For clinics with pre-printed prescription pads">
            <div className="p-4">
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
            </div>
          </AccordionItem>

          <AccordionItem
            id="doctor-signature"
            title="Doctor Signature & Stamp"
            subtitle="Your personal signature and stamp — appear on YOUR prescriptions only">
            <div className="p-4">
              <DoctorBrandingSection/>
            </div>
          </AccordionItem>

          <div className="flex justify-end">
            <Button variant="primary" loading={saving}
              onClick={saveClinicInfo}
              icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}>
              {saved ? 'Saved!' : 'Save Branding'}
            </Button>
          </div>
        </div>
        </AccordionProvider>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab — Clinical Settings                                */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'clinical' && (
        <AccordionProvider>
        <div className="max-w-2xl space-y-3">
          <AccordionItem id="lab-results" title="Lab Results" subtitle="How lab values are displayed when doctors record test outcomes">
            <div className="p-4">
              <Toggle
                checked={clinical.flagOutOfRangeLabValues}
                onChange={v => { setClinical(c => ({ ...c, flagOutOfRangeLabValues: v })); setGlobalDirty(true) }}
                label="Highlight out-of-range values"
                sub="When ON, lab values outside the configured normal range get a soft red background. Doctors still make all clinical decisions — this is just a visual cue."
              />
            </div>
          </AccordionItem>
          <div className="flex justify-end pt-2">
            <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>} onClick={saveClinical}>
              Save Clinical Settings
            </Button>
          </div>
        </div>
        </AccordionProvider>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab — Prescription Form & Print                          */}
      {/*  Pattern B: collapsible groups on the left, sticky live   */}
      {/*  Rx preview on the right that updates as toggles change.  */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'rxform' && (
        <AccordionProvider>
        <div className="max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-5 items-start">
            {/* LEFT — collapsible setting groups (accordion: only one open at a time) */}
            <div className="space-y-3 min-w-0">
              <CollapsibleGroupCard
                id="sections"
                title="Sections"
                subtitle="Body sections that appear on the writing form and the printed Rx"
                rows={BODY_SECTION_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              <CollapsibleGroupCard
                id="clinic-header"
                title="Clinic Header"
                subtitle="Print only — shown at the top of every Rx"
                rows={CLINIC_HEADER_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              <CollapsibleGroupCard
                id="doctor-info"
                title="Doctor Information"
                subtitle="Print only — shown in the header"
                rows={DOCTOR_INFO_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              <CollapsibleGroupCard
                id="patient-details"
                title="Patient Details"
                subtitle="Print only — shown after the header"
                rows={PATIENT_DETAIL_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              <CollapsibleGroupCard
                id="medicine-cols"
                title="Medicine Table Columns"
                subtitle="Print only — controls columns in the medicines table"
                rows={MEDICINE_COL_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              <CollapsibleGroupCard
                id="footer"
                title="Footer"
                subtitle="Print only — bottom of the Rx"
                rows={FOOTER_ROWS}
                rxForm={rxForm} setRxForm={setRxForm}
                rxPrint={rxPrint} setRxPrint={setRxPrint}/>

              {/* Vitals Fields — collapsible accordion item (only when Vitals form-side is on). */}
              {rxForm.showVitals && (
                <AccordionItem
                  id="vitals-fields"
                  title="Vitals Fields"
                  subtitle="Choose which vital parameters to record on the writing form">
                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <Toggle checked={rxForm.vitalBP     ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalBP: v }));     setGlobalDirty(true) }} label="Blood Pressure" sub="Systolic / Diastolic"/>
                      <Toggle checked={rxForm.vitalSugar  ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalSugar: v }));  setGlobalDirty(true) }} label="Blood Sugar"    sub="mg/dL"/>
                      <Toggle checked={rxForm.vitalWeight ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalWeight: v })); setGlobalDirty(true) }} label="Weight"         sub="kg"/>
                      <Toggle checked={rxForm.vitalTemp   ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalTemp: v }));   setGlobalDirty(true) }} label="Temperature"    sub="°F"/>
                      <Toggle checked={rxForm.vitalSpo2   ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalSpo2: v }));   setGlobalDirty(true) }} label="SpO2"           sub="Oxygen saturation %"/>
                      <Toggle checked={rxForm.vitalPulse  ?? true}  onChange={v => { setRxForm(f => ({ ...f, vitalPulse: v }));  setGlobalDirty(true) }} label="Pulse Rate"     sub="bpm"/>
                      <Toggle checked={rxForm.vitalHeight ?? false} onChange={v => { setRxForm(f => ({ ...f, vitalHeight: v })); setGlobalDirty(true) }} label="Height"         sub="cm"/>
                      <Toggle checked={rxForm.vitalBMI    ?? false} onChange={v => { setRxForm(f => ({ ...f, vitalBMI: v }));    setGlobalDirty(true) }} label="BMI"            sub="Auto-calculated"/>
                    </div>
                  </div>
                </AccordionItem>
              )}

              <AccordionItem
                id="custom-fields"
                title="Custom Fields"
                subtitle="Extra fields captured on every prescription. Tap 🖨 to control whether each one prints">
                <CustomFieldsBody rxForm={rxForm} setRxForm={setRxForm} rxPrint={rxPrint} setRxPrint={setRxPrint}/>
              </AccordionItem>

              <AccordionItem
                id="section-order"
                title="Section Order"
                subtitle="Drag rows to reorder sections on the writing form and the printed Rx">
                <SectionOrderBody rxForm={rxForm} setRxForm={setRxForm}/>
              </AccordionItem>

              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-slate-400 max-w-md">
                  Visual styling (colors, fonts, paper size, padding) is on the <strong>Prescription Style</strong> tab.
                </p>
                <Button variant="primary" loading={saving}
                  icon={saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
                  onClick={saveFormAndPrint}>
                  {saved ? 'Saved!' : 'Save Settings'}
                </Button>
              </div>
            </div>

            {/* RIGHT — sticky live preview. Hidden on small screens (under lg) so the
                left side gets full width. Doctor sees instant feedback as they toggle. */}
            <div className="hidden lg:block">
              <div className="sticky top-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5"/>Live Print Preview
                </p>
                <RxLivePreview cfg={rxPrint} clinic={clinic} doctor={user} rxForm={rxForm}/>
                <p className="text-[10px] text-slate-400 mt-2 italic">
                  Expand a section above and toggle 🖨 icons — preview updates instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
        </AccordionProvider>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/*  Tab — Print Style (visual styling only — visibility    */}
      {/*  toggles live on the merged "Prescription Form & Print" */}
      {/*  tab now). Bill / Receipt tab keeps the full panel.     */}
      {/* ─────────────────────────────────────────────────────── */}
      {activeTab === 'rxprint' && (
        <PrintDesignPanel
          type="prescription"
          cfg={rxPrint} setCfg={setRxPrint}
          onSave={() => savePrintDesign('prescription')}
          onReset={() => resetPrintDesign('prescription')}
          saving={saving} saved={saved}
          styleOnly={true}
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
// PrintDesignPanel — original "everything in one panel" view used by Bill / Receipt.
// For Prescription, the parent now passes styleOnly=true which strips out all the
// visibility toggle CollapsibleSections (those moved to the Form&Print merged tab).
// What remains for prescription: Paper & Typography, Spacing & Layout, and the live
// Preview. Bill mode is unchanged.
function PrintDesignPanel({ type, cfg, setCfg, onSave, onReset, saving, saved, styleOnly = false }) {
  const set = (key, val) => { setCfg(p => ({ ...p, [key]: val })); setGlobalDirty(true) }
  const isRx = type === 'prescription'

  return (
    <AccordionProvider>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Settings panel */}
      <div className="lg:col-span-2 space-y-3">

        {/* Paper & typography */}
        <CollapsibleSection id="paper" title="Paper & Typography">
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
        {!styleOnly && (
        <CollapsibleSection id="print-clinic-header" title="Clinic Header">
          <Toggle checked={cfg.showLogo ?? true}  onChange={v => set('showLogo', v)}     label="Clinic Logo"        sub="Upload via Branding tab"/>
          <Toggle checked={cfg.showClinicName}    onChange={v => set('showClinicName', v)}    label="Clinic Name"/>
          <Toggle checked={cfg.showClinicTagline} onChange={v => set('showClinicTagline', v)} label="Tagline / Motto"/>
          <Toggle checked={cfg.showClinicAddress} onChange={v => set('showClinicAddress', v)} label="Address"/>
          <Toggle checked={cfg.showClinicPhone}   onChange={v => set('showClinicPhone', v)}   label="Phone Number"/>
          {isRx && <Toggle checked={cfg.headerBorder} onChange={v => set('headerBorder', v)} label="Header Border Line"/>}
        </CollapsibleSection>
        )}

        {/* Doctor info */}
        {!styleOnly && isRx && (
          <CollapsibleSection id="print-doctor-info" title="Doctor Information">
            <Toggle checked={cfg.showDoctorName}  onChange={v => set('showDoctorName', v)}  label="Doctor Name"/>
            <Toggle checked={cfg.showDoctorQual}  onChange={v => set('showDoctorQual', v)}  label="Qualification" sub="e.g. MBBS, MD"/>
            <Toggle checked={cfg.showDoctorSpec}  onChange={v => set('showDoctorSpec', v)}  label="Specialization"/>
            <Toggle checked={cfg.showDoctorRegNo} onChange={v => set('showDoctorRegNo', v)} label="Registration Number"/>
          </CollapsibleSection>
        )}

        {/* Patient section */}
        {!styleOnly && (
        <CollapsibleSection id="print-patient-details" title="Patient Details">
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
        )}

        {/* Prescription-only sections */}
        {!styleOnly && isRx && (
          <>
            <CollapsibleSection id="print-rx-sections" title="Print — Prescription Sections">
              <p className="text-xs text-slate-400 mb-3 bg-blue-50 px-3 py-2 rounded-lg">
                Controls what appears on the <strong>printed prescription</strong>. For the writing form, see the <strong>Prescription Form</strong> tab.
              </p>
              <Toggle checked={cfg.showComplaint} onChange={v => set('showComplaint', v)} label="Chief Complaint"/>
              <Toggle checked={cfg.showDiagnosis} onChange={v => set('showDiagnosis', v)} label="Diagnosis"/>
              <Toggle checked={cfg.showVitals}    onChange={v => set('showVitals', v)}    label="Vitals" sub="BP, Sugar, Weight etc."/>
              <Toggle checked={true} onChange={()=>{}} locked label="Medicines Table" sub="Always printed — Rx is meaningless without medicines"/>
              <Toggle checked={cfg.showLabTests}  onChange={v => set('showLabTests', v)}  label="Lab Tests"/>
              <Toggle checked={cfg.showLabResults} onChange={v => set('showLabResults', v)} label="Test Outcomes" sub="Recorded values for ordered tests, with date columns"/>
              <Toggle checked={cfg.showCustomFields !== false} onChange={v => set('showCustomFields', v)} label="Custom Fields" sub="Clinic-defined custom fields added in Prescription Form"/>
              <Toggle checked={cfg.showAdvice}    onChange={v => set('showAdvice', v)}    label="Advice & Precautions"/>
              <Toggle checked={cfg.showNextVisit} onChange={v => set('showNextVisit', v)} label="Next Visit Date"/>
            </CollapsibleSection>

            <CollapsibleSection id="print-medicine-cols" title="Medicine Table Columns">
              <Toggle checked={cfg.compactPrint !== false} onChange={v => set('compactPrint', v)} label="Compact Columns" sub="Combine Timing – Freq. – Duration into a single column (saves horizontal space)"/>
              <Toggle checked={cfg.showDosage}       onChange={v => set('showDosage', v)}       label="Dosage" sub="e.g. 1-0-1"/>
              <Toggle checked={cfg.showWhen}         onChange={v => set('showWhen', v)}         label="When / Timing" sub="After Food, Before Food etc."/>
              <Toggle checked={cfg.showFrequency}    onChange={v => set('showFrequency', v)}    label="Frequency" sub="Daily, Alternate Days, Weekly etc."/>
              <Toggle checked={cfg.showDays}         onChange={v => set('showDays', v)}         label="Duration"/>
              <Toggle checked={cfg.showQty}          onChange={v => set('showQty', v)}          label="Quantity"/>
              <Toggle checked={cfg.showNotes}        onChange={v => set('showNotes', v)}        label="Notes" sub="Instructions for the medicine (visible on print)"/>
              <Toggle checked={cfg.showGeneric === true} onChange={v => set('showGeneric', v)} label="Generic Name" sub="Prints active ingredient below medicine name (e.g. Paracetamol 500mg)"/>
              <Toggle checked={cfg.showRxSymbol}     onChange={v => set('showRxSymbol', v)}     label="℞ Symbol"/>
              <Toggle checked={cfg.medicineNameBold} onChange={v => set('medicineNameBold', v)} label="Bold Medicine Names"/>
            </CollapsibleSection>
          </>
        )}

        {/* Bill-only sections */}
        {!isRx && (
          <CollapsibleSection id="print-bill-sections" title="Bill Sections">
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
        <CollapsibleSection id="print-spacing" title="Spacing & Layout">
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
        {!styleOnly && (
        <CollapsibleSection id="print-footer" title="Footer">
          {isRx && <Toggle checked={cfg.showSignatureImage ?? true}  onChange={v => set('showSignatureImage', v)} label="Doctor Signature Image"  sub="Use uploaded signature instead of blank line"/>}
          {isRx && <Toggle checked={cfg.showStampImage ?? true}      onChange={v => set('showStampImage', v)}     label="Doctor Stamp / Seal"     sub="Uploaded via Branding tab"/>}
          <Toggle checked={cfg.showFooterImage ?? false} onChange={v => set('showFooterImage', v)} label="Footer Image"           sub="Banner uploaded via Branding tab"/>
          <Toggle checked={cfg.showSignature}   onChange={v => set('showSignature', v)}   label="Doctor Signature Line"  sub="Blank line for handwritten signature"/>
          <Toggle checked={true} onChange={()=>{}} locked label="Generated by SimpleRx EMR" sub="Footer timestamp — always shown"/>
        </CollapsibleSection>
        )}

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
    </AccordionProvider>
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

// ── Custom Fields editor ──────────────────────────────────
// Lets the doctor define extra text fields (e.g. "Allergy Notes", "Family History")
// that show up on every new Rx form and on the printed prescription. Only the
// `name` is editable for v1; type is fixed to 'text' (radio/dropdown/checkbox in v2).
// ─────────────────────────────────────────────
// SECTION GROUP CARD — generic Form/Print toggle table
// ─────────────────────────────────────────────
// One reusable card that renders a titled group of toggle rows. Each row has:
//   - label, optional sub-text
//   - formKey (writes to rxForm.showXxx) — omit if the row is print-only
//   - printKey (writes to rxPrint.showXxx) — omit if the row is form-only
//   - locked flag — disables both toggles, shows a "LOCKED" badge
//
// Eye icon (👁) is shown only when formKey is provided. Printer icon (🖨) only when
// printKey is provided. Dark blue = enabled in that mode, faded gray = disabled.
//
// Used for: Clinic Header, Doctor Info, Patient Details, Sections (body), Medicine
// Columns, Footer. Each group passes its own row list — see merged tab below.
// ─────────────────────────────────────────────
// RX LIVE PREVIEW — small print mockup that updates as toggles change
// ─────────────────────────────────────────────
// Renders a compact prescription preview reflecting the current rxPrint config.
// Used inside the merged "Prescription Form & Print" tab as a sticky sidebar so
// the doctor sees instant feedback as they toggle visibility.
//
// MIRRORS the actual print page (ViewPrescriptionPage.jsx). Specifically:
//   - Letterhead mode → letterhead image as full background, NO header text/banner
//   - Header banner image (no letterhead) → render banner image
//   - Text-based clinic header → only when no letterhead AND (no banner OR hideTextOnHeader=false)
//   - Logo → only when no banner image (banner replaces logo)
//   - Date appears on the patient line, right-aligned (matches print exactly)
//   - Medicines table: # | Medicine (with generic + notes) | Dosage | TIMING-FREQ-DURATION (compact) | Qty
//     With cell borders matching print page.
//   - Body sections (vitals, complaint, etc.) — only show when toggle is ON, and use
//     a (placeholder) so the doctor sees layout without fake fabricated data.
//   - Custom fields — only those with print toggle on (matches print page rule).
//   - Next Visit shows day-of-week in the chosen print language (en/hi/mr).
//   - Footer image, doctor stamp image, signature image — all wired.
//   - Footer timestamp under "Generated by SimpleRx EMR" (matches print).
//
// Uses REAL clinic data and REAL doctor data. Patient/medicine/section bodies are
// placeholders since there's no patient context on the Settings page.
const PREVIEW_DAY_NAMES = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
}

function RxLivePreview({ cfg, clinic, doctor, rxForm }) {
  // Helper that mirrors the print page's `show()` — defaults to true if undefined.
  const show = (k) => cfg && cfg[k] !== false

  const hasLetterhead = clinic?.letterheadMode && clinic?.letterheadUrl
  const hasHeaderBanner = !hasLetterhead && clinic?.headerImageUrl
  const showTextHeader = !hasLetterhead && (!clinic?.headerImageUrl || !clinic?.hideTextOnHeader)

  const compactPrint = cfg?.compactPrint !== false
  const lang = cfg?.defaultPrintLang || 'en'

  // Sample fixed Monday so the day-of-week label is predictable (and same as the
  // tooltip-style note suggests Monday). Real Rx will use the doctor's chosen date.
  const sampleNextVisit = new Date('2026-05-04')
  const dayNames = PREVIEW_DAY_NAMES[lang] || PREVIEW_DAY_NAMES.en
  const dayName = dayNames[sampleNextVisit.getDay()]
  const dateLabel = lang === 'mr' ? 'दिनांक' : (lang === 'hi' ? 'दिनांक' : 'Date')
  const nextVisitLabel = lang === 'mr' ? 'पुढची भेट:' : (lang === 'hi' ? 'अगली भेट:' : 'Next Visit:')

  // Custom fields ordered by rxForm.fieldOrder, filtered to those with print toggle ON.
  const cfPrintMap = (cfg?.customFieldPrint && typeof cfg.customFieldPrint === 'object') ? cfg.customFieldPrint : {}
  const customFields = Array.isArray(rxForm?.customFields) ? rxForm.customFields : []
  const visibleCustomFields = customFields.filter(cf => cfPrintMap[cf.id] !== false)

  // Border thickness for medicines table cells — matches print page's "border-slate-400"
  const medCellCls = 'py-1 px-1.5 text-[9px] border border-slate-400 align-top'

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden text-xs relative"
      style={{ fontFamily: cfg.fontFamily === 'serif' ? 'Georgia,serif' : cfg.fontFamily === 'mono' ? 'monospace' : 'inherit' }}>

      {/* Letterhead background — covers entire preview when on */}
      {hasLetterhead && (
        <img src={clinic.letterheadUrl} alt="letterhead"
             className="absolute inset-0 w-full h-full object-cover pointer-events-none"
             style={{ zIndex: 0 }}/>
      )}

      <div className="relative" style={{ zIndex: 1 }}>

        {/* Header banner image */}
        {hasHeaderBanner && (
          <div className={`p-2 ${show('headerBorder') ? 'border-b-2 border-slate-400' : ''}`}>
            <img src={clinic.headerImageUrl} alt="header"
                 className="w-full object-contain"
                 style={{ maxHeight: 80 }}/>
          </div>
        )}

        {/* Text-based header */}
        {showTextHeader && (
          <div className={`p-3 ${show('headerBorder') ? 'border-b-2 border-slate-400' : ''}`}>
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {show('showLogo') && clinic?.logo && !clinic?.headerImageUrl && (
                  <img src={clinic.logo} alt="logo" className="w-8 h-8 object-contain flex-shrink-0"/>
                )}
                <div className="min-w-0">
                  {show('showClinicName') && (
                    <p className="font-bold text-sm truncate" style={{ color: cfg.primaryColor || '#1565C0' }}>
                      {clinic?.name || 'Clinic Name'}
                    </p>
                  )}
                  {show('showClinicTagline') && clinic?.tagline && (
                    <p className="text-[10px] text-slate-500 italic truncate">{clinic.tagline}</p>
                  )}
                  {show('showClinicAddress') && clinic?.address && (
                    <p className="text-[10px] text-slate-500 truncate">{clinic.address}</p>
                  )}
                  {show('showClinicPhone') && (clinic?.mobile || clinic?.phone) && (
                    <p className="text-[10px] text-slate-500">Phone: {clinic?.mobile || clinic?.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {show('showDoctorName')  && doctor?.name           && <p className="font-bold text-[10px]">{doctor.name}</p>}
                {show('showDoctorQual')  && doctor?.qualification  && <p className="text-[10px] text-slate-500">{doctor.qualification}</p>}
                {show('showDoctorSpec')  && doctor?.specialization && <p className="text-[10px] text-slate-500">{doctor.specialization}</p>}
                {show('showDoctorRegNo') && doctor?.regNo          && <p className="text-[10px] text-slate-400">Reg. No: {doctor.regNo}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-3 space-y-2">

          {/* Patient row + date — date on the right matches print page */}
          <div className="border-b border-slate-300 pb-1.5 text-[11px] flex flex-wrap items-baseline gap-x-2">
            {show('showOPD') && <span className="font-bold tracking-wide">{(() => {
              // Match the live preview in the OPD prefix field above.
              const raw = (clinic?.opdSeriesPrefix || '').trim()
              const m = raw.match(/^([a-zA-Z]+)(\d*)$/)
              const letters = m ? m[1].toUpperCase() : (raw.toUpperCase() || 'SHA')
              const start   = m && m[2] ? parseInt(m[2], 10) : 1
              return `${letters}${start}`
            })()}</span>}
            {show('showPatient') && (
              <span className="font-semibold">
                Sample Patient
                {(show('showAge') || show('showGender')) && (
                  <span className="font-normal text-slate-700">
                    {' '}({[show('showAge') && '44 yrs', show('showGender') && 'Female'].filter(Boolean).join(', ')})
                  </span>
                )}
                {show('showPhone') && <span className="text-slate-700"> - 9876543210</span>}
              </span>
            )}
            {/* Date — right-aligned, always shown (mirrors print page) */}
            <span className="ml-auto text-right">
              <span className="text-slate-500">{dateLabel}: </span>
              <span className="font-semibold">29-Apr-2026</span>
            </span>
          </div>

          {/* Optional patient contact row */}
          {(show('showEmail') || show('showAddress') || show('showBloodGroup')) && (
            <p className="text-[10px] text-slate-600">
              {[
                show('showEmail')      && 'Email: patient@email.com',
                show('showAddress')    && 'Address: 123 Main St',
                show('showBloodGroup') && 'Blood Group: B+',
              ].filter(Boolean).join(' • ')}
            </p>
          )}

          {show('showAllergy') && (
            <p className="text-[10px]"><span className="font-semibold text-danger">⚠ Allergy:</span> <span className="text-slate-400 italic">(allergy will print here)</span></p>
          )}
          {show('showChronicConditions') && (
            <p className="text-[10px]"><span className="font-semibold">Chronic:</span> <span className="text-slate-400 italic">(chronic conditions will print here)</span></p>
          )}
          {show('showRxNo') && (
            <p className="text-[10px]"><span className="font-semibold">Rx No:</span> <span className="text-slate-500">0042</span></p>
          )}

          {/* Body sections — placeholder text shows ONLY when toggle is on. Doctor
              sees the layout slot is reserved without fabricated data appearing. */}
          {show('showComplaint') && <p className="text-[11px]"><span className="font-bold">Chief Complaint:</span> <span className="text-slate-400 italic">(complaint will print here)</span></p>}
          {show('showDiagnosis') && <p className="text-[11px]"><span className="font-bold">Diagnosis:</span> <span className="text-slate-400 italic">(diagnosis will print here)</span></p>}
          {show('showVitals')    && <p className="text-[11px]"><span className="font-bold">Vitals:</span> <span className="text-slate-400 italic">(vitals will print here)</span></p>}

          {/* Medicines table — exact print-page layout */}
          {show('showMedicines') && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                {show('showRxSymbol') && <span className="text-base font-bold italic" style={{ color: cfg.primaryColor || '#1565C0' }}>℞</span>}
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Medicines</span>
              </div>
              <table className="w-full text-[10px] border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-slate-50">
                    <th className={medCellCls + ' font-bold uppercase text-slate-700 w-5 text-left'}>#</th>
                    <th className={medCellCls + ' font-bold uppercase text-slate-700 text-left'}>Medicine</th>
                    {show('showDosage') && <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center'}>Dosage</th>}
                    {compactPrint ? (
                      (show('showWhen') || show('showFrequency') || show('showDays')) && (
                        <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center'}>
                          {[show('showWhen') && 'Timing', show('showFrequency') && 'Freq.', show('showDays') && 'Duration'].filter(Boolean).join(' - ')}
                        </th>
                      )
                    ) : (
                      <>
                        {show('showWhen')      && <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center'}>Timing</th>}
                        {show('showFrequency') && <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center'}>Freq.</th>}
                        {show('showDays')      && <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center'}>Duration</th>}
                      </>
                    )}
                    {show('showQty') && <th className={medCellCls + ' font-bold uppercase text-slate-700 text-center w-7'}>Qty</th>}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { idx: 1, name: 'Sample Medicine 1', generic: 'Paracetamol (500mg)', notes: '', dosage: '1-0-1', timing: 'A/F', freq: 'Daily', days: '3', qty: '9' },
                    { idx: 2, name: 'Sample Medicine 2', generic: 'Levocetirizine 5 mg', notes: '', dosage: '1-0-1', timing: 'A/F', freq: 'Daily', days: '5', qty: '5' },
                  ].map(med => {
                    const parts = []
                    if (show('showWhen'))      parts.push(med.timing)
                    if (show('showFrequency')) parts.push(med.freq)
                    if (show('showDays'))      parts.push(med.days)
                    const combined = parts.join(' - ')
                    return (
                      <tr key={med.idx}>
                        <td className={medCellCls + ' text-slate-700'}>{med.idx}</td>
                        <td className={medCellCls}>
                          <p className={show('medicineNameBold') ? 'font-bold' : ''}>{med.name}</p>
                          {show('showGeneric') && med.generic && (
                            <p className="text-[9px] text-slate-700 italic mt-0.5">{med.generic}</p>
                          )}
                          {show('showNotes') && med.notes && (
                            <p className="text-[9px] text-slate-600 italic mt-0.5">{med.notes}</p>
                          )}
                        </td>
                        {show('showDosage') && <td className={medCellCls + ' font-mono text-center'}>{med.dosage}</td>}
                        {compactPrint ? (
                          (show('showWhen') || show('showFrequency') || show('showDays')) && (
                            <td className={medCellCls + ' text-center'}>{combined}</td>
                          )
                        ) : (
                          <>
                            {show('showWhen')      && <td className={medCellCls + ' text-center'}>{med.timing}</td>}
                            {show('showFrequency') && <td className={medCellCls + ' text-center'}>{med.freq}</td>}
                            {show('showDays')      && <td className={medCellCls + ' text-center'}>{med.days}</td>}
                          </>
                        )}
                        {show('showQty') && <td className={medCellCls + ' text-center font-bold'}>{med.qty}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {show('showLabTests')   && <p className="text-[11px]"><span className="font-bold">Lab Tests:</span> <span className="text-slate-400 italic">(lab tests will print here)</span></p>}
          {show('showLabResults') && <p className="text-[11px]"><span className="font-bold">Test Outcomes:</span> <span className="text-slate-400 italic">(recorded values will print here)</span></p>}
          {show('showAdvice')     && <p className="text-[11px]"><span className="font-bold">Advice:</span> <span className="text-slate-400 italic">(advice will print here)</span></p>}
          {show('showNextVisit')  && (
            <p className="text-[11px]"><span className="font-bold">{nextVisitLabel}</span> {dayName} 04 May 2026</p>
          )}

          {/* Custom fields — respect per-cf print toggle and field order */}
          {visibleCustomFields.map(cf => (
            <p key={cf.id} className="text-[11px]">
              <span className="font-bold">{cf.name || '(unnamed field)'}:</span>{' '}
              <span className="text-slate-400 italic">(value will print here)</span>
            </p>
          ))}

          {/* Footer image — uploaded clinic banner */}
          {show('showFooterImage') && clinic?.footerImageUrl && (
            <div className="border-t border-slate-100 pt-2 mt-2 flex justify-center">
              <img src={clinic.footerImageUrl} alt="footer"
                   className="max-h-10 object-contain" style={{ maxWidth: '90%' }}/>
            </div>
          )}

          {/* Footer signature row — mirrors print page (timestamp on left, signature on right) */}
          <div className="border-t border-slate-100 pt-2 mt-3 flex justify-between items-end">
            <div className="text-[9px] text-slate-400">
              <p>Generated by SimpleRx EMR</p>
              <p>29 Apr 2026, 03:30 PM</p>
            </div>
            <div className="text-right flex items-end gap-2">
              {show('showStampImage') && doctor?.stamp && (
                <img src={doctor.stamp} alt="stamp" className="h-8 w-8 object-contain"/>
              )}
              <div>
                {show('showSignatureImage') && doctor?.signature ? (
                  <img src={doctor.signature} alt="sig" className="h-6 ml-auto object-contain mb-0.5" style={{ maxWidth: 80 }}/>
                ) : (
                  <div className="w-20 border-b border-slate-300 mb-0.5 h-3"></div>
                )}
                {show('showSignature') && doctor?.name && (
                  <>
                    <p className="text-[9px] font-semibold text-slate-600">{doctor.name}</p>
                    <p className="text-[9px] text-slate-400">Signature</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// COLLAPSIBLE GROUP CARD — collapsible variant of SectionGroupCard
// ─────────────────────────────────────────────
// Wraps a SectionGroupCard in a collapsible header. Shows a count badge and
// an "n on / m total" summary so the doctor can see at a glance which groups
// have non-default state without expanding them.
function CollapsibleGroupCard({ id, title, subtitle, rows, rxForm, setRxForm, rxPrint, setRxPrint, defaultOpen = false }) {
  const ctx = useContext(AccordionContext)
  const inAccordion = !!(ctx && id)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = inAccordion ? ctx.openId === id : internalOpen
  const handleToggle = () => {
    if (inAccordion) ctx.toggle(id)
    else setInternalOpen(o => !o)
  }

  // Compute "on" counts so the collapsed header is informative.
  const formOnCount  = rows.filter(r => r.formKey  && rxForm[r.formKey]   !== false).length
  const printOnCount = rows.filter(r => r.printKey && rxPrint[r.printKey] !== false).length
  const formTotal    = rows.filter(r => r.formKey).length
  const printTotal   = rows.filter(r => r.printKey).length

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-700 text-sm">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {formTotal > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500" title={`${formOnCount} of ${formTotal} shown on form`}>
              <Eye className="w-3.5 h-3.5"/>{formOnCount}/{formTotal}
            </span>
          )}
          {printTotal > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500" title={`${printOnCount} of ${printTotal} printed`}>
              <Printer className="w-3.5 h-3.5"/>{printOnCount}/{printTotal}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <SectionGroupCardBody rows={rows} rxForm={rxForm} setRxForm={setRxForm} rxPrint={rxPrint} setRxPrint={setRxPrint}/>
        </div>
      )}
    </Card>
  )
}

// Body-only variant of SectionGroupCard — same row UI but without the wrapper Card,
// so it can be embedded inside a CollapsibleGroupCard's expanded panel.
function SectionGroupCardBody({ rows, rxForm, setRxForm, rxPrint, setRxPrint }) {
  const isFormOn  = (key) => key == null ? null : rxForm[key]  !== false
  const isPrintOn = (key) => key == null ? null : rxPrint[key] !== false

  const toggleForm = (key, locked) => {
    if (locked || !key) return
    setRxForm(f => ({ ...f, [key]: !isFormOn(key) }))
    setGlobalDirty(true)
  }
  const togglePrint = (key, locked) => {
    if (locked || !key) return
    setRxPrint(p => ({ ...p, [key]: !isPrintOn(key) }))
    setGlobalDirty(true)
  }

  return (
    <div className="p-1">
      {rows.map((row, idx) => {
        const formOn  = isFormOn(row.formKey)
        const printOn = isPrintOn(row.printKey)
        const hasForm  = row.formKey  != null
        const hasPrint = row.printKey != null
        return (
          <div key={row.label + '_' + idx}
               className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-700 flex items-center gap-2">
                <span className="truncate">{row.label}</span>
                {row.locked && (
                  <span className="text-[9px] uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">Locked</span>
                )}
              </div>
              {row.sub && <div className="text-[11px] text-slate-400 truncate mt-0.5">{row.sub}</div>}
            </div>
            {hasForm ? (
              <button type="button" onClick={() => toggleForm(row.formKey, row.locked)} disabled={!!row.locked}
                title={row.locked ? 'Always shown on form' : (formOn ? 'Showing on form — click to hide' : 'Hidden on form — click to show')}
                aria-label={`Toggle ${row.label} on writing form`}
                className={['p-1.5 rounded-lg transition flex-shrink-0',
                  row.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white',
                  formOn ? 'text-primary' : 'text-slate-300',
                ].join(' ')}>
                <Eye className="w-4 h-4"/>
              </button>
            ) : (
              <span className="w-7 flex-shrink-0" aria-hidden/>
            )}
            {hasPrint ? (
              <button type="button" onClick={() => togglePrint(row.printKey, row.locked)} disabled={!!row.locked}
                title={row.locked ? 'Always printed' : (printOn ? 'Printing — click to hide on print' : 'Hidden on print — click to print')}
                aria-label={`Toggle ${row.label} on printed Rx`}
                className={['p-1.5 rounded-lg transition flex-shrink-0',
                  row.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white',
                  printOn ? 'text-primary' : 'text-slate-300',
                ].join(' ')}>
                <Printer className="w-4 h-4"/>
              </button>
            ) : (
              <span className="w-7 flex-shrink-0" aria-hidden/>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SectionGroupCard({ title, subtitle, rows, rxForm, setRxForm, rxPrint, setRxPrint }) {
  const isFormOn  = (key) => key == null ? null : rxForm[key]  !== false
  const isPrintOn = (key) => key == null ? null : rxPrint[key] !== false

  const toggleForm = (key, locked) => {
    if (locked || !key) return
    setRxForm(f => ({ ...f, [key]: !isFormOn(key) }))
    setGlobalDirty(true)
  }

  const togglePrint = (key, locked) => {
    if (locked || !key) return
    setRxPrint(p => ({ ...p, [key]: !isPrintOn(key) }))
    setGlobalDirty(true)
  }

  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-1">
        {rows.map((row, idx) => {
          const formOn  = isFormOn(row.formKey)
          const printOn = isPrintOn(row.printKey)
          const hasForm  = row.formKey  != null
          const hasPrint = row.printKey != null
          return (
            <div key={row.label + '_' + idx}
                 className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="truncate">{row.label}</span>
                  {row.locked && (
                    <span className="text-[9px] uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">Locked</span>
                  )}
                </div>
                {row.sub && <div className="text-xs text-slate-400 truncate">{row.sub}</div>}
              </div>

              {/* Eye / Form toggle — rendered only if this row applies to the form. */}
              {hasForm ? (
                <button
                  type="button"
                  onClick={() => toggleForm(row.formKey, row.locked)}
                  disabled={!!row.locked}
                  title={row.locked ? 'Always shown on form' : (formOn ? 'Showing on form — click to hide' : 'Hidden on form — click to show')}
                  aria-label={`Toggle ${row.label} on writing form`}
                  className={[
                    'p-1.5 rounded-lg transition flex-shrink-0',
                    row.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white',
                    formOn ? 'text-primary' : 'text-slate-300',
                  ].join(' ')}>
                  <Eye className="w-5 h-5"/>
                </button>
              ) : (
                <span className="w-8 flex-shrink-0" aria-hidden/>
              )}

              {/* Printer / Print toggle — rendered only if this row applies to print. */}
              {hasPrint ? (
                <button
                  type="button"
                  onClick={() => togglePrint(row.printKey, row.locked)}
                  disabled={!!row.locked}
                  title={row.locked ? 'Always printed' : (printOn ? 'Printing — click to hide on print' : 'Hidden on print — click to print')}
                  aria-label={`Toggle ${row.label} on printed Rx`}
                  className={[
                    'p-1.5 rounded-lg transition flex-shrink-0',
                    row.locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white',
                    printOn ? 'text-primary' : 'text-slate-300',
                  ].join(' ')}>
                  <Printer className="w-5 h-5"/>
                </button>
              ) : (
                <span className="w-8 flex-shrink-0" aria-hidden/>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Row catalogs for each group on the merged tab.
// ─────────────────────────────────────────────
// Defined at module scope so they're stable references — no re-creation on render.
// Each row: { label, sub?, formKey?, printKey?, locked? }
// Print-only rows omit formKey; the card renders an empty placeholder slot for the
// missing icon so all rows align vertically. Locked rows show a badge and disable
// the toggles; the underlying value is treated as always-on regardless.

const CLINIC_HEADER_ROWS = [
  { label: 'Clinic Logo',         sub: 'Upload via Branding tab', printKey: 'showLogo' },
  { label: 'Clinic Name',         printKey: 'showClinicName' },
  { label: 'Tagline / Motto',     printKey: 'showClinicTagline' },
  { label: 'Address',             printKey: 'showClinicAddress' },
  { label: 'Phone Number',        printKey: 'showClinicPhone' },
  { label: 'Header Border Line',  printKey: 'headerBorder' },
]

const DOCTOR_INFO_ROWS = [
  { label: 'Doctor Name',         printKey: 'showDoctorName' },
  { label: 'Qualification',       sub: 'e.g. MBBS, MD',     printKey: 'showDoctorQual' },
  { label: 'Specialization',      printKey: 'showDoctorSpec' },
  { label: 'Registration Number', printKey: 'showDoctorRegNo' },
]

const PATIENT_DETAIL_ROWS = [
  { label: 'OPD / Patient Code', sub: 'e.g. MH0001 — printed in bold', printKey: 'showOPD' },
  { label: 'Patient Name',       printKey: 'showPatient' },
  { label: 'Age',                printKey: 'showAge' },
  { label: 'Gender',             printKey: 'showGender' },
  { label: 'Mobile Number',      sub: 'Printed after dash on patient line', printKey: 'showPhone' },
  { label: 'Email Address',      printKey: 'showEmail' },
  { label: 'Address',            printKey: 'showAddress' },
  { label: 'Blood Group',        printKey: 'showBloodGroup' },
  { label: 'Allergy Warning',    printKey: 'showAllergy' },
  { label: 'Chronic Conditions', printKey: 'showChronicConditions' },
  { label: 'Rx Number',          printKey: 'showRxNo' },
]

// Body sections — these appear on BOTH the writing form and the printed Rx, so they
// get both eye and printer icons. Test Outcomes is a special case where the form
// flag (showTestOutcomes) controls flask FAB visibility while the print flag
// (showLabResults) controls printed table — different keys, same conceptual row.
const BODY_SECTION_ROWS = [
  { label: 'Vitals',               sub: 'BP, Sugar, Weight, Temp, SpO2, Pulse', formKey: 'showVitals',       printKey: 'showVitals' },
  { label: 'Chief Complaint',      sub: "Patient's main complaints",            formKey: 'showComplaint',    printKey: 'showComplaint' },
  { label: 'Diagnosis',            sub: 'Clinical diagnosis',                   formKey: 'showDiagnosis',    printKey: 'showDiagnosis' },
  { label: 'Medicines',            sub: 'Always shown — Rx is meaningless without medicines', formKey: 'showMedicines', printKey: 'showMedicines', locked: true },
  { label: 'Lab Tests',            sub: 'Diagnostic tests requested',           formKey: 'showLabTests',     printKey: 'showLabTests' },
  { label: 'Test Outcomes',        sub: 'Recorded values for ordered tests',    formKey: 'showTestOutcomes', printKey: 'showLabResults' },
  { label: 'Advice & Precautions', sub: 'Instructions to patient',              formKey: 'showAdvice',       printKey: 'showAdvice' },
  { label: 'Next Visit',           sub: 'Follow-up date',                       formKey: 'showNextVisit',    printKey: 'showNextVisit' },
  { label: 'Custom Rx No.',        sub: 'Doctor-typed Rx number override (form only - default OFF)', formKey: 'showCustomRxNo' },
]

const MEDICINE_COL_ROWS = [
  { label: 'Compact Columns',     sub: 'Combine Timing • Freq • Duration into one column', printKey: 'compactPrint' },
  { label: 'Dosage',              sub: 'e.g. 1-0-1',           printKey: 'showDosage' },
  { label: 'When / Timing',       sub: 'After Food, Before Food etc.', printKey: 'showWhen' },
  { label: 'Frequency',           sub: 'Daily, Alternate Days, Weekly', printKey: 'showFrequency' },
  { label: 'Duration',            printKey: 'showDays' },
  { label: 'Quantity',            printKey: 'showQty' },
  { label: 'Notes',               sub: 'Show notes for the medicine on print', printKey: 'showNotes' },
  { label: 'Notes as Separate Column', sub: 'ON: separate column on the right. OFF: notes shown below medicine name (default)', printKey: 'notesAsColumn' },
  { label: 'Generic Name',        sub: 'Active ingredient below brand',  printKey: 'showGeneric' },
  { label: '℞ Symbol',            printKey: 'showRxSymbol' },
  { label: 'Bold Medicine Names', printKey: 'medicineNameBold' },
]

const FOOTER_ROWS = [
  { label: 'Doctor Signature Image', sub: 'Use uploaded signature image',  printKey: 'showSignatureImage' },
  { label: 'Doctor Stamp / Seal',    sub: 'Uploaded via Branding tab',     printKey: 'showStampImage' },
  { label: 'Footer Image',           sub: 'Banner via Branding tab',       printKey: 'showFooterImage' },
  { label: 'Doctor Signature Line',  sub: 'Blank line for handwritten sign', printKey: 'showSignature' },
  { label: 'Generated by SimpleRx EMR', sub: 'Footer timestamp', printKey: 'showGeneratedBy', locked: true },
]

// Body-only version of Custom Fields, used inside accordion items.
// The full card with title is rendered by the parent (AccordionItem).
function CustomFieldsBody({ rxForm, setRxForm, rxPrint, setRxPrint }) {
  const fields = Array.isArray(rxForm.customFields) ? rxForm.customFields : []

  // Per-cf print visibility is stored in rxPrint.customFieldPrint as a {[cfId]: bool}
  // map. Default to TRUE if a field has no entry (so newly added fields print).
  // The legacy single `showCustomFields` master toggle is now a fallback only —
  // if it's explicitly false, no custom fields print regardless of per-cf flags.
  const cfPrintMap = (rxPrint && typeof rxPrint.customFieldPrint === 'object' && rxPrint.customFieldPrint) || {}
  const isPrintOn  = (id) => cfPrintMap[id] !== false

  const addField = () => {
    const id = 'cf_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
    setRxForm(f => ({
      ...f,
      customFields: [...(Array.isArray(f.customFields) ? f.customFields : []), { id, name: '', type: 'text' }],
      fieldOrder: [...(Array.isArray(f.fieldOrder) ? f.fieldOrder : []), id],
    }))
    setRxPrint(p => ({
      ...p,
      customFieldPrint: { ...(p.customFieldPrint || {}), [id]: true },
    }))
    setGlobalDirty(true)
  }

  const renameField = (id, newName) => {
    setRxForm(f => ({
      ...f,
      customFields: (f.customFields || []).map(cf => cf.id === id ? { ...cf, name: newName } : cf),
    }))
    setGlobalDirty(true)
  }

  const togglePrint = (id) => {
    setRxPrint(p => {
      const cur = (p.customFieldPrint && typeof p.customFieldPrint === 'object') ? p.customFieldPrint : {}
      return { ...p, customFieldPrint: { ...cur, [id]: !(cur[id] !== false) } }
    })
    setGlobalDirty(true)
  }

  const removeField = (id) => {
    if (!window.confirm('Remove this custom field? Any saved values for it will remain on existing prescriptions but will no longer appear on new ones.')) return
    setRxForm(f => ({
      ...f,
      customFields: (f.customFields || []).filter(cf => cf.id !== id),
      fieldOrder:   (f.fieldOrder   || []).filter(k  => k  !== id),
    }))
    setRxPrint(p => {
      const cur = { ...(p.customFieldPrint || {}) }
      delete cur[id]
      return { ...p, customFieldPrint: cur }
    })
    setGlobalDirty(true)
  }

  return (
    <div className="p-4">
      {fields.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-slate-500 mb-3">No custom fields yet.</p>
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={addField}>
            Add Custom Field
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map(cf => {
            const printOn = isPrintOn(cf.id)
            return (
              <div key={cf.id} className="flex items-center gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Field name (e.g. Allergy Notes)"
                  value={cf.name || ''}
                  onChange={(e) => renameField(cf.id, e.target.value)}/>
                <span className="text-[10px] text-slate-400 uppercase tracking-wide whitespace-nowrap">Text</span>
                <button
                  type="button"
                  onClick={() => togglePrint(cf.id)}
                  title={printOn ? 'Printing — click to hide on print' : 'Hidden on print — click to print'}
                  aria-label={`Toggle print for ${cf.name || 'field'}`}
                  className={[
                    'p-1.5 rounded transition flex-shrink-0',
                    printOn ? 'text-primary hover:bg-primary/10' : 'text-slate-300 hover:bg-slate-100',
                  ].join(' ')}>
                  <Printer className="w-4 h-4"/>
                </button>
                <button
                  type="button"
                  onClick={() => removeField(cf.id)}
                  title="Remove field"
                  className="text-slate-400 hover:text-danger hover:bg-danger/10 rounded p-1.5 transition flex-shrink-0">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            )
          })}
          <div className="pt-2">
            <Button variant="secondary" icon={<Plus className="w-4 h-4"/>} onClick={addField}>
              Add Another
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3 italic">
        Future versions will let you choose input types (radio, dropdown, checkbox, number).
      </p>
    </div>
  )
}

// Backward-compatible Card wrapper — kept so existing uses (if any) still work.
function CustomFieldsCard({ rxForm, setRxForm, rxPrint, setRxPrint }) {
  return (
    <Card title="Custom Fields" subtitle="Extra fields captured on every prescription. Tap 🖨 to control whether each one prints — they always show on the writing form.">
      <CustomFieldsBody rxForm={rxForm} setRxForm={setRxForm} rxPrint={rxPrint} setRxPrint={setRxPrint}/>
    </Card>
  )
}

// ── Section Order editor ──────────────────────────────────
// Lets the doctor reorder which Rx sections appear in what order, both on the
// writing form and on the printed Rx. Uses up/down arrow buttons (no drag-drop).
// Built-in sections + custom fields share one unified order list.
// Body-only version of Section Order — drag-drop list of sections without
// the outer Card wrapper. Used inside accordion items where the parent supplies
// the header. The thin SectionOrderCard wrapper below is kept for backward compat.
function SectionOrderBody({ rxForm, setRxForm }) {
  // Map of section key → display label. Custom fields use their `name`.
  const BUILTIN_LABELS = {
    complaint:  'Chief Complaint',
    diagnosis:  'Diagnosis',
    vitals:     'Vitals',
    medicines:  'Medicines',
    labTests:   'Lab Tests',
    advice:     'Advice & Precautions',
    nextVisit:  'Next Visit Date',
  }
  const BUILTIN_KEYS = Object.keys(BUILTIN_LABELS)

  // Resolve the canonical order:
  // 1. Start from rxForm.fieldOrder if it exists, otherwise default builtin order
  // 2. Append any builtin keys missing from the saved order (e.g. after a future schema bump)
  // 3. Append any custom field ids missing from the saved order
  // 4. Drop any orphan ids (custom fields that have been deleted but remain in fieldOrder)
  const customIds = (rxForm.customFields || []).map(c => c.id)
  const validKeys = new Set([...BUILTIN_KEYS, ...customIds])
  const savedOrder = Array.isArray(rxForm.fieldOrder) ? rxForm.fieldOrder.filter(k => validKeys.has(k)) : []
  const missing = [...BUILTIN_KEYS, ...customIds].filter(k => !savedOrder.includes(k))
  const order = [...savedOrder, ...missing]

  const labelFor = (key) => {
    if (BUILTIN_LABELS[key]) return BUILTIN_LABELS[key]
    const cf = (rxForm.customFields || []).find(c => c.id === key)
    return cf ? (cf.name || '(unnamed custom field)') : key
  }

  const isCustom = (key) => !BUILTIN_LABELS[key]

  // Persist a reordered list. Used by both drag-drop and the ↑↓ buttons.
  const commit = (next) => {
    setRxForm(f => ({ ...f, fieldOrder: next }))
    setGlobalDirty(true)
  }

  const move = (idx, delta) => {
    const next = [...order]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    commit(next)
  }

  // ── Drag-and-drop state ────────────────────────────────────
  const [dragKey, setDragKey] = useState(null)
  const [dropKey, setDropKey] = useState(null)
  const [dropPos, setDropPos] = useState(null)

  const onDragStart = (e, key) => {
    setDragKey(key)
    try { e.dataTransfer.setData('text/plain', key) } catch {}
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e, key) => {
    if (!dragKey || dragKey === key) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    setDropKey(key)
    setDropPos(e.clientY < mid ? 'above' : 'below')
  }

  const onDragLeave = (e, key) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (dropKey === key) { setDropKey(null); setDropPos(null) }
  }

  const onDrop = (e, key) => {
    e.preventDefault()
    if (!dragKey || dragKey === key) {
      setDragKey(null); setDropKey(null); setDropPos(null)
      return
    }
    const fromIdx = order.indexOf(dragKey)
    const toIdxRaw = order.indexOf(key)
    if (fromIdx < 0 || toIdxRaw < 0) {
      setDragKey(null); setDropKey(null); setDropPos(null)
      return
    }
    const without = order.filter(k => k !== dragKey)
    const targetSlot = without.indexOf(key) + (dropPos === 'below' ? 1 : 0)
    const next = [...without.slice(0, targetSlot), dragKey, ...without.slice(targetSlot)]
    commit(next)
    setDragKey(null); setDropKey(null); setDropPos(null)
  }

  const onDragEnd = () => {
    setDragKey(null); setDropKey(null); setDropPos(null)
  }

  return (
    <div className="p-4">
      <div className="space-y-1.5">
        {order.map((key, idx) => {
          const isDragging = dragKey === key
          const showLineAbove = dropKey === key && dropPos === 'above'
          const showLineBelow = dropKey === key && dropPos === 'below'
          return (
            <div key={key} className="relative">
              {showLineAbove && <div className="absolute left-0 right-0 -top-1 h-0.5 bg-primary rounded-full" aria-hidden/>}
              <div
                draggable
                onDragStart={(e) => onDragStart(e, key)}
                onDragOver={(e) => onDragOver(e, key)}
                onDragLeave={(e) => onDragLeave(e, key)}
                onDrop={(e) => onDrop(e, key)}
                onDragEnd={onDragEnd}
                className={[
                  'flex items-center gap-2 rounded-lg px-3 py-2 transition select-none',
                  isDragging ? 'opacity-40 bg-blue-50' : 'bg-slate-50 hover:bg-slate-100',
                ].join(' ')}>
                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing" aria-hidden/>
                <span className="text-xs font-mono text-slate-400 w-6 text-right">{idx + 1}.</span>
                <span className="flex-1 text-sm text-slate-700 truncate">
                  {labelFor(key)}
                  {isCustom(key) && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">Custom</span>}
                </span>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-slate-500 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded hover:bg-white transition"
                  title="Move up"
                  aria-label="Move up">
                  <ChevronUp className="w-4 h-4"/>
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === order.length - 1}
                  className="text-slate-500 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded hover:bg-white transition"
                  title="Move down"
                  aria-label="Move down">
                  <ChevronDown className="w-4 h-4"/>
                </button>
              </div>
              {showLineBelow && <div className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary rounded-full" aria-hidden/>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Backward-compatible Card wrapper.
function SectionOrderCard({ rxForm, setRxForm }) {
  return (
    <Card title="Section Order" subtitle="Drag rows to reorder sections on the writing form and the printed Rx. Or use the ↑ ↓ buttons. Custom fields can be moved too.">
      <SectionOrderBody rxForm={rxForm} setRxForm={setRxForm}/>
    </Card>
  )
}
