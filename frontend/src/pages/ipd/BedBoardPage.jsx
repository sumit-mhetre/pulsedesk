// Bed Board - visual grid view with top-view illustrated bed cards.
//
// Each card shows a top-down bed illustration that conveys status:
//   VACANT   - empty bed, ready
//   OCCUPIED - patient face on pillow, blanket drawn over body, "z" sleep marks
//   CLEANING - bed with sparkles around it (housekeeping in progress)
//   RESERVED - bed with RESERVED tag overlaid
//   BLOCKED  - faded bed with hard-hat icon (out of service)
//
// Click behavior:
//   VACANT or RESERVED → "Admit Patient" (navigates to /ipd/admissions/new)
//   OCCUPIED           → "View Admission" (navigates to /ipd/admissions/:id)
//   CLEANING           → "Mark Clean" button on card (CLEANING → VACANT)
//   BLOCKED            → No action

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bed as BedIcon, Filter, AlertCircle, Sparkles } from 'lucide-react'
import { Card, Button } from '../../components/ui'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const BED_TYPE_LABELS = {
  GENERAL: 'General', SEMI_PRIVATE: 'Semi-Private', PRIVATE: 'Private',
  ICU: 'ICU', HDU: 'HDU', LABOUR: 'Labour', DAY_CARE: 'Day-Care',
  ISOLATION: 'Isolation', OTHER: 'Other',
}

// Status-driven palette. Keep in sync with the SVG illustration colors below.
const STATUS_THEMES = {
  VACANT:   { bg: '#EAF3DE', border: '#97C459', strong: '#3B6D11', text: '#173404', label: 'Vacant'   },
  OCCUPIED: { bg: '#FCEBEB', border: '#E24B4A', strong: '#A32D2D', text: '#501313', label: 'Occupied' },
  CLEANING: { bg: '#FAEEDA', border: '#EF9F27', strong: '#854F0B', text: '#412402', label: 'Cleaning' },
  RESERVED: { bg: '#E6F1FB', border: '#378ADD', strong: '#185FA5', text: '#042C53', label: 'Reserved' },
  BLOCKED:  { bg: '#F1EFE8', border: '#888780', strong: '#5F5E5A', text: '#2C2C2A', label: 'Blocked'  },
}

