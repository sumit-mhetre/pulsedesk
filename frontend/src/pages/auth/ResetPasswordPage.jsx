import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react'
import api from '../../lib/api'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [form, setForm]       = useState({ password: '', confirm: '' })
  const [showPass, setShow]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  // If no token, redirect home-ish
  useEffect(() => {
    if (!token) {
      setError('This link is invalid or missing. Please request a new password reset.')
    }
  }, [token])

  // Auto-redirect to login 3s after success
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate('/login'), 3000)
      return () => clearTimeout(t)
    }
  }, [done, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) { setError('Missing reset token'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: form.password })
      setDone(true)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="animate-in text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-success"/>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Password reset successful</h1>
        <p className="text-slate-500 text-sm mb-6">
          Your password has been updated. You'll be redirected to login in a moment.
        </p>
        <Link to="/login" className="btn btn-primary btn-lg inline-flex">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <div className="mb-6">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4"/> Back
        </Link>
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Reset password</h1>
        <p className="text-slate-500 text-sm">Create a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        <div className="form-group">
          <label className="form-label">New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              type={showPass ? 'text' : 'password'}
              className="form-input pl-10 pr-11"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError('') }}
              autoFocus
              disabled={!token}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              type={showPass ? 'text' : 'password'}
              className="form-input pl-10"
              placeholder="Repeat your new password"
              value={form.confirm}
              onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError('') }}
              disabled={!token}
            />
          </div>
        </div>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-lg px-3 py-2 mt-2">
            {error}
          </div>
        )}

        <div className="pt-3">
          <button
            type="submit"
            disabled={loading || !token}
            className="btn btn-primary btn-lg w-full"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </div>
      </form>
    </div>
  )
}
