import { useEffect, useState } from 'react'
import { Save, Building2, FileText, Stethoscope } from 'lucide-react'
import { Card, Button, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { setGlobalDirty } from '../../hooks/useUnsavedChanges'

// ── Toggle switch ─────────────────────────────────────────
function Toggle({ checked, onChange, label, sub }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-4
          ${checked ? 'bg-primary' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform`}
          style={{transform: checked ? 'translateX(18px)' : 'translateX(2px)'}}/>
      </button>
    </div>
  )
}

const DEFAULT_RX_FORM = {
  showComplaint:  true,
  showDiagnosis:  true,
  showVitals:     false,
  showMedicines:  true,
  showLabTests:   true,
  showAdvice:     true,
  showNextVisit:  true,
  vitalBP:        true,
  vitalSugar:     true,
  vitalWeight:    true,
  vitalTemp:      true,
  vitalSpo2:      true,
  vitalPulse:     true,
  vitalHeight:    false,
  vitalBMI:       false,
}

const TABS = [
  { key: 'clinic',     label: 'Clinic Info',      icon: Building2 },
  { key: 'rxform',     label: 'Prescription Form', icon: FileText },
]

export default function ClinicSetupPage() {
  const [activeTab,  setActiveTab]  = useState('clinic')
  const [form,       setForm]       = useState({
    name: '', address: '', phone: '', mobile: '',
    email: '', tagline: '', gst: '', opdSeriesPrefix: '',
  })
  const [rxForm,    setRxForm]    = useState({ ...DEFAULT_RX_FORM })
  const [loading,   setLoading]   = useState(false)
  const [fetching,  setFetching]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/clinics/me'),
      api.get('/page-design?type=rx_form').catch(() => ({ data: { data: null } })),
    ]).then(([clinicRes, pdRes]) => {
      const c = clinicRes.data.data
      setForm({
        name:            c.name || '',
        address:         c.address || '',
        phone:           c.phone || '',
        mobile:          c.mobile || '',
        email:           c.email || '',
        tagline:         c.tagline || '',
        gst:             c.gst || '',
        opdSeriesPrefix: c.opdSeriesPrefix || '',
      })
      if (pdRes.data.data?.config) {
        setRxForm(f => ({ ...f, ...pdRes.data.data.config }))
      }
    }).finally(() => setFetching(false))
  }, [])

  const setField = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setGlobalDirty(true) }

  const handleSaveClinic = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/clinics/me', form)
      toast.success('Clinic details updated!')
      setGlobalDirty(false)
    } catch { toast.error('Failed to save') }
    finally { setLoading(false) }
  }

  const handleSaveRxForm = async () => {
    setLoading(true)
    try {
      // Save to page-design with merged config
      const existing = await api.get('/page-design?type=rx_form').catch(() => ({ data: { data: { config: {} } } }))
      const merged = { ...(existing.data.data?.config || {}), ...rxForm }
      await api.post('/page-design', { type: 'rx_form', config: merged })
      toast.success('Prescription form settings saved!')
      setGlobalDirty(false)
    } catch { toast.error('Failed to save') }
    finally { setLoading(false) }
  }

  const field = (key, label, placeholder, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} className="form-input" placeholder={placeholder}
        value={form[key]} onChange={setField(key)}/>
    </div>
  )

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner text-primary w-8 h-8"/>
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader title="Clinic Setup" subtitle="Manage clinic information and form preferences"/>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-100 pb-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4"/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Clinic Info Tab ── */}
      {activeTab === 'clinic' && (
        <form onSubmit={handleSaveClinic}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Basic Information">
              {field('name',    'Clinic Name *',       'e.g. Sharma Medical Clinic')}
              {field('tagline', 'Tagline',             'e.g. Your Health, Our Priority')}
              {field('address', 'Address',             'Full clinic address')}
              {field('gst',     'GST Number',          'e.g. 27AABCS1429B1Z1')}
              <div className="form-group">
                <label className="form-label">OPD Series Prefix</label>
                <input className="form-input font-mono" placeholder="e.g. MH, JK or MH1000"
                  value={form.opdSeriesPrefix||''} onChange={setField('opdSeriesPrefix')}/>
                <p className="text-xs text-slate-400 mt-1">
                  Patient codes: <strong className="font-mono">{form.opdSeriesPrefix||'SHA'}0001</strong>, <strong className="font-mono">{form.opdSeriesPrefix||'SHA'}0002</strong>...
                </p>
              </div>
            </Card>
            <Card title="Contact Details">
              {field('phone',  'Landline',      'e.g. 020-27654321')}
              {field('mobile', 'Mobile *',      'e.g. 9876543210', 'tel')}
              {field('email',  'Email Address', 'clinic@email.com', 'email')}
              <div className="mt-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-primary mb-1">Tip</p>
                <p className="text-xs text-slate-500">These details appear on prescription and bill headers.</p>
              </div>
            </Card>
          </div>
          <div className="flex justify-end mt-6">
            <Button type="submit" variant="primary" loading={loading} icon={<Save className="w-4 h-4"/>}>
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* ── Prescription Form Tab ── */}
      {activeTab === 'rxform' && (
        <div className="max-w-2xl space-y-5">
          <Card title="Prescription Sections" subtitle="Choose which sections appear while writing a prescription">
            <Toggle checked={rxForm.showComplaint}  onChange={v=>{setRxForm(f=>({...f,showComplaint:v}));setGlobalDirty(true)}}  label="Chief Complaint" sub="Patient's main complaints"/>
            <Toggle checked={rxForm.showDiagnosis}  onChange={v=>{setRxForm(f=>({...f,showDiagnosis:v}));setGlobalDirty(true)}}  label="Diagnosis"        sub="Clinical diagnosis"/>
            <Toggle checked={rxForm.showVitals}     onChange={v=>{setRxForm(f=>({...f,showVitals:v}));setGlobalDirty(true)}}     label="Vitals"           sub="BP, Sugar, Weight, Temp, SpO2, Pulse"/>
            <Toggle checked={rxForm.showMedicines}  onChange={v=>{setRxForm(f=>({...f,showMedicines:v}));setGlobalDirty(true)}}  label="Medicines"        sub="Prescription medicines table"/>
            <Toggle checked={rxForm.showLabTests}   onChange={v=>{setRxForm(f=>({...f,showLabTests:v}));setGlobalDirty(true)}}   label="Lab Tests"        sub="Diagnostic tests"/>
            <Toggle checked={rxForm.showAdvice}     onChange={v=>{setRxForm(f=>({...f,showAdvice:v}));setGlobalDirty(true)}}     label="Advice & Precautions" sub="Instructions to patient"/>
            <Toggle checked={rxForm.showNextVisit}  onChange={v=>{setRxForm(f=>({...f,showNextVisit:v}));setGlobalDirty(true)}}  label="Next Visit Date"  sub="Follow-up date"/>
          </Card>

          {rxForm.showVitals && (
            <Card title="Vitals Fields" subtitle="Choose which vital parameters to record">
              <Toggle checked={rxForm.vitalBP??true}      onChange={v=>{setRxForm(f=>({...f,vitalBP:v}));setGlobalDirty(true)}}      label="Blood Pressure"    sub="Systolic / Diastolic"/>
              <Toggle checked={rxForm.vitalSugar??true}   onChange={v=>{setRxForm(f=>({...f,vitalSugar:v}));setGlobalDirty(true)}}   label="Blood Sugar"       sub="mg/dL"/>
              <Toggle checked={rxForm.vitalWeight??true}  onChange={v=>{setRxForm(f=>({...f,vitalWeight:v}));setGlobalDirty(true)}}  label="Weight"            sub="kg"/>
              <Toggle checked={rxForm.vitalTemp??true}    onChange={v=>{setRxForm(f=>({...f,vitalTemp:v}));setGlobalDirty(true)}}    label="Temperature"       sub="°F"/>
              <Toggle checked={rxForm.vitalSpo2??true}    onChange={v=>{setRxForm(f=>({...f,vitalSpo2:v}));setGlobalDirty(true)}}    label="SpO2"              sub="Oxygen saturation %"/>
              <Toggle checked={rxForm.vitalPulse??true}   onChange={v=>{setRxForm(f=>({...f,vitalPulse:v}));setGlobalDirty(true)}}   label="Pulse Rate"        sub="bpm"/>
              <Toggle checked={rxForm.vitalHeight??false} onChange={v=>{setRxForm(f=>({...f,vitalHeight:v}));setGlobalDirty(true)}} label="Height"            sub="cm"/>
              <Toggle checked={rxForm.vitalBMI??false}    onChange={v=>{setRxForm(f=>({...f,vitalBMI:v}));setGlobalDirty(true)}}    label="BMI"               sub="Auto-calculated"/>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">These settings control the prescription writing form. For print settings, use Page Designer.</p>
            <Button variant="primary" loading={loading} icon={<Save className="w-4 h-4"/>} onClick={handleSaveRxForm}>
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