// ─────────────────────────────────────────────────────────
// Top-view bed illustration (compact). One SVG per status.
// Designed for ~80×60 viewport so cards stay small.
// ─────────────────────────────────────────────────────────
function BedSVG({ status }) {
  const t = STATUS_THEMES[status] || STATUS_THEMES.VACANT

  // Mattress fill / opacity tweaked per status for instant readability.
  const mattressColor =
    status === 'OCCUPIED' ? '#F7C1C1' :
    status === 'VACANT'   ? '#C0DD97' :
    status === 'CLEANING' ? '#FAC775' :
    status === 'RESERVED' ? '#B5D4F4' :
                            '#D3D1C7'  // BLOCKED
  const mattressOpacity = status === 'BLOCKED' ? 0.45 : (status === 'VACANT' ? 0.5 : 0.7)

  return (
    <svg width="74" height="92" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Bed frame (top view - looking down at the bed) */}
      <rect x="10" y="6" width="60" height="88" rx="4"
        fill="white" stroke={t.strong} strokeWidth="1.2"
        opacity={status === 'BLOCKED' ? 0.7 : 1}/>
      {/* Pillow area */}
      <rect x="14" y="10" width="52" height="20" rx="2"
        fill={mattressColor}
        opacity={status === 'BLOCKED' ? 0.7 : (status === 'CLEANING' ? 0.7 : 1)}/>
      {/* Pillow */}
      <rect x="20" y="14" width="40" height="12" rx="3"
        fill="white" stroke={t.border} strokeWidth="0.8"
        opacity={status === 'BLOCKED' ? 0.7 : 1}/>

      {/* Patient face on pillow + blanket - only for OCCUPIED */}
      {status === 'OCCUPIED' && (
        <>
          <ellipse cx="40" cy="22" rx="6" ry="5" fill="#F0997B"/>
          <circle cx="38" cy="21" r="0.8" fill="#501313"/>
          <circle cx="42" cy="21" r="0.8" fill="#501313"/>
          <path d="M 38 24 q 2 1.5 4 0" stroke="#501313" strokeWidth="0.6" fill="none" strokeLinecap="round"/>
          {/* Blanket / mattress */}
          <rect x="14" y="34" width="52" height="56" rx="2" fill="#F7C1C1"/>
          <path d="M 16 36 L 64 36 L 64 88 L 16 88 Z" fill="#F4C0D1" opacity="0.6"/>
          {/* Mattress button tufts */}
          <circle cx="22" cy="46" r="1" fill="#A32D2D" opacity="0.4"/>
          <circle cx="58" cy="46" r="1" fill="#A32D2D" opacity="0.4"/>
          <circle cx="22" cy="78" r="1" fill="#A32D2D" opacity="0.4"/>
          <circle cx="58" cy="78" r="1" fill="#A32D2D" opacity="0.4"/>
          {/* "z" sleep marks */}
          <text x="65" y="13" fontSize="6" fill="#A32D2D" opacity="0.7" fontWeight="500">z</text>
          <text x="68" y="9" fontSize="4.5" fill="#A32D2D" opacity="0.5" fontWeight="500">z</text>
        </>
      )}

      {/* Empty mattress for non-occupied states */}
      {status !== 'OCCUPIED' && (
        <rect x="14" y="34" width="52" height="56" rx="2"
          fill={mattressColor} opacity={mattressOpacity}/>
      )}

      {/* Subtle dashed center line on Vacant - adds 'made up bed' feel */}
      {status === 'VACANT' && (
        <line x1="14" y1="62" x2="66" y2="62" stroke="#97C459" strokeWidth="0.5" strokeDasharray="2 2"/>
      )}

      {/* Cleaning sparkles */}
      {status === 'CLEANING' && (
        <g fill="#EF9F27">
          <path d="M 30 50 l 1.2 3 l 3 1 l -3 1 l -1.2 3 l -1.2 -3 l -3 -1 l 3 -1 z"/>
          <path d="M 50 65 l 0.9 2.2 l 2.2 0.7 l -2.2 0.7 l -0.9 2.2 l -0.9 -2.2 l -2.2 -0.7 l 2.2 -0.7 z"/>
          <path d="M 25 75 l 0.7 1.7 l 1.7 0.6 l -1.7 0.6 l -0.7 1.7 l -0.7 -1.7 l -1.7 -0.6 l 1.7 -0.6 z"/>
          <path d="M 55 42 l 0.6 1.5 l 1.5 0.5 l -1.5 0.5 l -0.6 1.5 l -0.6 -1.5 l -1.5 -0.5 l 1.5 -0.5 z"/>
        </g>
      )}

      {/* RESERVED tag overlay */}
      {status === 'RESERVED' && (
        <g transform="translate(40 60)">
          <rect x="-22" y="-7" width="44" height="14" rx="2" fill="#378ADD"/>
          <text x="0" y="3" fontSize="6.5" fontWeight="500" fill="white" textAnchor="middle" letterSpacing="0.5">RESERVED</text>
        </g>
      )}

      {/* Hard hat for BLOCKED */}
      {status === 'BLOCKED' && (
        <g transform="translate(40 60)">
          <circle r="14" fill="#FAC775" stroke="#412402" strokeWidth="1"/>
          <path d="M -8 -1 l 16 0 l -2 -3.5 l 0 -3.5 l -12 0 l 0 3.5 z" fill="#412402"/>
          <circle cx="-4.5" cy="3" r="1.5" fill="#412402"/>
          <circle cx="4.5" cy="3" r="1.5" fill="#412402"/>
          <path d="M -3 7 l 6 0" stroke="#412402" strokeWidth="1" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────
// Single bed card (compact ~140px wide)
// ─────────────────────────────────────────────────────────
function BedCard({ bed, canAdmit, canMarkClean, onAdmit, onView, onMarkClean }) {
  const t = STATUS_THEMES[bed.status] || STATUS_THEMES.VACANT
  const adm = bed.currentAdmission

  // Click handler depending on status + permissions
  let onClick = null
  let hint = null
  if (bed.status === 'VACANT' || bed.status === 'RESERVED') {
    if (canAdmit) {
      onClick = () => onAdmit(bed)
      hint = 'Click to admit patient'
    }
  } else if (bed.status === 'OCCUPIED' && adm) {
    onClick = () => onView(adm)
    hint = 'Click to view admission'
  }

  return (
    <div
      onClick={onClick}
      title={hint || ''}
      style={{
        background: t.bg,
        borderColor: t.border,
      }}
      className={`border rounded-xl p-2.5 w-[150px] flex flex-col transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-none" style={{ color: t.text }}>
            {bed.bedNumber}
          </div>
          <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: t.strong }}>
            {BED_TYPE_LABELS[bed.bedType] || bed.bedType}
          </div>
        </div>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase whitespace-nowrap"
          style={{ background: t.border, color: t.text }}>
          {t.label}
        </span>
      </div>

      {/* Top-view bed illustration */}
      <div className="flex justify-center py-1">
        <BedSVG status={bed.status}/>
      </div>

      {/* Footer info */}
      {adm ? (
        <div className="border-t mt-1 pt-1.5" style={{ borderColor: `${t.border}40` }}>
          <p className="text-[11px] font-semibold truncate" style={{ color: t.text }}>{adm.patient?.name || '-'}</p>
          <p className="text-[9px] font-mono truncate" style={{ color: t.strong }}>{adm.admissionNumber}</p>
          {adm.admittedAt && (
            <p className="text-[9px]" style={{ color: t.strong, opacity: 0.7 }}>
              since {format(new Date(adm.admittedAt), 'd MMM')}
            </p>
          )}
        </div>
      ) : bed.status === 'CLEANING' ? (
        <div className="mt-1">
          {canMarkClean && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkClean(bed) }}
              className="w-full text-[10px] font-semibold bg-white/80 hover:bg-white border rounded-md py-1 transition-colors flex items-center justify-center gap-1"
              style={{ borderColor: t.border, color: t.strong }}>
              <Sparkles className="w-2.5 h-2.5"/> Mark Clean
            </button>
          )}
        </div>
      ) : (
        <div className="text-center mt-0.5">
          {bed.dailyRate > 0 ? (
            <p className="text-[10px]" style={{ color: t.strong }}>
              ₹{bed.dailyRate.toLocaleString('en-IN')}/day
            </p>
          ) : (
            <p className="text-[10px] italic" style={{ color: '#FB8C00' }}>Rate not set</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function WardBlock({ wardName, beds, ...handlers }) {
  const orderMap = { VACANT: 0, RESERVED: 1, OCCUPIED: 2, CLEANING: 3, BLOCKED: 4 }
  const sorted = [...beds].sort((a, b) =>
    (orderMap[a.status] - orderMap[b.status]) || a.bedNumber.localeCompare(b.bedNumber)
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-slate-700 text-sm">{wardName}</h3>
        <span className="text-xs text-slate-400">({beds.length} bed{beds.length !== 1 ? 's' : ''})</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {sorted.map(b => <BedCard key={b.id} bed={b} {...handlers}/>)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
export default function BedBoardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canAdmit     = can(user, 'manageAdmissions')
  const canMarkClean = can(user, 'manageBeds')

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/ipd/beds/board')
      setData(res.data)
    } catch (err) {
      if (err?.response?.data?.errors?.ipdDisabled) {
        toast.error('IPD module is not enabled for this clinic')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const onAdmit = (_bed) => {
    navigate('/ipd/admissions/new')
  }
  const onView = (admission) => {
    navigate(`/ipd/admissions/${admission.id}`)
  }
  const onMarkClean = async (bed) => {
    try {
      await api.patch(`/ipd/beds/${bed.id}/mark-clean`)
      toast.success(`${bed.bedNumber} is now ready`)
      await fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update bed')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
  }

  if (!data) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4"/>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Bed Board unavailable</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          IPD module is not enabled for this clinic. Contact your system administrator
          to enable inpatient features.
        </p>
      </Card>
    )
  }

  const { groups, summary } = data
  const totalBeds = summary?.total || 0

  if (totalBeds === 0) {
    return (
      <div className="fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Bed Board</h1>
            <p className="page-subtitle">Visual overview of all beds and their current status</p>
          </div>
        </div>
        <Card className="p-12 text-center">
          <BedIcon className="w-14 h-14 text-slate-300 mx-auto mb-4"/>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No beds configured yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-2">
            Your IPD module is enabled, but no beds have been added yet.
          </p>
          <p className="text-xs text-slate-400">
            Set up beds from the Bed Management page (admin) or contact Super Admin.
          </p>
        </Card>
      </div>
    )
  }

  // Filter
  const filteredGroups = {}
  if (filter === 'all') {
    Object.assign(filteredGroups, groups)
  } else {
    for (const [ward, beds] of Object.entries(groups)) {
      const matching = beds.filter(b => b.status === filter.toUpperCase())
      if (matching.length > 0) filteredGroups[ward] = matching
    }
  }

  const wardEntries = Object.entries(filteredGroups).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="page-title">Bed Board</h1>
          <p className="page-subtitle">
            {canAdmit
              ? 'Click a vacant bed to admit, or an occupied bed to view admission.'
              : 'Visual overview of all beds and their current status.'}
          </p>
        </div>
        <div className="flex gap-2">
          {canAdmit && (
            <Button variant="primary" size="sm" onClick={() => navigate('/ipd/admissions/new')}>
              Admit Patient
            </Button>
          )}
        </div>
      </div>

      {/* Single-row filter strip with counts inside each button.
          Active filter highlighted in primary blue. Buttons with 0 count
          are dimmed but still clickable (e.g., to confirm "yes, nothing
          is reserved right now"). Replaces the old separate info bar +
          filter-button row pattern. */}
      <Card className="mb-4 p-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 mr-1"/>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Filter</span>
          {[
            { key: 'all',      label: 'all',      countColor: 'text-slate-500'   },
            { key: 'vacant',   label: 'vacant',   countColor: 'text-success'     },
            { key: 'occupied', label: 'occupied', countColor: 'text-danger'      },
            { key: 'cleaning', label: 'cleaning', countColor: 'text-warning'     },
            { key: 'reserved', label: 'reserved', countColor: 'text-accent'      },
            { key: 'blocked',  label: 'blocked',  countColor: 'text-slate-400'   },
          ].map(({ key, label, countColor }) => {
            const count = summary?.[key === 'all' ? 'total' : key] ?? 0
            const isActive = filter === key
            const dim = !isActive && count === 0
            return (
              <button key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs transition-colors inline-flex items-center gap-1.5
                  ${isActive
                    ? 'bg-primary text-white font-medium'
                    : `bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary ${dim ? 'opacity-50' : ''}`}`}>
                <span className="capitalize">{label}</span>
                <span className={`font-semibold ${isActive ? 'text-white/85' : countColor}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {wardEntries.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">No beds match the current filter.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {wardEntries.map(([ward, beds]) => (
            <WardBlock key={ward} wardName={ward} beds={beds}
              canAdmit={canAdmit}
              canMarkClean={canMarkClean}
              onAdmit={onAdmit}
              onView={onView}
              onMarkClean={onMarkClean}/>
          ))}
        </div>
      )}
    </div>
  )
}
