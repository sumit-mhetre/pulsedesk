import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Save } from 'lucide-react'
import { Card, Button, PageHeader, Badge, ConfirmDialog } from '../../components/ui'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function SuperCreateClinic() {
  const navigate = useNavigate()
  const [createAdmin, setCreateAdmin] = useState(true)   // toggle: create clinic admin user?
  const [form, setForm] = useState({
    name: '', address: '', phone: '', mobile: '', email: '', tagline: '', gst: '',
    subscriptionPlan: 'Basic',
    adminName: '', adminEmail: '', adminPassword: '', adminPhone: '',
  })
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
  const { setDirty, confirmProps, guardedAction } = useUnsavedChanges()

  // Mark form as dirty whenever a field changes
  const f = (k) => (e) => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setDirty(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Strip admin fields if user opted out
      const body = createAdmin ? form : {
        ...form,
        adminName: '', adminEmail: '', adminPassword: '', adminPhone: '',
      }
      const { data } = await api.post('/clinics', body)
      setDirty(false)
      setCreated({ ...data.data, createAdmin })
      toast.success(createAdmin ? 'Clinic + admin created!' : 'Clinic created — manage it from Super Admin')
    } catch {
    } finally { setSaving(false) }
  }

  if (created) return (
    <div className="fade-in max-w-xl mx-auto">
      <div className="card text-center">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Clinic Created! 🎉</h2>
        <p className="text-slate-500 text-sm mb-6">
          {created.admin
            ? 'Share these details with the clinic admin.'
            : 'No admin account created — manage this clinic from Super Admin → Manage button.'}
        </p>

        <div className="bg-background rounded-2xl p-5 text-left space-y-3 mb-6">
          {[
            { label: 'Clinic Name', value: created.clinic.name },
            { label: 'Clinic ID',   value: created.clinic.id, mono: true },
            ...(created.admin ? [{ label: 'Admin Email', value: created.admin.email }] : []),
            { label: 'Plan',        value: created.clinic.subscriptionPlan, badge: true },
          ].map(({ label, value, mono, badge }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
              {badge
                ? <Badge variant="primary">{value}</Badge>
                : <span className={`text-sm font-medium text-slate-700 ${mono ? 'font-mono text-xs bg-white px-2 py-1 rounded-lg border border-slate-200' : ''}`}>{value}</span>
              }
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/super/clinics')}>View All Clinics</Button>
          <Button variant="primary" onClick={() => { setCreated(null); setForm({ name:'',address:'',phone:'',mobile:'',email:'',tagline:'',gst:'',subscriptionPlan:'Basic',adminName:'',adminEmail:'',adminPassword:'',adminPhone:'' }); setCreateAdmin(true) }}>
            Create Another
          </Button>
        </div>
      </div>
    </div>
  )


  return (
    <div className="fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => guardedAction(() => navigate('/super/clinics'))} className="btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader title="Create New Clinic" subtitle="Register a new clinic on SimpleRx EMR" />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Admin toggle — controls whether Admin Account card is required */}
        <Card className="mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 mt-0.5"
              checked={createAdmin}
              onChange={(e) => { setCreateAdmin(e.target.checked); setDirty(true) }}
            />
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">Create admin account for this clinic</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {createAdmin
                  ? 'A clinic admin will be created with login credentials. The clinic can manage themselves.'
                  : 'No admin account. You (Super Admin) will manage this clinic via the Manage button on the All Clinics page.'}
              </p>
            </div>
          </label>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Clinic info */}
          <Card title="Clinic Information">
            <div className="form-group"><label className="form-label">Clinic Name *</label><input type="text" className="form-input" placeholder="Sharma Medical Clinic" required value={form["name"]} onChange={f("name")}/></div>
            <div className="form-group"><label className="form-label">Address</label><input type="text" className="form-input" placeholder="Full address" value={form["address"]} onChange={f("address")}/></div>
            <div className="form-group"><label className="form-label">Mobile</label><input type="text" className="form-input" placeholder="9876543210" value={form["mobile"]} onChange={f("mobile")}/></div>
            <div className="form-group"><label className="form-label">Landline</label><input type="text" className="form-input" placeholder="020-27654321" value={form["phone"]} onChange={f("phone")}/></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="clinic@email.com" value={form["email"]} onChange={f("email")}/></div>
            <div className="form-group"><label className="form-label">Tagline</label><input type="text" className="form-input" placeholder="Your Health, Our Priority" value={form["tagline"]} onChange={f("tagline")}/></div>
            <div className="form-group"><label className="form-label">GST Number</label><input type="text" className="form-input" placeholder="27AABCS1429B1Z1" value={form["gst"]} onChange={f("gst")}/></div>
            <div className="form-group">
              <label className="form-label">Subscription Plan *</label>
              <select className="form-select" value={form.subscriptionPlan} onChange={f('subscriptionPlan')}>
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Pro">Pro</option>
              </select>
            </div>
          </Card>

          {/* Admin account — only when createAdmin is true */}
          {createAdmin ? (
            <Card title="Admin Account">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                <p className="text-xs text-slate-600">
                  This creates the first admin user for the clinic. They can add more users after logging in.
                </p>
              </div>
              <div className="form-group"><label className="form-label">Admin Name *</label><input type="text" className="form-input" placeholder="Dr. Rajesh Sharma" required value={form["adminName"]} onChange={f("adminName")}/></div>
              <div className="form-group"><label className="form-label">Admin Email *</label><input type="email" className="form-input" placeholder="admin@clinic.com" required value={form["adminEmail"]} onChange={f("adminEmail")}/></div>
              <div className="form-group"><label className="form-label">Admin Password *</label><input type="password" className="form-input" placeholder="Min 6 characters" required value={form["adminPassword"]} onChange={f("adminPassword")}/></div>
              <div className="form-group"><label className="form-label">Admin Phone</label><input type="text" className="form-input" placeholder="9876543210" value={form["adminPhone"]} onChange={f("adminPhone")}/></div>
            </Card>
          ) : (
            <Card title="Super Admin Managed">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-900 space-y-2">
                <p className="font-semibold">No admin account will be created.</p>
                <p>You (Super Admin) will manage this clinic via the <strong>Manage</strong> button on the All Clinics page — Info, Users, Stats, Plan changes, etc.</p>
                <p>You can add doctors and receptionists to this clinic any time from the Manage modal's Users tab.</p>
              </div>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => guardedAction(() => navigate('/super/clinics'))}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} icon={<Save className="w-4 h-4" />}>
            Create Clinic
          </Button>
        </div>
      </form>

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}