import { useState, useEffect, useCallback } from 'react'

/**
 * useUnsavedChanges — simple dirty tracking without useBlocker
 * Works with React Router v6.22+
 */
export function useUnsavedChanges() {
  const [isDirty, setDirtyState] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const setDirty = useCallback((v = true) => setDirtyState(v), [])

  // Block browser refresh/tab close when dirty
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Call this instead of directly calling onClose/navigate
  // If dirty → show confirm, else run immediately
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
