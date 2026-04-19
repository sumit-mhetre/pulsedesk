import { X, Loader2 } from 'lucide-react'

// ── Button ────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size, loading, icon, className = '', ...props }) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size && `btn-${size}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input
        className={`${error ? 'form-input-error' : 'form-input'} ${className}`}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────
export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select
        className={`${error ? 'form-input-error' : 'form-select'} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────────
export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <textarea
        className={`${error ? 'form-input-error' : 'form-input'} resize-none ${className}`}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────
const badgeMap = {
  primary: 'badge-primary', success: 'badge-success',
  warning: 'badge-warning', danger: 'badge-danger',
  accent: 'badge-accent',   gray: 'badge-gray',
}
export function Badge({ children, variant = 'primary', dot }) {
  return (
    <span className={badgeMap[variant] || 'badge-gray'}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${widths[size] || 'max-w-lg'}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-icon text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────
export function Card({ children, className = '', title, action }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────
export function StatCard({ label, value, icon, color = 'bg-primary', sub }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color} text-white`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return <div className={`spinner ${className}`} />
}

// ── Page Header ───────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, loading, variant = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>Confirm</Button>
        </>
      }
    >
      <p className="text-slate-600 text-sm">{message}</p>
    </Modal>
  )
}
