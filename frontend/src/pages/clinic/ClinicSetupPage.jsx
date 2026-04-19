import { useEffect, useState } from 'react'
import { Save, Building2 } from 'lucide-react'
import { Card, Button, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function ClinicSetupPage() {
  const [form, setForm] = useState({
    name: '', address: '', phone: '', mobile: '',
    email: '', tagline: '', gst: '',
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    api.get('/clinics/me').then(({ data }) => {
      const c = data.data
      setForm({
        name:     c.name || '',
        address:  c.address || '',
        phone:    c.phone || '',
        mobile:   c.mobile || '',
        email:    c.email || '',
        tagline:  c.tagline || '',
        gst:      c.gst || '',
      })
    }).finally(() => setFetching(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/clinics/me', form)
      toast.success('Clinic details updated!')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const field = (key, label, placeholder, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className="form-input"
        placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  )

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner text-primary w-8 h-8" />
    </div>
  )

  return (
    <div className="fade-in">
      <PageHeader
        title="Clinic Setup"
        subtitle="Manage your clinic's basic information"
      />
      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Basic Information">
            {field('name',    'Clinic Name *',   'e.g. Sharma Medical Clinic')}
            {field('tagline', 'Tagline',         'e.g. Your Health, Our Priority')}
            {field('address', 'Address',         'Full clinic address')}
            {field('gst',     'GST Number',      'e.g. 27AABCS1429B1Z1')}
          </Card>

          <Card title="Contact Details">
            {field('phone',  'Landline',      'e.g. 020-27654321')}
            {field('mobile', 'Mobile *',      'e.g. 9876543210', 'tel')}
            {field('email',  'Email Address', 'clinic@email.com', 'email')}

            <div className="mt-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-primary mb-1">Your Clinic ID</p>
              <p className="text-xs text-slate-500">
                Share this with your staff so they can log in.
              </p>
            </div>
          </Card>
        </div>

        <div className="flex justify-end mt-6">
          <Button type="submit" variant="primary" loading={loading} icon={<Save className="w-4 h-4" />}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
