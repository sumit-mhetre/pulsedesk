import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'

/**
 * useUnsavedChanges
 * Tracks dirty state and blocks navigation when unsaved changes exist.
 * Returns { isDirty, setDirty, confirmProps, ConfirmUnsaved }
 */
export function useUnsavedChanges() {
  const [isDirty, setDirtyState] = useState(false)
  const [pendingNav, setPendingNav] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const setDirty = useCallback((v = true) => setDirtyState(v), [])

  // Block React Router navigation when dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowConfirm(true)
      setPendingNav(() => blocker.proceed)
    }
  }, [blocker.state])

  // Block browser back/refresh
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleConfirmLeave = () => {
    setShowConfirm(false)
    setDirtyState(false)
    if (pendingNav) { pendingNav(); setPendingNav(null) }
    if (blocker.state === 'blocked') blocker.proceed?.()
  }

  const handleCancelLeave = () => {
    setShowConfirm(false)
    setPendingNav(null)
    if (blocker.state === 'blocked') blocker.reset?.()
  }

  // For modals/forms — call this instead of direct onClose
  const guardedClose = useCallback((onClose) => {
    if (isDirty) setShowConfirm(true)
    else onClose?.()
  }, [isDirty])

  const confirmProps = {
    open: showConfirm,
    title: 'Discard Changes?',
    message: 'You have unsaved changes. If you leave now, all entered data will be lost.',
    variant: 'warning',
    onConfirm: handleConfirmLeave,
    onClose: handleCancelLeave,
  }

  return { isDirty, setDirty, confirmProps, guardedClose }
}
