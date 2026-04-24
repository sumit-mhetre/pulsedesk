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

    // ── Global error toast policy ──────────────────────────
    // Skip toast if:
    //   (a) request opted out via config.silent = true
    //   (b) endpoint is auth-related (page handles it)
    //   (c) status is 401 (refresh handled above or redirect coming)
    //   (d) status is 404 on a GET (often expected — page handles empty state)
    //   (e) status is 403 (user hit a forbidden route — show once but don't spam)
    const url = original?.url || ''
    const method = (original?.method || 'get').toLowerCase()
    const status = err.response?.status
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')
    const isSilent = original?.silent === true
    const is404Get = status === 404 && method === 'get'
    const shouldSkip = isSilent || isAuthEndpoint || status === 401 || is404Get

    if (!shouldSkip && status) {
      const msg = err.response?.data?.message || 'Something went wrong'
      // Dedupe: if the same message toasted in the last 2s, skip it
      if (msg !== lastToastMsg || Date.now() - lastToastAt > 2000) {
        toast.error(msg, { id: `api-err-${status}` })
        lastToastMsg = msg
        lastToastAt = Date.now()
      }
    } else if (!shouldSkip && !status) {
      // Network error / no response
      const msg = 'Network error — please check your connection'
      if (msg !== lastToastMsg || Date.now() - lastToastAt > 2000) {
        toast.error(msg, { id: 'api-err-network' })
        lastToastMsg = msg
        lastToastAt = Date.now()
      }
    }

    return Promise.reject(err)
  }
)

// Toast dedup state (module-level so it persists across requests)
let lastToastMsg = ''
let lastToastAt  = 0

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