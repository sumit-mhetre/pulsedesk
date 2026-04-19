import { create } from 'zustand'
import api from '../lib/api'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  // Initialize — check if token exists and fetch user
  init: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      set({ isLoading: false })
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.data, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.clear()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  // Login
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('accessToken', data.data.accessToken)
    localStorage.setItem('refreshToken', data.data.refreshToken)
    set({ user: data.data.user, isAuthenticated: true })
    return data.data.user
  },

  // Logout
  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      await api.post('/auth/logout', { refreshToken })
    } catch {}
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
  },

  // Update user in store (after profile update)
  setUser: (user) => set({ user }),
}))

export default useAuthStore
