import { useEffect, useState } from 'react'
import { Plus, Search, UserCheck, Edit, Key, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, Button, Modal, Badge, PageHeader, EmptyState, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

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
    setForm({ name: '', email: '', password: '', role: 'DOCTOR', phone: '', qualification: '', specialization: '', regNo: '' })
    setModal('create')
  }

  const openEdit = (user) => {
    setSelected(user)
    setForm({ name: user.name, phone: user.phone || '', qualification: user.qualification || '', specialization: user.specialization || '', regNo: user.regNo || '', role: user.role, isActive: user.isActive })
    setModal('edit')
  }

  const openReset = (user) => { setSelected(user); setForm({ newPassword: '' }); setModal('reset') }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/users', form)
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
      await api.put(`/users/${selected.id}`, form)
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
      toast.success('Password reset successfully!')
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
        title="User Management"
        subtitle="Manage doctors, receptionists and admins"
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Add User
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="form-input pl-9"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-select sm:w-44" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner text-primary w-8 h-8" /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={<UserCheck className="w-8 h-8" />} title="No users found"
            description="Add doctors, receptionists or admins to get started"
            action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Add First User</Button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{u.name}</p>
                          {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-500 text-sm">{u.email}</td>
                    <td><Badge variant={roleColors[u.role] || 'gray'}>{u.role}</Badge></td>
                    <td className="text-sm text-slate-500">{u.specialization || '—'}</td>
                    <td>
                      <Badge variant={u.isActive ? 'success' : 'gray'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="btn-ghost btn-icon btn-sm" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => openReset(u)} className="btn-ghost btn-icon btn-sm" title="Reset Password">
                          <Key className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(u)} className="btn-ghost btn-icon btn-sm" title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive
                            ? <ToggleRight className="w-4 h-4 text-success" />
                            : <ToggleLeft className="w-4 h-4 text-slate-400" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Add New User" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleCreate}>Create User</Button>
        </>}
      >
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2"><div className="form-group"><label className="form-label">Full Name *</label><input type="text" className="form-input" placeholder="Dr. John Smith" value={form["name"] || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div></div>
          <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" placeholder="doctor@clinic.com" value={form["email"] || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" placeholder="Min 6 characters" value={form["password"] || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={form["role"] || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{ROLES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" placeholder="9876543210" value={form["phone"] || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Qualification</label><input type="text" className="form-input" placeholder="MBBS, MD" value={form["qualification"] || ''} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Specialization</label><input type="text" className="form-input" placeholder="General Physician" value={form["specialization"] || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}/></div>
          <div className="col-span-2"><div className="form-group"><label className="form-label">Registration No.</label><input type="text" className="form-input" placeholder="MH-12345" value={form["regNo"] || ''} onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))}/></div></div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={`Edit — ${selected?.name}`} size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleEdit}>Save Changes</Button>
        </>}
      >
        <form onSubmit={handleEdit} className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2"><div className="form-group"><label className="form-label">Full Name</label><input type="text" className="form-input" placeholder="" value={form["name"] || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div></div>
          <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form["role"] || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{ROLES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" placeholder="" value={form["phone"] || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Qualification</label><input type="text" className="form-input" placeholder="" value={form["qualification"] || ''} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}/></div>
          <div className="form-group"><label className="form-label">Specialization</label><input type="text" className="form-input" placeholder="" value={form["specialization"] || ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}/></div>
          <div className="col-span-2"><div className="form-group"><label className="form-label">Registration No.</label><input type="text" className="form-input" placeholder="" value={form["regNo"] || ''} onChange={e => setForm(f => ({ ...f, regNo: e.target.value }))}/></div></div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={modal === 'reset'} onClose={() => setModal(null)} title={`Reset Password — ${selected?.name}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={saving} onClick={handleReset}>Reset Password</Button>
        </>}
      >
        <div className="form-group"><label className="form-label">New Password *</label><input type="password" className="form-input" placeholder="Min 6 characters" value={form["newPassword"] || ''} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}/></div>
        <p className="text-xs text-slate-400 mt-1">The user will need to use this new password on next login.</p>
      </Modal>
    </div>
  )
}