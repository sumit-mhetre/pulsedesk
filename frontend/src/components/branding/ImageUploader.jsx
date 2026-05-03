import { useState, useRef, useCallback } from 'react'
import { Upload, X, Trash2, Loader2, RefreshCw, ImageIcon, Sparkles, Sun } from 'lucide-react'
import { Button, Modal } from '../ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

/**
 * ImageUploader - drag-drop image uploader with optional 3-tier processing modal.
 *
 * Props:
 *   kind         'logo' | 'footer' | 'letterhead' | 'signature' | 'stamp'
 *   value        current image URL (or null/undefined)
 *   onChange     (newUrl|null) => void  - called on successful upload or remove
 *   label        section title
 *   description  helper text
 *   aspectHint   '16:9' | 'square' | 'wide' | 'free'  - preview box shape
 *   askProcessing true/false - whether to show the 3-tier modal (defaults to true for signature/stamp/letterhead)
 *   maxBytes     reject larger than this (default 5MB)
 */
const PROCESSING_DEFAULTS = {
  logo:       false,   // logos are usually clean already
  header:     false,   // pre-designed banners are clean
  footer:     false,
  letterhead: false,
  signature:  true,    // ask: doctors usually upload scanned/photo signatures
  stamp:      true,    // ask: stamps are scanned from paper most often
}

export default function ImageUploader({
  kind, value, onChange,
  label, description,
  aspectHint = 'free',
  askProcessing,
  maxBytes = 5 * 1024 * 1024,
  disabled = false,
}) {
  const [busy, setBusy]                 = useState(false)
  const [dragOver, setDragOver]         = useState(false)
  const [pendingFile, setPendingFile]   = useState(null) // file awaiting processing choice
  const [showProcessingModal, setShowProcessingModal] = useState(false)
  const fileInputRef = useRef(null)

  const askMode = askProcessing ?? PROCESSING_DEFAULTS[kind] ?? false

  const handleFiles = useCallback((files) => {
    if (!files || !files.length) return
    const file = files[0]

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > maxBytes) {
      toast.error(`File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)`)
      return
    }

    if (askMode) {
      setPendingFile(file)
      setShowProcessingModal(true)
    } else {
      doUpload(file, 'original')
    }
  }, [askMode, maxBytes])

  const doUpload = async (file, processing) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      fd.append('processing', processing)
      const { data } = await api.post('/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      onChange?.(data.data.url)
      toast.success('Uploaded')
    } catch (err) {
      // api.js already toasted from interceptor - no extra toast
    } finally {
      setBusy(false)
      setPendingFile(null)
      setShowProcessingModal(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete('/upload/image', { data: { kind } })
      onChange?.(null)
      toast.success('Removed')
    } catch {
    } finally {
      setBusy(false)
    }
  }

  const onDragOver = (e) => { e.preventDefault(); if (!disabled) setDragOver(true) }
  const onDragLeave = ()  => setDragOver(false)
  const onDrop = (e)      => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  const aspectClass = {
    'square':  'aspect-square max-h-40',
    '16:9':    'aspect-video',
    'wide':    'aspect-[4/1]',
    'free':    'min-h-[120px]',
  }[aspectHint]

  return (
    <div>
      {label && <p className="text-sm font-semibold text-slate-800 mb-0.5">{label}</p>}
      {description && <p className="text-xs text-slate-500 mb-2">{description}</p>}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl flex items-center justify-center transition
          ${aspectClass}
          ${dragOver ? 'border-primary bg-blue-50' : 'border-slate-200 bg-slate-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40'}`}
      >
        {value ? (
          <>
            <img src={value} alt={label || kind} className="max-h-full max-w-full object-contain p-3"/>
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || disabled}
                title="Replace"
                className="p-1.5 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:text-primary hover:border-primary shadow-sm disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5"/>
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy || disabled}
                title="Remove"
                className="p-1.5 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:text-danger hover:border-danger shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
            {busy && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-primary"/>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || disabled}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-primary p-4"
          >
            {busy ? <Loader2 className="w-6 h-6 animate-spin"/> : <Upload className="w-6 h-6"/>}
            <span className="text-xs font-semibold">
              {busy ? 'Uploading…' : 'Click or drag image to upload'}
            </span>
            <span className="text-[10px] text-slate-400">PNG, JPG, WEBP, SVG · max 5MB</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <ProcessingModal
        open={showProcessingModal}
        file={pendingFile}
        kind={kind}
        onCancel={() => { setPendingFile(null); setShowProcessingModal(false) }}
        onChoose={(mode) => doUpload(pendingFile, mode)}
      />
    </div>
  )
}

// ── 3-tier processing chooser ───────────────────────────────
function ProcessingModal({ open, file, kind, onCancel, onChoose }) {
  const previewUrl = file ? URL.createObjectURL(file) : null

  // Friendly per-kind copy
  const titles = {
    signature: 'How should we process this signature?',
    stamp:     'How should we process this stamp?',
    logo:      'How should we process this logo?',
    header:    'How should we process this header banner?',
    footer:    'How should we process this image?',
    letterhead:'How should we process this letterhead?',
  }

  const options = [
    {
      key: 'original',
      icon: ImageIcon,
      label: 'Use as-is',
      sub:   'No changes. Best for already-clean digital images.',
      recommended: kind === 'logo' || kind === 'letterhead',
    },
    {
      key: 'auto-clean',
      icon: Sparkles,
      label: 'Auto-clean',
      sub:   'Remove white background, transparent output. Best for paper scans.',
      recommended: kind === 'signature' || kind === 'stamp',
    },
    {
      key: 'high-contrast',
      icon: Sun,
      label: 'High contrast',
      sub:   'Boost darkness and sharpness. Best for faded prints.',
      recommended: false,
    },
  ]

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={titles[kind] || 'Choose processing'}
      size="lg"
      footer={<Button variant="ghost" onClick={onCancel}>Cancel</Button>}
    >
      {previewUrl && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center justify-center">
          <img src={previewUrl} alt="preview" className="max-h-32 object-contain"/>
        </div>
      )}
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChoose(opt.key)}
            className="w-full text-left p-3 rounded-xl border-2 border-slate-200 hover:border-primary hover:bg-blue-50/30 transition flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <opt.icon className="w-5 h-5 text-primary"/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-800 text-sm">{opt.label}</p>
                {opt.recommended && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 italic">
        You can re-upload anytime if the result isn't right.
      </p>
    </Modal>
  )
}
