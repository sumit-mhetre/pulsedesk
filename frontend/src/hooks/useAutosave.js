import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../lib/api'

/**
 * useAutosave - silently upserts a prescription draft every N seconds while dirty.
 *
 * Usage:
 *   const { status, lastSavedAt, saveNow, discard } = useAutosave({
 *     enabled: !!patientId && !isEditingExisting,
 *     patientId,
 *     getFormState: () => ({ complaint, diagnosis, medicines: rxMeds, ... }),
 *     intervalMs: 10000,
 *   })
 *
 * Status values: 'idle' | 'saving' | 'saved' | 'offline' | 'error'
 *
 * Design:
 *  - Compares stringified form state to last-saved version; only saves if changed.
 *  - Network errors do NOT toast - this is silent. status switches to 'offline'.
 *  - On unmount, flushes one final save if dirty.
 *  - Safe to call with enabled=false; becomes a no-op.
 */
export default function useAutosave({
  enabled = true,
  patientId,
  getFormState,
  intervalMs = 10000,
  endpoint = '/prescriptions/drafts',
}) {
  const [status, setStatus]           = useState('idle')  // idle | saving | saved | offline | error
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [draftId, setDraftId]         = useState(null)

  const lastPayloadRef = useRef('')     // last stringified state we persisted
  const inFlightRef    = useRef(false)
  const mountedRef     = useRef(true)
  const getStateRef    = useRef(getFormState)
  const enabledRef     = useRef(enabled)
  const patientRef     = useRef(patientId)

  // keep latest values in refs so setInterval callbacks stay fresh
  useEffect(() => { getStateRef.current = getFormState }, [getFormState])
  useEffect(() => { enabledRef.current  = enabled },      [enabled])
  useEffect(() => { patientRef.current  = patientId },    [patientId])

  const isMeaningful = useCallback((state) => {
    if (!state) return false
    // Only save if any of: complaint text, diagnosis text, at least one medicine name,
    // at least one lab test, advice text, any vital filled
    const hasMed = Array.isArray(state.medicines) && state.medicines.some(m => m?.medicineName)
    const hasLab = Array.isArray(state.labTests)  && state.labTests.length > 0
    const hasTxt = (state.complaint || '').trim().length > 0 ||
                   (state.diagnosis || '').trim().length > 0 ||
                   (state.advice    || '').trim().length > 0
    const hasVit = state.vitals && Object.values(state.vitals).some(v => v && String(v).trim() !== '')
    return hasMed || hasLab || hasTxt || hasVit
  }, [])

  const performSave = useCallback(async (reason = 'auto') => {
    if (inFlightRef.current) return
    if (!enabledRef.current) return
    if (!patientRef.current) return

    const state = getStateRef.current ? getStateRef.current() : null
    if (!isMeaningful(state)) return

    const payload = JSON.stringify(state)
    if (payload === lastPayloadRef.current) return  // no change since last save

    inFlightRef.current = true
    if (mountedRef.current) setStatus('saving')

    try {
      const { data } = await api.put(endpoint, {
        patientId: patientRef.current,
        formState: state,
      }, { silent: true, timeout: 8000 })

      lastPayloadRef.current = payload
      if (mountedRef.current) {
        setDraftId(data?.data?.id || null)
        setLastSavedAt(new Date())
        setStatus('saved')
      }
    } catch (err) {
      if (!mountedRef.current) return
      // Distinguish offline vs API error
      if (!navigator.onLine || err?.message === 'Network Error' || !err?.response) {
        setStatus('offline')
      } else {
        setStatus('error')
      }
    } finally {
      inFlightRef.current = false
    }
  }, [endpoint, isMeaningful])

  // Timer
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => { performSave('interval') }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, performSave])

  // Flush on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      // Fire-and-forget best-effort final save. Don't wait for it.
      performSave('unmount')
    }
  }, [performSave])

  // Re-try on regained network
  useEffect(() => {
    const onOnline = () => { if (status === 'offline') performSave('online-reconnect') }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [status, performSave])

  const saveNow = useCallback(() => performSave('manual'), [performSave])

  const discard = useCallback(async () => {
    if (!draftId) {
      // Nothing server-side; just reset local state
      lastPayloadRef.current = ''
      setDraftId(null); setLastSavedAt(null); setStatus('idle')
      return
    }
    try {
      await api.delete(`${endpoint}/${draftId}`, { silent: true })
    } catch {}
    lastPayloadRef.current = ''
    setDraftId(null); setLastSavedAt(null); setStatus('idle')
  }, [draftId, endpoint])

  return { status, lastSavedAt, saveNow, discard, draftId }
}
