import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { Button } from '../../components/ui'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name}!`)
      // Small delay to let Render backend fully wake up after login
      setTimeout(() => {
        navigate(user.role === 'SUPER_ADMIN' ? '/super/dashboard' : '/dashboard')
      }, 800)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Welcome back</h1>
        <p className="text-slate-500 text-sm">Sign in to your SimpleRx EMR account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-1">
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className={errors.email ? 'form-input-error' : 'form-input'}
            placeholder="doctor@clinic.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            autoFocus
          />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              className={`${errors.password ? 'form-input-error' : 'form-input'} pr-11`}
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>

        <div className="flex justify-end -mt-1 mb-1">
          <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-dark font-semibold">
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" loading={loading} className="w-full btn-lg">
            Sign In to SimpleRx EMR
          </Button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs font-semibold text-primary mb-2">Demo Credentials</p>
        <div className="space-y-1 text-xs text-slate-600 font-mono">
          <p>Admin: <span className="text-primary">admin@sharmaclinic.com</span> / <span className="text-primary">password123</span></p>
          <p>Super: <span className="text-primary">super@pulsedesk.com</span> / <span className="text-primary">SuperAdmin@123</span></p>
        </div>
      </div>
    </div>
  )
}
