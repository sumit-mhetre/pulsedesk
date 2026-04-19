import { useState } from 'react'
import { Save, Lock } from 'lucide-react'
import { Card, Button, PageHeader, Badge } from '../../components/ui'
import useAuthStore from '../../store/authStore'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '',
    qualification: user?.qualification || '',
    specialization: user?.specialization || '',
    regNo: user?.regNo || '',
  })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [passError, setPassError] = useState('')

  const handleProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put('/users/me', form)
      setUser({ ...user, ...data.data })
      toast.success('Profile updated!')
    } catch {
    } finally { setSaving(false) }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setPassError('')
    if (passForm.newPassword !== passForm.confirm) {
      setPassError('Passwords do not match')
      return
    }
    if (passForm.newPassword.length < 6) {
      setPassError('New password must be at least 6 characters')
      return
    }
    setSavingPass(true)
    try {
      await api.put('/auth/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      })
      toast.success('Password changed successfully!')
      setPassForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch {
    } finally { setSavingPass(false) }
  }

  return (
    <div className="fade-in">
      <PageHeader title="My Profile" subtitle="Manage your personal information and password" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile info */}
        <Card title="Personal Information">
          <div className="flex items-center gap-4 mb-6 p-4 bg-background rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-3xl">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">{user?.name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="primary">{user?.role}</Badge>
                {user?.clinic?.subscriptionPlan && (
                  <Badge variant="accent">{user?.clinic?.subscriptionPlan}</Badge>
                )}
              </div>
            </div>
          </div>
          <form onSubmit={handleProfile}>
            <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm(s => ({ ...s, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Qualification</label><input className="form-input" value={form.qualification} onChange={e => setForm(s => ({ ...s, qualification: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Specialization</label><input className="form-input" value={form.specialization} onChange={e => setForm(s => ({ ...s, specialization: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Registration No.</label><input className="form-input" value={form.regNo} onChange={e => setForm(s => ({ ...s, regNo: e.target.value }))} /></div>
            <div className="flex justify-end mt-2">
              <Button type="submit" variant="primary" loading={saving} icon={<Save className="w-4 h-4" />}>
                Save Profile
              </Button>
            </div>
          </form>
        </Card>

        {/* Change password */}
        <Card title="Change Password">
          <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Lock className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-xs text-slate-600">For security, choose a strong password with at least 6 characters.</p>
          </div>
          <form onSubmit={handlePassword}>
            <div className="form-group"><label className="form-label">Current Password</label><input type="password" className="form-input" value={passForm.currentPassword} onChange={e => setPassForm(s => ({ ...s, currentPassword: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-input" value={passForm.newPassword} onChange={e => setPassForm(s => ({ ...s, newPassword: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" className="form-input" value={passForm.confirm} onChange={e => setPassForm(s => ({ ...s, confirm: e.target.value }))} /></div>
            {passError && <p className="text-sm text-danger mb-3">{passError}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="outline" loading={savingPass} icon={<Lock className="w-4 h-4" />}>
                Change Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}