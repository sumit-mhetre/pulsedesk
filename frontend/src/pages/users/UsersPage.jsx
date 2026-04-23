import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, UserCheck, Edit, Key, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react'
import { Card, Button, Modal, Badge, PageHeader, EmptyState, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  PERMISSION_KEYS, PERMISSION_LABELS, PERMISSION_GROUPS,
  getDefaultsForRole, resolvePermissions, computeOverrides,
} from '../../lib/permissions'

const ROLES = ['DOCTOR', 'RECEPTIONIST', 'ADMIN']
const roleColors = { ADMIN: 'danger', DOCTOR: 'primary', RECEPTIONIST: 'accent' }

// ── Permissions editor — reusable block for both Create and Edit modals ──
function PermissionsEditor({ role, permissions, setPermissions }) {
  const defaults = useMemo(() => getDefaultsForRole(role), [role])

  // Count overrides (differences from role defaults)
  const overrideCount = useMemo(() => {
    let n = 0
    for (const k of PERMISSION_KEYS) {
      if (permissions[k] !== defaults[k]) n++
    }
    return n
  }, [permissions, defaults])

  const toggle = (key) => {
    setPermissions(p => ({ ...p, [key]: !p[key] }))
  }

  const resetToDefaults = () => {
    setPermissions({ ...defaults })
  }

  return (
    <div className="col-span-2 bg-blue-50/40 border border-blue-100 rounded-xl p-4 mt-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Permissions</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {overrideCount === 0
              ? `Using defaults for ${role}`
              : `${overrideCount} override${overrideCount === 1 ? '' : 's'} from ${role} defaults`}
          </p>
        </div>
        {overrideCount > 0 && (
          <button type="button" onClick={resetToDefaults}
            className="text-xs font-semibold text-primary hover:text-primary-dark inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3"/> Reset to defaults
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PERMISSION_GROUPS.map(group => (
          <div key={group.label} className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="space-y-1.5">
              {group.keys.map(key => {
                const isOverride = permissions[key] !== defaults[key]
                return (
                  <label key={key} className={`flex items-center gap-2 text-sm cursor-pointer select-none ${isOverride ? 'font-semibold' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!permissions[key]}
                      onChange={() => toggle(key)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    <span className={isOverride ? 'text-primary' : 'text-slate-700'}>
                      {PERMISSION_LABELS[key]}
                    </span>
                    {isOverride && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">CUSTOM</span>}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modal, setModal] = useState(null)        // 'create' | 'edit' | 'reset'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [permissions, setPermissions] = useState({})  // flat { key: bool } — always 12 keys
  const [saving, setSaving] = useState(false)

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
    setModal('create')
  }

  const openEdit = (user) => {
    setSelected(user)
    setForm({
      name: user.name, phone: user.phone || '',
      qualification: user.qualification || '', specialization: user.specialization || '',
      regNo: user.regNo || '', role: user.role, isActive: user.isActive,
    })
    // Resolve current permissions (defaults merged with overrides) for display
    setPermissions(resolvePermissions(user))
    setModal('edit')
  }

  const openReset = (user) => { setSelected(user); setForm({ newPassword: '' }); setModal('reset') }

  // When role changes mid-form, re-seed permissions with new role's defaults
  const changeRole = (newRole) => {
    setForm(f => ({ ...f, role: newRole }))
    setPermissions(getDefaultsForRole(newRole))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const overrides = computeOverrides(form.role, permissions)
      await api.post('/users', { ...form, permissions: overrides })
      toast.success('User created successfully!')
      setModal(null)
      fetchUsers()
    } catch {
    } finally { setSaving(false) }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const overrides = computeOverrides(form.role, permissions)
      await api.put(`/users/${selected.id}`, { ...form, permissions: overrides })
      toast.success('User updated!')
      setModal(null)
      fetchUsers()
    } catch {
    } finally { setSaving(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/users/${selected.id}/reset-password`, form)
      toast.success('Password reset!')
      setModal(null)
    } catch {
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
          <div className="col-span-2"><div className="form-group"><label className="form-label">Full Name *</label><input type="text" className="form-input" placeholder="Dr. John Smith" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div></div>
          <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" placeholder="doctor@clinic.com" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" placeholder="Min 6 characters" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={form.role || ''} onChange={e => changeRole(e.target.value)}>{ROLES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
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
          <div className="col-span-2"><div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div></div>
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
            <input type="password" className="form-input" placeholder="Min 6 characters"
              value={form.newPassword || ''}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}/>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            The user's existing sessions will remain active. They'll need to use the new password next time they log in.
          </p>
        </form>
      </Modal>
    </div>
  )
}
