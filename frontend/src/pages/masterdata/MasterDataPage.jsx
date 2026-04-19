import { useEffect, useState, useCallback } from 'react'
import {
  Pill, FlaskConical, MessageSquare, Stethoscope,
  Lightbulb, Receipt, Clock, Timer,
  Plus, Search, Edit, Trash2, X, Check,
  Upload, ChevronDown,
} from 'lucide-react'
import { PageHeader, Button, Badge, Card, EmptyState, Modal } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

// ── Tab config ────────────────────────────────────────────
const TABS = [
  { key: 'medicines',     label: 'Medicines',      icon: Pill,          endpoint: '/master/medicines' },
  { key: 'labTests',      label: 'Lab Tests',      icon: FlaskConical,  endpoint: '/master/lab-tests' },
  { key: 'complaints',    label: 'Complaints',     icon: MessageSquare, endpoint: '/master/complaints' },
  { key: 'diagnoses',     label: 'Diagnoses',      icon: Stethoscope,   endpoint: '/master/diagnoses' },
  { key: 'advice',        label: 'Advice',         icon: Lightbulb,     endpoint: '/master/advice' },
  { key: 'billingItems',  label: 'Billing Items',  icon: Receipt,       endpoint: '/master/billing-items' },
  { key: 'dosage',        label: 'Dosage Options', icon: Clock,         endpoint: '/master/dosage-options' },
  { key: 'timing',        label: 'Timing Options', icon: Timer,         endpoint: '/master/timing-options' },
]

const MEDICINE_TYPES = ['tablet','capsule','liquid','drops','cream','sachet','injection','inhaler','powder']
const typeColors = {
  tablet:'primary', capsule:'secondary', liquid:'accent',
  drops:'success', cream:'warning', sachet:'gray',
  injection:'danger', inhaler:'primary', powder:'gray',
}

// ── Seed data importer ────────────────────────────────────
function SeedImporter({ onDone }) {
  const [loading, setLoading] = useState(false)

  const seedAll = async () => {
    setLoading(true)
    try {
      // Import seed data
      const seedData = await import('../../data/seedData.js')
      await api.post('/master/seed', {
        medicines:    seedData.medicines,
        labTests:     seedData.labTests,
        complaints:   seedData.complaints,
        diagnoses:    seedData.diagnoses,
        adviceOptions:seedData.adviceOptions,
        billingItems: seedData.billingItems,
      })
      toast.success('All master data loaded successfully!')
      onDone()
    } catch {
      toast.error('Failed to load seed data')
    } finally { setLoading(false) }
  }

  return (
    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between gap-4 mb-6">
      <div>
        <p className="font-semibold text-primary text-sm">Load Default Data</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Load 78 medicines, 25 lab tests, 30 complaints, 25 diagnoses, 24 advice options & 15 billing items in one click.
        </p>
      </div>
      <Button variant="primary" loading={loading} icon={<Upload className="w-4 h-4" />} onClick={seedAll}>
        Load All Data
      </Button>
    </div>
  )
}

