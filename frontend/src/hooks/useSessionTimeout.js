import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'

const TIMEOUT_MS  = 30 * 60 * 1000  // 30 minutes
const WARNING_MS  = 5  * 60 * 1000  // warn 5 min before
const EVENTS      = ['mousedown','mousemove','keydown','touchstart','scroll','click']

export function useSessionTimeout() {
  const { logout, user } = useAuthStore()
  const navigate          = useNavigate()
  const timeoutRef        = useRef(null)
  const warningRef        = useRef(null)
  const warned            = useRef(false)

  const clearTimers = () => {
    clearTimeout(timeoutRef.current)
    clearTimeout(warningRef.current)
  }

  const doLogout = useCallback(async () => {
    clearTimers()
    await logout()
    toast.error('Session expired due to inactivity. Please login again.', { duration: 5000 })
    navigate('/login')
  }, [logout, navigate])

  const resetTimer = useCallback(() => {
    clearTimers()
    warned.current = false

    // Warn 5 min before expiry
    warningRef.current = setTimeout(() => {
      if (!warned.current) {
        warned.current = true
        toast('⏱ Session will expire in 5 minutes due to inactivity.', {
          duration: 10000,
          icon: '⚠️',
        })
      }
    }, TIMEOUT_MS - WARNING_MS)

    // Auto logout
    timeoutRef.current = setTimeout(doLogout, TIMEOUT_MS)
  }, [doLogout])

  useEffect(() => {
    if (!user) return  // only track when logged in

    resetTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))

    return () => {
      clearTimers()
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user, resetTimer])
}
