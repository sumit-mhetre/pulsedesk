import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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

        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
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

// ── Auto-retry on connection refused (Render wake-up) ────
const axiosRetry = async (config, retries = 2, delay = 2000) => {
  try {
    return await api(config)
  } catch (err) {
    if (retries > 0 && (!err.response || err.code === 'ERR_NETWORK')) {
      await new Promise(r => setTimeout(r, delay))
      return axiosRetry(config, retries - 1, delay)
    }
    throw err
  }
}

// ── Keep Render backend alive (ping every 10 min) ─────────
if (typeof window !== 'undefined') {
  const ping = () => {
    fetch('/api/health', { method: 'GET' }).catch(() => {})
  }
  // Ping on load, then every 10 minutes
  setTimeout(ping, 3000)
  setInterval(ping, 10 * 60 * 1000)
}

export default api
