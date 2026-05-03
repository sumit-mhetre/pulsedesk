import { useState, useEffect, useCallback } from 'react'

// Global dirty state - shared across all pages
// DashLayout reads this to intercept sidebar navigation
let _isDirty = false
const _listeners = new Set()

export function setGlobalDirty(val) {
  _isDirty = val
  _listeners.forEach(fn => fn(val))
}
export function getGlobalDirty() { return _isDirty }
export function onGlobalDirtyChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/**
 * useUnsavedChanges
 * Call setDirty(true) when form has changes.
 * Call guardedAction(fn) instead of navigate/close directly.
 */
export function useUnsavedChanges() {
  const [isDirty, setDirtyState] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const setDirty = useCallback((v = true) => {
    setDirtyState(v)
    setGlobalDirty(v)
  }, [])

  // Subscribe to global dirty flag - so pages that call setGlobalDirty(true)
  // directly (without going through this hook's setDirty) also activate the
  // beforeunload guard. Bidirectional sync.
  useEffect(() => {
    return onGlobalDirtyChange((v) => {
      setDirtyState(prev => prev === v ? prev : v)
    })
  }, [])

  // Block browser refresh/tab close
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Clean up global dirty on unmount
  useEffect(() => {
    return () => setGlobalDirty(false)
  }, [])

  const guardedAction = useCallback((action) => {
    if (isDirty) {
      setPendingAction(() => action)
      setShowConfirm(true)
    } else {
      action?.()
    }
  }, [isDirty])

  const handleConfirmLeave = () => {
    setShowConfirm(false)
    setDirtyState(false)
    setGlobalDirty(false)
    pendingAction?.()
    setPendingAction(null)
  }

  const handleCancelLeave = () => {
    setShowConfirm(false)
    setPendingAction(null)
  }

  const confirmProps = {
    open: showConfirm,
    title: 'Discard Changes?',
    message: 'You have unsaved changes. If you leave now, all entered data will be lost.',
    variant: 'warning',
    confirmLabel: 'Yes, Discard',
    cancelLabel: 'Keep Editing',
    onConfirm: handleConfirmLeave,
    onClose: handleCancelLeave,
  }

  return { isDirty, setDirty, confirmProps, guardedAction }
}
