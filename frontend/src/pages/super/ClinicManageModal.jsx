import { useEffect, useState } from 'react'
import {
  X, Save, Building2, Users as UsersIcon, BarChart3, ShieldAlert,
  Mail, Phone, FileText, KeyRound, Power, Crown, Copy, AlertTriangle,
  UserPlus, Pencil,
} from 'lucide-react'
import { Modal, Card, Button, Badge, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import SuperUserFormModal from './SuperUserFormModal'

const TABS = [
  { key: 'info',    label: 'Info',    icon: Building2 },
  { key: 'users',   label: 'Users',   icon: UsersIcon },
  { key: 'stats',   label: 'Stats',   icon: BarChart3 },
  { key: 'actions', label: 'Actions', icon: ShieldAlert },
]

const planColors   = { Pro: 'success', Standard: 'accent', Basic: 'primary' }
const statusColors = { Active: 'success', Inactive: 'gray', Suspended: 'danger' }

export default function ClinicManageModal({ clinicId, onClose, onChanged }) {
  const [tab, setTab]           = useState('info')
  const [clinic, setClinic]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({})

  // Stats state
  const [stats, setStats]               = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [from, setFrom]                 = useState('')
  const [to, setTo]                     = useState('')

  // Reset password state
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting]               = useState(false)
  const [tempPassword, setTempPassword]         = useState(null)

  // Status confirm
  const [pendingStatus, setPendingStatus] = useState(null)

  // User form (Add/Edit)
  const [userForm, setUserForm] = useState(null)   // null | { mode: 'add' } | { mode: 'edit', user }

  // Refresh clinic detail (after user save)
  const refreshDetail = async () => {
    try {
      const { data } = await api.get(`/clinics/${clinicId}`)
      setClinic(data.data)
      onChanged?.()
    } catch {}
  }

  // ── Load clinic detail on open ─────────────────────────
  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get(`/clinics/${clinicId}`).then(({ data }) => {
      if (!alive) return
      setClinic(data.data)
      setForm({
        name:    data.data.name || '',
        address: data.data.address || '',
        mobile:  data.data.mobile || '',
        phone:   data.data.phone || '',
        email:   data.data.email || '',
        tagline: data.data.tagline || '',
        gst:     data.data.gst || '',
      })
    }).catch(() => toast.error('Failed to load clinic'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [clinicId])

  // ── Load stats when Stats tab opens (or filter changes) ─
  useEffect(() => {
    if (tab !== 'stats' || !clinic) return
    setStatsLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', new Date(from).toISOString())
    if (to)   params.set('to',   new Date(to).toISOString())
    api.get(`/clinics/${clinicId}/stats?${params}`)
      .then(({ data }) => setStats(data.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setStatsLoading(false))
  }, [tab, clinicId, from, to, clinic])

  // ── Save Info tab ──────────────────────────────────────
  const saveInfo = async () => {
    setSaving(true)
    try {
      await api.put(`/clinics/${clinicId}`, form)
      toast.success('Clinic updated')
      onChanged?.()
      // Reload to reflect any server-side normalization
      const { data } = await api.get(`/clinics/${clinicId}`)
      setClinic(data.data)
    } catch {} finally { setSaving(false) }
  }

  // ── Plan / Status (Actions tab) ────────────────────────
  const changePlan = async (plan) => {
    setSaving(true)
    try {
      await api.patch(`/clinics/${clinicId}/status`, { subscriptionPlan: plan })
      toast.success(`Plan changed to ${plan}`)
      setClinic(c => ({ ...c, subscriptionPlan: plan }))
      onChanged?.()
    } catch {} finally { setSaving(false) }
  }

  const changeStatus = async (status) => {
    setSaving(true)
    try {
      await api.patch(`/clinics/${clinicId}/status`, { status })
      toast.success(`Clinic ${status === 'Active' ? 'activated' : status.toLowerCase()}`)
      setClinic(c => ({ ...c, status }))
      onChanged?.()
    } catch {} finally { setSaving(false); setPendingStatus(null) }
  }

  const resetPassword = async () => {
    setResetting(true)
    setShowResetConfirm(false)
    try {
      const { data } = await api.post(`/clinics/${clinicId}/reset-admin-password`)
      setTempPassword({ email: data.data.adminEmail, name: data.data.adminName, password: data.data.tempPassword })
      toast.success('Password reset — share with admin securely')
    } catch {} finally { setResetting(false) }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => {})
  }

  const isInactive = stats?.activity?.isInactive
  const lastRx = stats?.activity?.lastPrescription

  // ── Render ─────────────────────────────────────────────
  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal max-w-4xl">
          {/* Custom header with status badges */}
          <div className="modal-header">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="modal-title truncate">{clinic?.name || 'Loading…'}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {clinic?.subscriptionPlan && <Badge variant={planColors[clinic.subscriptionPlan]}>{clinic.subscriptionPlan}</Badge>}
                  {clinic?.status         && <Badge variant={statusColors[clinic.status]}>{clinic.status}</Badge>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost btn-icon text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-100 px-6">
            <div className="flex gap-1 -mb-px">
              {TABS.map(t => {
                const active = tab === t.key
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                      ${active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Body */}
          <div className="modal-body">
            {loading ? (
              <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
            ) : (
              <>
                {/* ─── INFO TAB ─── */}
                {tab === 'info' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">Clinic Name</label>
                      <input className="form-input" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile</label>
                      <input className="form-input" value={form.mobile}
                        onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone (Landline)</label>
                      <input className="form-input" value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="form-group sm:col-span-2">
                      <label className="form-label">Address</label>
                      <textarea className="form-input" rows={2} value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tagline</label>
                      <input className="form-input" value={form.tagline}
                        onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GST Number</label>
                      <input className="form-input" value={form.gst}
                        onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} />
                    </div>
                  </div>
                )}

                {/* ─── USERS TAB ─── */}
                {tab === 'users' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-500">{clinic.users?.length || 0} user{(clinic.users?.length || 0) === 1 ? '' : 's'} in this clinic</p>
                      <Button variant="primary" size="sm"
                        icon={<UserPlus className="w-3.5 h-3.5"/>}
                        onClick={() => setUserForm({ mode: 'add' })}>
                        Add User
                      </Button>
                    </div>
                    {!clinic.users || clinic.users.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-400 text-sm mb-3">No users yet — clinic has no admin or staff accounts.</p>
                        <Button variant="outline" size="sm"
                          icon={<UserPlus className="w-3.5 h-3.5"/>}
                          onClick={() => setUserForm({ mode: 'add' })}>
                          Add first user
                        </Button>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>User</th><th>Role</th><th>Status</th><th>Created</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinic.users.map(u => (
                              <tr key={u.id}>
                                <td>
                                  <div>
                                    <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                                    <p className="text-xs text-slate-500"><Mail className="w-3 h-3 inline mr-1"/>{u.email}</p>
                                    {u.phone && <p className="text-xs text-slate-400"><Phone className="w-3 h-3 inline mr-1"/>{u.phone}</p>}
                                  </div>
                                </td>
                                <td>
                                  <Badge variant={u.role === 'ADMIN' ? 'success' : u.role === 'DOCTOR' ? 'primary' : 'gray'}>
                                    {u.role}
                                  </Badge>
                                </td>
                                <td>
                                  <Badge variant={u.isActive ? 'success' : 'gray'}>
                                    {u.isActive ? 'Active' : 'Disabled'}
                                  </Badge>
                                </td>
                                <td className="text-xs text-slate-500">{format(new Date(u.createdAt), 'dd MMM yy')}</td>
                                <td className="text-right">
                                  <button onClick={() => setUserForm({ mode: 'edit', user: u })}
                                    className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                    <Pencil className="w-3 h-3"/> Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── STATS TAB ─── */}
                {tab === 'stats' && (
                  <div className="space-y-4">
                    {/* Date range */}
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="form-group mb-0">
                        <label className="form-label text-xs">From</label>
                        <input type="date" className="form-input text-sm" value={from}
                          onChange={e => setFrom(e.target.value)} />
                      </div>
                      <div className="form-group mb-0">
                        <label className="form-label text-xs">To</label>
                        <input type="date" className="form-input text-sm" value={to}
                          onChange={e => setTo(e.target.value)} />
                      </div>
                      {(from || to) && (
                        <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>Clear</Button>
                      )}
                    </div>

                    {statsLoading ? (
                      <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
                    ) : !stats ? (
                      <p className="text-slate-400 text-sm text-center py-8">No data</p>
                    ) : (
                      <>
                        {/* Activity banner */}
                        {isInactive && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"/>
                            <div className="text-sm">
                              <p className="font-semibold text-amber-900">Inactive clinic</p>
                              <p className="text-amber-800">No prescriptions in the last 30 days{lastRx ? ` (last on ${format(new Date(lastRx), 'dd MMM yyyy')})` : ' — never used yet'}.</p>
                            </div>
                          </div>
                        )}

                        {/* KPI cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <KPI label="Patients"      value={stats.totals.patients} />
                          <KPI label="Prescriptions" value={stats.totals.prescriptions} />
                          <KPI label="Bills"         value={stats.totals.bills} />
                          <KPI label="Revenue"       value={`₹${stats.totals.revenue.toLocaleString('en-IN')}`} />
                        </div>

                        {/* Patient growth */}
                        <Card title="Patient Growth (last 12 months)">
                          {stats.charts.patientsByMonth.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No data</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={stats.charts.patientsByMonth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#1565C0" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </Card>

                        {/* Rx volume */}
                        <Card title="Prescription Volume (last 12 months)">
                          {stats.charts.prescriptionsByMonth.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No data</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={stats.charts.prescriptionsByMonth}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#42A5F5" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </Card>

                        {/* Peak hours */}
                        <Card title="Peak Usage Hours (Rx by hour of day)">
                          {stats.charts.prescriptionsByHour.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-6">No data</p>
                          ) : (
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={stats.charts.prescriptionsByHour}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={11}
                                  tickFormatter={(h) => `${h}:00`} />
                                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                                <Tooltip labelFormatter={(h) => `${h}:00 – ${h}:59`} />
                                <Bar dataKey="count" fill="#00BCD4" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </Card>
                      </>
                    )}
                  </div>
                )}

                {/* ─── ACTIONS TAB ─── */}
                {tab === 'actions' && (
                  <div className="space-y-4">
                    {/* Subscription Plan */}
                    <Card>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800 flex items-center gap-2"><Crown className="w-4 h-4 text-primary"/>Subscription Plan</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Current: <Badge variant={planColors[clinic.subscriptionPlan]}>{clinic.subscriptionPlan}</Badge></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {['Basic', 'Standard', 'Pro'].map(p => (
                          <button key={p} disabled={saving || clinic.subscriptionPlan === p}
                            onClick={() => changePlan(p)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors
                              ${clinic.subscriptionPlan === p
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary'}`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </Card>

                    {/* Status (Suspend / Activate) */}
                    <Card>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800 flex items-center gap-2"><Power className="w-4 h-4 text-warning"/>Clinic Status</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Suspending blocks all logins. Data is preserved.</p>
                        </div>
                        <Badge variant={statusColors[clinic.status]}>{clinic.status}</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {clinic.status !== 'Active' && (
                          <Button variant="success" size="sm" loading={saving}
                            onClick={() => setPendingStatus('Active')}>
                            Activate Clinic
                          </Button>
                        )}
                        {clinic.status !== 'Suspended' && (
                          <Button variant="danger" size="sm" loading={saving}
                            onClick={() => setPendingStatus('Suspended')}>
                            Suspend Clinic
                          </Button>
                        )}
                      </div>
                    </Card>

                    {/* Reset Admin Password */}
                    <Card>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800 flex items-center gap-2"><KeyRound className="w-4 h-4 text-warning"/>Reset Admin Password</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Generates a temporary password. All existing sessions will be logged out.</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" loading={resetting}
                        onClick={() => setShowResetConfirm(true)}
                        icon={<KeyRound className="w-3.5 h-3.5"/>}>
                        Reset Password
                      </Button>

                      {tempPassword && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-xs text-amber-900 font-semibold mb-2">⚠ Save this password — it won't be shown again</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24">Admin:</span>
                              <span className="font-medium text-slate-800">{tempPassword.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24">Email:</span>
                              <span className="font-mono text-slate-800 truncate flex-1">{tempPassword.email}</span>
                              <button onClick={() => copyToClipboard(tempPassword.email, 'Email')}
                                className="text-slate-400 hover:text-primary"><Copy className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24">Temp password:</span>
                              <span className="font-mono font-bold text-primary text-lg flex-1">{tempPassword.password}</span>
                              <button onClick={() => copyToClipboard(tempPassword.password, 'Password')}
                                className="text-slate-400 hover:text-primary"><Copy className="w-4 h-4"/></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer (only on Info tab) */}
          {tab === 'info' && (
            <div className="modal-footer">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" loading={saving} icon={<Save className="w-4 h-4"/>}
                onClick={saveInfo}>
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Reset password confirm */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset admin password?"
        message="This will generate a new temporary password and log out all existing admin sessions. The current password will stop working immediately."
        variant="warning"
        confirmLabel="Yes, Reset"
        cancelLabel="Cancel"
        onConfirm={resetPassword}
        onClose={() => setShowResetConfirm(false)}
      />

      {/* Status change confirm */}
      <ConfirmDialog
        open={!!pendingStatus}
        title={pendingStatus === 'Suspended' ? 'Suspend this clinic?' : 'Activate this clinic?'}
        message={pendingStatus === 'Suspended'
          ? 'All users in this clinic will be unable to log in until reactivated. Data will be preserved.'
          : 'Users will be able to log in again.'}
        variant={pendingStatus === 'Suspended' ? 'danger' : 'success'}
        confirmLabel={pendingStatus === 'Suspended' ? 'Yes, Suspend' : 'Yes, Activate'}
        cancelLabel="Cancel"
        onConfirm={() => changeStatus(pendingStatus)}
        onClose={() => setPendingStatus(null)}
      />

      {/* User Add / Edit modal */}
      {userForm && (
        <SuperUserFormModal
          clinicId={clinicId}
          mode={userForm.mode}
          initialUser={userForm.user}
          onClose={() => setUserForm(null)}
          onSaved={refreshDetail}
        />
      )}
    </>
  )
}

// ── KPI tile ────────────────────────────────────────────
function KPI({ label, value }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  )
}
