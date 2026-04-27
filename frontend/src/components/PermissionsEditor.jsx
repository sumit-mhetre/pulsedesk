import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  PERMISSION_KEYS, PERMISSION_LABELS, PERMISSION_GROUPS,
  getDefaultsForRole,
} from '../lib/permissions'

// ── Capabilities editor (formerly "Permissions" — UI label only) ──
// Reusable across clinic-admin Users page AND super-admin user form modal.
//
// Props:
//   role         — current role (DOCTOR / RECEPTIONIST / ADMIN)
//   permissions  — flat { key: bool } map (always 14 keys)
//   setPermissions — setter (same shape as useState setter)
export default function PermissionsEditor({ role, permissions, setPermissions }) {
  const defaults = useMemo(() => getDefaultsForRole(role), [role])

  // Count overrides (differences from role defaults)
  const overrideCount = useMemo(() => {
    let n = 0
    for (const k of PERMISSION_KEYS) {
      if (permissions[k] !== defaults[k]) n++
    }
    return n
  }, [permissions, defaults])

  const toggle = (key) => {
    setPermissions(p => ({ ...p, [key]: !p[key] }))
  }

  const resetToDefaults = () => {
    setPermissions({ ...defaults })
  }

  return (
    <div className="col-span-2 bg-blue-50/40 border border-blue-100 rounded-xl p-4 mt-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Capabilities</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {overrideCount === 0
              ? `Using defaults for ${role}`
              : `${overrideCount} custom${overrideCount === 1 ? '' : ''} from ${role} defaults`}
          </p>
        </div>
        {overrideCount > 0 && (
          <button type="button" onClick={resetToDefaults}
            className="text-xs font-semibold text-primary hover:text-primary-dark inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3"/> Reset to defaults
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PERMISSION_GROUPS.map(group => (
          <div key={group.label} className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="space-y-1.5">
              {group.keys.map(key => {
                const isOverride = permissions[key] !== defaults[key]
                return (
                  <label key={key} className={`flex items-center gap-2 text-sm cursor-pointer select-none ${isOverride ? 'font-semibold' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!permissions[key]}
                      onChange={() => toggle(key)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    <span className={isOverride ? 'text-primary' : 'text-slate-700'}>
                      {PERMISSION_LABELS[key]}
                    </span>
                    {isOverride && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">CUSTOM</span>}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
