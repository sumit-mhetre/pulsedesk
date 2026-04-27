import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Check } from 'lucide-react'
import api from '../../lib/api'
import { Button } from '../../components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
    } catch (err) {
      // Backend always returns success to prevent enumeration — only network/rate-limit errors land here
      const msg = err?.response?.data?.message || 'Could not process request. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="animate-in">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-success"/>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          If an account exists for <span className="font-semibold text-slate-700">{email}</span>, a password reset link has been generated.
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-600 mb-6">
          <p className="font-semibold text-primary mb-1">📋 Note for now:</p>
          <p>Email delivery isn't wired up yet. Ask your admin to check the server logs for the reset link, or contact them directly to reset for you.</p>
        </div>
        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-primary font-semibold hover:text-primary-dark">
          <ArrowLeft className="w-4 h-4"/> Back to login
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
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Forgot password?</h1>
        <p className="text-slate-500 text-sm">Enter your email and we'll send you a reset link.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              type="email"
              className={`${error ? 'form-input-error' : 'form-input'} pl-10`}
              placeholder="you@clinic.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoFocus
            />
          </div>
          {error && <span className="form-error">{error}</span>}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg w-full"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Remember your password?{' '}
        <Link to="/login" className="text-primary font-semibold hover:text-primary-dark">
          Sign in
        </Link>
      </p>
    </div>
  )
}
