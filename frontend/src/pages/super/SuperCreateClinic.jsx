import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Save } from 'lucide-react'
import { Card, Button, PageHeader, Badge } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function SuperCreateClinic() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', address: '', phone: '', mobile: '', email: '', tagline: '', gst: '',
    subscriptionPlan: 'Basic',
    adminName: '', adminEmail: '', adminPassword: '', adminPhone: '',
  })
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.post('/clinics', form)
      setCreated(data.data)
      toast.success('Clinic created successfully!')
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
        <p className="text-slate-500 text-sm mb-6">Share these details with the clinic admin.</p>

        <div className="bg-background rounded-2xl p-5 text-left space-y-3 mb-6">
          {[
            { label: 'Clinic Name', value: created.clinic.name },
            { label: 'Clinic ID',   value: created.clinic.id, mono: true },
            { label: 'Admin Email', value: created.admin.email },
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
          <Button variant="primary" onClick={() => { setCreated(null); setForm({ name:'',address:'',phone:'',mobile:'',email:'',tagline:'',gst:'',subscriptionPlan:'Basic',adminName:'',adminEmail:'',adminPassword:'',adminPhone:'' }) }}>
            Create Another
          </Button>
        </div>
      </div>
    </div>
  )


  return (
    <div className="fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/super/clinics')} className="btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader title="Create New Clinic" subtitle="Register a new clinic on SimpleRx EMR" />
      </div>

      <form onSubmit={handleSubmit}>
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

          {/* Admin account */}
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
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/super/clinics')}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} icon={<Save className="w-4 h-4" />}>
            Create Clinic
          </Button>
        </div>
      </form>
    </div>
  )
}