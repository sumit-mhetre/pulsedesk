import axios from 'axios'
import toast from 'react-hot-toast'

// Use VITE_API_URL if set (production with separate backend),
// otherwise fall back to relative /api (same-origin or Vite proxy)
const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') // remove trailing slash
  : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle token expiry — auto refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')
        // ✅ Use BASE_URL not hardcoded /api
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        localStorage.setItem('accessToken', data.data.accessToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }

    // Show error toast for non-401 errors (skip auth endpoints - they handle their own errors)
    const url = err.config?.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')
    if (err.response?.status !== 401 && !isAuthEndpoint) {
      const msg = err.response?.data?.message || 'Something went wrong'
      toast.error(msg)
    }

    return Promise.reject(err)
  }
)

// ── Keep Render backend alive (ping every 10 min) ─────────
if (typeof window !== 'undefined') {
  const ping = () => {
    // ✅ Use BASE_URL not hardcoded /api
    fetch(`${BASE_URL}/health`, { method: 'GET' }).catch(() => {})
  }
  setTimeout(ping, 3000)
  setInterval(ping, 10 * 60 * 1000)
}

export default api