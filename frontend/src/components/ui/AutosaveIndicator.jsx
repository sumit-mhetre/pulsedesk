import { useEffect, useState } from 'react'
import { Cloud, CloudOff, AlertCircle, Loader2, Check } from 'lucide-react'

/**
 * AutosaveIndicator - tiny pill showing draft save state.
 * Designed to sit somewhere unobtrusive (bottom of form, next to Save button, etc).
 *
 * Props:
 *   status       'idle' | 'saving' | 'saved' | 'offline' | 'error'
 *   lastSavedAt  Date | null
 */
export default function AutosaveIndicator({ status, lastSavedAt }) {
  // Re-render every 15s so "Saved 2m ago" stays fresh
  const [, tick] = useState(0)
  useEffect(() => {
    if (status !== 'saved') return
    const id = setInterval(() => tick(t => t + 1), 15000)
    return () => clearInterval(id)
  }, [status])

  if (status === 'idle') return null

  const pill = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium'

  if (status === 'saving') {
    return (
      <span className={`${pill} bg-blue-50 text-primary border border-blue-100`}>
        <Loader2 className="w-3 h-3 animate-spin"/>
        Saving draft…
      </span>
    )
  }

  if (status === 'saved') {
    return (
      <span className={`${pill} bg-emerald-50 text-emerald-700 border border-emerald-100`}>
        <Check className="w-3 h-3"/>
        Draft saved{lastSavedAt ? ` · ${timeAgo(lastSavedAt)}` : ''}
      </span>
    )
  }

  if (status === 'offline') {
    return (
      <span className={`${pill} bg-amber-50 text-amber-700 border border-amber-100`}>
        <CloudOff className="w-3 h-3"/>
        Offline - will save when back online
      </span>
    )
  }

  // error
  return (
    <span className={`${pill} bg-rose-50 text-rose-700 border border-rose-100`}>
      <AlertCircle className="w-3 h-3"/>
      Couldn't save draft
    </span>
  )
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 5)    return 'just now'
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