// ── Medicine Form ─────────────────────────────────────────
function MedicineForm({ form, setForm, onSubmit, onCancel, saving, mode }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="col-span-2 form-group">
          <label className="form-label">Medicine Name *</label>
          <input className="form-input" placeholder="e.g. Paracetamol 500mg" required
            value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Type *</label>
          <select className="form-select" value={form.type || 'tablet'}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {MEDICINE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <input className="form-input" placeholder="e.g. Antibiotic"
            value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Default Dosage</label>
          <input className="form-input" placeholder="e.g. 1-0-1"
            value={form.defaultDosage || ''} onChange={e => setForm(f => ({ ...f, defaultDosage: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Default Days</label>
          <input type="number" className="form-input" placeholder="e.g. 5"
            value={form.defaultDays || ''} onChange={e => setForm(f => ({ ...f, defaultDays: e.target.value }))} />
        </div>
        <div className="col-span-2 form-group">
          <label className="form-label">Notes (English)</label>
          <input className="form-input" placeholder="e.g. 5ml twice daily after food"
            value={form.notesEn || ''} onChange={e => setForm(f => ({ ...f, notesEn: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes (Hindi)</label>
          <input className="form-input" placeholder="दिन में 2 बार"
            value={form.notesHi || ''} onChange={e => setForm(f => ({ ...f, notesHi: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes (Marathi)</label>
          <input className="form-input" placeholder="दिवसातून 2 वेळा"
            value={form.notesMr || ''} onChange={e => setForm(f => ({ ...f, notesMr: e.target.value }))} />
        </div>
      </div>
      <div className="modal-footer -mx-6 -mb-6 mt-2 rounded-b-2xl">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>
          {mode === 'edit' ? 'Save Changes' : 'Add Medicine'}
        </Button>
      </div>
    </form>
  )
}

// ── Multilingual Form (Complaints / Diagnoses / Advice) ───
function MultilingualForm({ form, setForm, onSubmit, onCancel, saving, mode, label }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label className="form-label">{label} (English) *</label>
        <input className="form-input" placeholder="English" required autoFocus
          value={form.nameEn || ''} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">{label} (Hindi)</label>
        <input className="form-input" placeholder="हिंदी"
          value={form.nameHi || ''} onChange={e => setForm(f => ({ ...f, nameHi: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">{label} (Marathi)</label>
        <input className="form-input" placeholder="मराठी"
          value={form.nameMr || ''} onChange={e => setForm(f => ({ ...f, nameMr: e.target.value }))} />
      </div>
      <div className="modal-footer -mx-6 -mb-6 mt-2 rounded-b-2xl">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>
          {mode === 'edit' ? 'Save Changes' : 'Add'}
        </Button>
      </div>
    </form>
  )
}

// ── Billing Item Form ─────────────────────────────────────
function BillingItemForm({ form, setForm, onSubmit, onCancel, saving, mode }) {
  const CATEGORIES = ['Consultation', 'Procedure', 'Injection', 'Diagnostic', 'Bed', 'Other']
  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label className="form-label">Item Name *</label>
        <input className="form-input" placeholder="e.g. Consultation Fee" required autoFocus
          value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Default Price (₹)</label>
        <input type="number" className="form-input" placeholder="0"
          value={form.defaultPrice || ''} onChange={e => setForm(f => ({ ...f, defaultPrice: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Category</label>
        <select className="form-select" value={form.category || ''}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          <option value="">Select Category</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="modal-footer -mx-6 -mb-6 mt-2 rounded-b-2xl">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>
          {mode === 'edit' ? 'Save Changes' : 'Add Item'}
        </Button>
      </div>
    </form>
  )
}

// ── Simple Form (Lab Tests / Dosage / Timing) ─────────────
function SimpleForm({ form, setForm, onSubmit, onCancel, saving, mode, tab }) {
  return (
    <form onSubmit={onSubmit}>
      {tab === 'labTests' && <>
        <div className="form-group">
          <label className="form-label">Test Name *</label>
          <input className="form-input" required autoFocus
            value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <input className="form-input" placeholder="e.g. Haematology"
            value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
        </div>
      </>}

      {tab === 'dosage' && <>
        <div className="form-group">
          <label className="form-label">Code *</label>
          <input className="form-input" placeholder="e.g. 1-0-1" required autoFocus
            value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Label</label>
          <input className="form-input" placeholder="e.g. Twice daily"
            value={form.label || ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Times Per Day</label>
          <input type="number" className="form-input" placeholder="e.g. 2"
            value={form.timesPerDay || ''} onChange={e => setForm(f => ({ ...f, timesPerDay: e.target.value }))} />
        </div>
      </>}

      {tab === 'timing' && <>
        <div className="form-group">
          <label className="form-label">Code *</label>
          <input className="form-input" placeholder="e.g. AF" required autoFocus
            value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Label (English) *</label>
          <input className="form-input" placeholder="After Food" required
            value={form.labelEn || ''} onChange={e => setForm(f => ({ ...f, labelEn: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Label (Hindi)</label>
          <input className="form-input" placeholder="खाने के बाद"
            value={form.labelHi || ''} onChange={e => setForm(f => ({ ...f, labelHi: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Label (Marathi)</label>
          <input className="form-input" placeholder="जेवणानंतर"
            value={form.labelMr || ''} onChange={e => setForm(f => ({ ...f, labelMr: e.target.value }))} />
        </div>
      </>}

      <div className="modal-footer -mx-6 -mb-6 mt-2 rounded-b-2xl">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>Add</Button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function MasterDataPage() {
  const [activeTab, setActiveTab]   = useState('medicines')
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [modal, setModal]           = useState(null)
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const [showSeed, setShowSeed]     = useState(false)

  const currentTab = TABS.find(t => t.key === activeTab)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const { data } = await api.get(`${currentTab.endpoint}${params}`)
      setItems(data.data)
    } catch {
    } finally { setLoading(false) }
  }, [activeTab, search])

  useEffect(() => {
    const t = setTimeout(fetchItems, 300)
    return () => clearTimeout(t)
  }, [fetchItems])

  useEffect(() => { setSearch(''); setItems([]); setLoading(true) }, [activeTab])

  const openCreate = () => { setForm({}); setSelected(null); setModal('create') }
  const openEdit   = (item) => { setSelected(item); setForm({ ...item }); setModal('edit') }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal === 'edit') {
        await api.put(`${currentTab.endpoint}/${selected.id}`, form)
        toast.success('Updated!')
      } else {
        await api.post(currentTab.endpoint, form)
        toast.success('Added!')
      }
      setModal(null)
      fetchItems()
    } catch {
    } finally { setSaving(false) }
  }

  const handleRemove = async (item) => {
    if (!window.confirm(`Remove "${item.name || item.nameEn || item.code || item.labelEn}"?`)) return
    try {
      await api.delete(`${currentTab.endpoint}/${item.id}`)
      toast.success('Removed!')
      fetchItems()
    } catch {}
  }

  const renderForm = () => {
    const props = { form, setForm, onSubmit: handleSave, onCancel: () => setModal(null), saving, mode: modal }
    if (activeTab === 'medicines')    return <MedicineForm {...props} />
    if (activeTab === 'billingItems') return <BillingItemForm {...props} />
    if (activeTab === 'dosage' || activeTab === 'timing' || activeTab === 'labTests')
      return <SimpleForm {...props} tab={activeTab} />
    return <MultilingualForm {...props} label={currentTab?.label.replace(/s$/, '')} />
  }

  const renderItem = (item) => {
    if (activeTab === 'medicines') return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant={typeColors[item.type] || 'gray'}>{item.type}</Badge>
          <div className="min-w-0">
            <p className="font-medium text-slate-700 text-sm truncate">{item.name}</p>
            <p className="text-xs text-slate-400">
              {[item.category, item.defaultDosage, item.defaultDays && `${item.defaultDays}d`].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => openEdit(item)} className="btn-ghost btn-icon btn-sm"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )

    if (activeTab === 'billingItems') return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div className="flex items-center gap-3">
          <Badge variant="accent">{item.category || 'Other'}</Badge>
          <p className="font-medium text-slate-700 text-sm">{item.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-success text-sm">₹{item.defaultPrice}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => openEdit(item)} className="btn-ghost btn-icon btn-sm"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    )

    if (activeTab === 'dosage') return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-primary bg-blue-50 px-2.5 py-1 rounded-lg text-sm">{item.code}</span>
          <p className="text-sm text-slate-600">{item.label}</p>
        </div>
        <div className="flex items-center gap-3">
          {item.timesPerDay && <Badge variant="gray">{item.timesPerDay}x/day</Badge>}
          <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )

    if (activeTab === 'timing') return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-accent bg-cyan-50 px-2.5 py-1 rounded-lg text-sm">{item.code}</span>
          <div>
            <p className="text-sm font-medium text-slate-700">{item.labelEn}</p>
            <p className="text-xs text-slate-400">{[item.labelHi, item.labelMr].filter(Boolean).join(' • ')}</p>
          </div>
        </div>
        <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger opacity-0 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    )

    if (activeTab === 'labTests') return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div className="flex items-center gap-3">
          {item.category && <Badge variant="primary">{item.category}</Badge>}
          <p className="font-medium text-slate-700 text-sm">{item.name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => openEdit(item)} className="btn-ghost btn-icon btn-sm"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )

    // Multilingual items (complaints, diagnoses, advice)
    return (
      <div key={item.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors group">
        <div>
          <p className="font-medium text-slate-700 text-sm">{item.nameEn}</p>
          <p className="text-xs text-slate-400">{[item.nameHi, item.nameMr].filter(Boolean).join(' • ')}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => openEdit(item)} className="btn-ghost btn-icon btn-sm"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleRemove(item)} className="btn-ghost btn-icon btn-sm text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <PageHeader title="Master Data" subtitle="Configure medicines, tests, complaints and all reference data" />

      {/* Seed banner */}
      {items.length === 0 && !loading && !search && (
        <SeedImporter onDone={fetchItems} />
      )}
      {items.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="sm" icon={<Upload className="w-4 h-4" />}
            onClick={() => setShowSeed(s => !s)}>Load Default Data</Button>
        </div>
      )}
      {showSeed && <SeedImporter onDone={() => { setShowSeed(false); fetchItems() }} />}

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-52 flex-shrink-0">
          <Card className="p-2">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                  ${activeTab === tab.key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-primary'}`}>
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
                {activeTab === tab.key && items.length > 0 && (
                  <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{items.length}</span>
                )}
              </button>
            ))}
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Card>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <currentTab.icon className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-slate-700">{currentTab.label}</h2>
                <Badge variant="primary">{items.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input className="form-input pl-8 py-2 text-sm w-48"
                    placeholder="Search..."
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
                  Add
                </Button>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner text-primary w-7 h-7" /></div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<currentTab.icon className="w-7 h-7" />}
                title={`No ${currentTab.label} yet`}
                description="Click Add to create your first entry or load default data above"
                action={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add First</Button>}
              />
            ) : (
              <div className="divide-y divide-slate-50">
                {items.map(item => renderItem(item))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} size="md"
        title={`${modal === 'edit' ? 'Edit' : 'Add'} ${currentTab?.label.replace(/s$/, '')}`}>
        {renderForm()}
      </Modal>
    </div>
  )
}
