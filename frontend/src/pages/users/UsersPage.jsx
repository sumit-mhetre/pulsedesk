import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, UserCheck, Edit, Key, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react'
import { Card, Button, Modal, Badge, PageHeader, EmptyState, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  PERMISSION_KEYS, PERMISSION_LABELS, PERMISSION_GROUPS,
  getDefaultsForRole, resolvePermissions, computeOverrides,
} from '../../lib/permissions'
import PermissionsEditor from '../../components/PermissionsEditor'

const ROLES = ['DOCTOR', 'RECEPTIONIST', 'ADMIN']
const roleColors = { ADMIN: 'danger', DOCTOR: 'primary', RECEPTIONIST: 'accent' }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modal, setModal] = useState(null)        // 'create' | 'edit' | 'reset'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [permissions, setPermissions] = useState({})  // flat { key: bool } — always 14 keys
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})  // field-level inline errors

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (search)     params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      const { data } = await api.get(`/users?${params}`)
      setUsers(data.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [search, roleFilter])

  const openCreate = () => {
    const initialRole = 'DOCTOR'
    setForm({ name: '', email: '', password: '', role: initialRole, phone: '', qualification: '', specialization: '', regNo: '' })
    setPermissions(getDefaultsForRole(initialRole))
    setErrors({})
    setModal('create')
  }

  const openEdit = (user) => {
    setSelected(user)
    setForm({
      name: user.name, phone: user.phone || '',
      qualification: user.qualification || '', specialization: user.specialization || '',
      regNo: user.regNo || '', role: user.role, isActive: user.isActive,
    })
    setPermissions(resolvePermissions(user))
    setErrors({})
    setModal('edit')
  }

  const openReset = (user) => { setSelected(user); setForm({ newPassword: '' }); setErrors({}); setModal('reset') }

  // ── Validation ──────────────────────────────────────────
  // Returns an errors map { fieldName: message }. Empty map = valid.
  const validateCreate = (f) => {
    const e = {}
    const name = (f.name || '').trim()
    if (!name)               e.name = 'Full name is required'
    else if (name.length < 2) e.name = 'Name must be at least 2 characters'

    const email = (f.email || '').trim()
    if (!email)                                          e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  e.email = 'Please enter a valid email address'

    const password = f.password || ''
    if (!password)                  e.password = 'Password is required'
    else if (password.length < 6)   e.password = 'Password must be at least 6 characters'

    const role = f.role
    if (!role || !['ADMIN','DOCTOR','RECEPTIONIST'].includes(role))
      e.role = 'Please select a role'

    return e
  }

  const validateEdit = (f) => {
    const e = {}
    const name = (f.name || '').trim()
    if (!name)               e.name = 'Full name is required'
    else if (name.length < 2) e.name = 'Name must be at least 2 characters'
    return e
  }

  const validateReset = (f) => {
    const e = {}
    const pw = f.newPassword || ''
    if (!pw)                e.newPassword = 'New password is required'
    else if (pw.length < 6) e.newPassword = 'Password must be at least 6 characters'
    return e
  }

  // When role changes mid-form, re-seed permissions with new role's defaults
  const changeRole = (newRole) => {
    setForm(f => ({ ...f, role: newRole }))
    setPermissions(getDefaultsForRole(newRole))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const errs = validateCreate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the errors below')
      // Scroll to first error if not visible
      const firstKey = Object.keys(errs)[0]
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return
    }
    setSaving(true)
    try {
      const overrides = computeOverrides(form.role, permissions)
      await api.post('/users', { ...form, permissions: overrides }, { silent: true })
      toast.success('User created successfully!')
      setModal(null)
      fetchUsers()
    } catch (err) {
      // Show backend's specific message (or first validation error from express-validator)
      const data = err?.response?.data
      const detailedMsg = data?.errors?.[0]?.msg || data?.message || 'Failed to create user'
      toast.error(detailedMsg)
      // If backend says email exists, mark email field
      if (typeof detailedMsg === 'string' && detailedMsg.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: detailedMsg }))
      }
    } finally { setSaving(false) }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    const errs = validateEdit(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the errors below')
      return
    }
    setSaving(true)
    try {
      const overrides = computeOverrides(form.role, permissions)
      await api.put(`/users/${selected.id}`, { ...form, permissions: overrides }, { silent: true })
      toast.success('User updated!')
      setModal(null)
      fetchUsers()
    } catch (err) {
      const data = err?.response?.data
      toast.error(data?.errors?.[0]?.msg || data?.message || 'Failed to update user')
    } finally { setSaving(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    const errs = validateReset(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the error below')
      return
    }
    setSaving(true)
    try {
      await api.post(`/users/${selected.id}/reset-password`, form, { silent: true })
      toast.success('Password reset!')
      setModal(null)
    } catch (err) {
      const data = err?.response?.data
      toast.error(data?.errors?.[0]?.msg || data?.message || 'Failed to reset password')
    } finally { setSaving(false) }
  }

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive })
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`)
      fetchUsers()
    } catch {}
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Users"
        subtitle={`${users.length} team member${users.length === 1 ? '' : 's'}`}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={openCreate}>
            Add User
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" className="form-input pl-10" placeholder="Search by name..."
              value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <select className="form-select sm:w-44" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <Card><div className="py-10 text-center text-slate-400">Loading...</div></Card>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-10 h-10"/>}
          title="No users found"
          description="Add your first team member to get started."
          action={<Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={openCreate}>Add User</Button>}
        />
      ) : (
        <Card noPadding>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{u.name}</p>
                    {u.qualification && <p className="text-xs text-slate-500">{u.qualification}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant={roleColors[u.role] || 'gray'}>{u.role}</Badge></td>
                  <td className="px-4 py-3">
                    {u.isActive
                      ? <Badge variant="success">Active</Badge>
                      : <Badge variant="gray">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(u)} title="Edit" className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50">
                        <Edit className="w-4 h-4"/>
                      </button>
                      <button onClick={() => openReset(u)} title="Reset Password" className="p-2 rounded-lg text-slate-400 hover:text-warning hover:bg-orange-50">
                        <Key className="w-4 h-4"/>
                      </button>
                      <button onClick={() => toggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'}
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50">
                        {u.isActive ? <ToggleRight className="w-4 h-4 text-success"/> : <ToggleLeft className="w-4 h-4"/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Add New User" size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} loading={saving}>Create User</Button>
        </>}>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" data-field="name"
                className={`form-input ${errors.name ? 'border-danger ring-1 ring-danger' : ''}`}
                placeholder="Dr. John Smith"
                value={form.name || ''}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: undefined })) }}/>
              {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" data-field="email"
              className={`form-input ${errors.email ? 'border-danger ring-1 ring-danger' : ''}`}
              placeholder="doctor@clinic.com"
              value={form.email || ''}
              onChange={e => { setForm(f => ({ ...f, email: e.target.value })); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}/>
            {errors.email && <p className="text-xs text-danger mt-1">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input type="password" data-field="password"
              className={`form-input ${errors.password ? 'border-danger ring-1 ring-danger' : ''}`}
              placeholder="Min 6 characters"
              value={form.password || ''}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}/>
            {errors.password && <p className="text-xs text-danger mt-1">{errors.password}</p>}
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select data-field="role"
              className={`form-select ${errors.role ? 'border-danger ring-1 ring-danger' : ''}`}
              value={form.role || ''}
              onChange={e => { changeRole(e.target.value); if (errors.role) setErrors(p => ({ ...p, role: undefined })) }}>
              {ROLES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.role && <p className="text-xs text-danger mt-1">{errors.role}</p>}
          </div>
          <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" placeholder="9876543210" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Qualification</label><input type="text" className="form-input" placeholder="MBBS, MD" value={form.qualification || ''} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Specialization</label><input type="text" className="form-input" placeholder="General Physician" value={form.specialization || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}/></div>
          <div className="col-span-2"><div className="form-group"><label className="form-label">Registration No.</label><input type="text" className="form-input" placeholder="MH-12345" value={form.regNo || ''} onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))}/></div></div>
          <PermissionsEditor role={form.role} permissions={permissions} setPermissions={setPermissions}/>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={`Edit — ${selected?.name || ''}`} size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleEdit} loading={saving}>Save Changes</Button>
        </>}>
        <form onSubmit={handleEdit} className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" data-field="name"
                className={`form-input ${errors.name ? 'border-danger ring-1 ring-danger' : ''}`}
                value={form.name || ''}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: undefined })) }}/>
              {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
            </div>
          </div>
          <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role || ''} onChange={e => changeRole(e.target.value)}>{ROLES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Qualification</label><input type="text" className="form-input" value={form.qualification || ''} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Specialization</label><input type="text" className="form-input" value={form.specialization || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}/></div>
          <div className="col-span-2"><div className="form-group"><label className="form-label">Registration No.</label><input type="text" className="form-input" value={form.regNo || ''} onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))}/></div></div>
          <PermissionsEditor role={form.role} permissions={permissions} setPermissions={setPermissions}/>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={modal === 'reset'} onClose={() => setModal(null)} title={`Reset Password — ${selected?.name || ''}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleReset} loading={saving}>Reset</Button>
        </>}>
        <form onSubmit={handleReset}>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input type="password" data-field="newPassword"
              className={`form-input ${errors.newPassword ? 'border-danger ring-1 ring-danger' : ''}`}
              placeholder="Min 6 characters"
              value={form.newPassword || ''}
              onChange={e => { setForm(f => ({ ...f, newPassword: e.target.value })); if (errors.newPassword) setErrors(p => ({ ...p, newPassword: undefined })) }}/>
            {errors.newPassword && <p className="text-xs text-danger mt-1">{errors.newPassword}</p>}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            The user's existing sessions will remain active. They'll need to use the new password next time they log in.
          </p>
        </form>
      </Modal>
    </div>
  )
}
