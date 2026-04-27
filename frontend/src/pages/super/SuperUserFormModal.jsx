import { useState, useEffect } from 'react'
import { Modal, Button } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  getDefaultsForRole, resolvePermissions, computeOverrides,
} from '../../lib/permissions'
import PermissionsEditor from '../../components/PermissionsEditor'

export default function SuperUserFormModal({ clinicId, mode, initialUser, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    name: '', email: '', password: '',
    role: 'DOCTOR', phone: '',
    qualification: '', specialization: '', regNo: '',
    isActive: true,
  }))
  // Capabilities (permissions) — flat { key: bool }, always 14 keys
  const [permissions, setPermissions] = useState(() => getDefaultsForRole('DOCTOR'))
  const [errors, setErrors] = useState({})

  // Hydrate form + permissions when editing
  useEffect(() => {
    if (isEdit && initialUser) {
      setForm({
        name: initialUser.name || '',
        email: initialUser.email || '',
        password: '',                 // blank means "don't change"
        role: initialUser.role || 'DOCTOR',
        phone: initialUser.phone || '',
        qualification: initialUser.qualification || '',
        specialization: initialUser.specialization || '',
        regNo: initialUser.regNo || '',
        isActive: initialUser.isActive !== false,
      })
      // Resolve effective permissions = role defaults + saved overrides
      setPermissions(resolvePermissions({
        role: initialUser.role || 'DOCTOR',
        permissions: initialUser.permissions || {},
      }))
    } else {
      // Adding: start from role defaults
      setPermissions(getDefaultsForRole(form.role))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initialUser])

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [k]: value }))
    if (errors[k]) setErrors(prev => { const { [k]: _, ...rest } = prev; return rest })
    // When role changes mid-form, re-seed permissions with new role's defaults
    if (k === 'role') {
      setPermissions(getDefaultsForRole(value))
    }
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name = 'Required'
    else if (form.name.trim().length < 2) e.name = 'Must be at least 2 characters'
    if (!isEdit) {
      if (!form.email.trim()) e.email = 'Required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
      if (!form.password) e.password = 'Required'
      else if (form.password.length < 6) e.password = 'Min 6 characters'
    } else if (form.password && form.password.length < 6) {
      e.password = 'Min 6 characters (or leave blank to keep current)'
    }
    if (!['ADMIN', 'DOCTOR', 'RECEPTIONIST'].includes(form.role)) e.role = 'Pick a role'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // Compute overrides — only the keys that differ from role defaults
      const overrides = computeOverrides(form.role, permissions)

      if (isEdit) {
        const body = { ...form, permissions: overrides }
        if (!body.password) delete body.password
        delete body.email   // email locked on edit
        await api.patch(`/clinics/${clinicId}/users/${initialUser.id}`, body)
        toast.success('User updated')
      } else {
        await api.post(`/clinics/${clinicId}/users`, { ...form, permissions: overrides })
        toast.success('User created')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg || 'Failed to save'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={true} onClose={onClose} title={isEdit ? 'Edit User' : 'Add New User'} size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </>
      }>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="form-group sm:col-span-2">
          <label className="form-label">Full Name *</label>
          <input className={`form-input ${errors.name ? 'border-danger' : ''}`}
            placeholder="Dr. John Smith" value={form.name} onChange={set('name')}/>
          {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input type="email" className={`form-input ${errors.email ? 'border-danger' : ''}`}
            placeholder="user@clinic.com" value={form.email} onChange={set('email')}
            disabled={isEdit} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email}</p>}
          {isEdit && <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>}
        </div>

        <div className="form-group">
          <label className="form-label">{isEdit ? 'New Password (optional)' : 'Password *'}</label>
          <input type="password" className={`form-input ${errors.password ? 'border-danger' : ''}`}
            placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'}
            value={form.password} onChange={set('password')}/>
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Role *</label>
          <select className="form-select" value={form.role} onChange={set('role')}>
            <option value="DOCTOR">Doctor</option>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="ADMIN">Admin</option>
          </select>
          {errors.role && <p className="text-xs text-danger mt-1">{errors.role}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" placeholder="9876543210" value={form.phone} onChange={set('phone')}/>
        </div>

        {form.role === 'DOCTOR' && (
          <>
            <div className="form-group">
              <label className="form-label">Qualification</label>
              <input className="form-input" placeholder="MBBS, MD" value={form.qualification} onChange={set('qualification')}/>
            </div>
            <div className="form-group">
              <label className="form-label">Specialization</label>
              <input className="form-input" placeholder="General Physician" value={form.specialization} onChange={set('specialization')}/>
            </div>
            <div className="form-group sm:col-span-2">
              <label className="form-label">Registration No.</label>
              <input className="form-input" placeholder="MH-12345" value={form.regNo} onChange={set('regNo')}/>
            </div>
          </>
        )}

        {isEdit && (
          <div className="form-group sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={form.isActive} onChange={set('isActive')}/>
              <span className="text-sm font-medium text-slate-700">Account is active</span>
              <span className="text-xs text-slate-400">— uncheck to disable login</span>
            </label>
          </div>
        )}

        {/* Capabilities editor (formerly "Permissions") */}
        <PermissionsEditor role={form.role} permissions={permissions} setPermissions={setPermissions}/>
      </div>
    </Modal>
  )
}
