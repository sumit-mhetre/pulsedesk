import { memo } from 'react'

/**
 * SimpleRx EMR Logo component - reusable, adaptive colors.
 *
 * Props:
 *   variant   'light' (default) → blue text on white/light background
 *             'dark'            → white text on blue/dark background
 *   size      'sm' | 'md' (default) | 'lg' | 'xl'
 *   showText  true (default) | false → icon only
 *   className extra classes for the wrapper
 *
 * Usage:
 *   <Logo />                                   ← light variant, medium, full wordmark
 *   <Logo variant="dark" size="sm" />          ← on blue background, small
 *   <Logo size="lg" showText={false} />        ← icon only, large
 */
function Logo({ variant = 'light', size = 'md', showText = true, className = '' }) {
  // On dark (blue) bg: icon shows blue square as-is, text turns white
  // On light (white) bg: icon same, text turns blue
  const isDark = variant === 'dark'

  // Size maps
  const iconSize = { sm: 28, md: 36, lg: 48, xl: 64 }[size] || 36
  const textSize = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' }[size] || 'text-xl'
  const emrSize  = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs', xl: 'text-sm' }[size] || 'text-[10px]'
  const gap      = { sm: 'gap-2', md: 'gap-2.5', lg: 'gap-3', xl: 'gap-3.5' }[size] || 'gap-2.5'

  // Text color: adaptive - matches background context
  const textColor = isDark ? 'text-white' : 'text-primary'
  const emrColor  = isDark ? 'text-white/80' : 'text-primary'

  return (
    <div className={`inline-flex items-center ${gap} ${className}`}>
      {/* ─── Icon: Pulse Line in rounded square ─── */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="SimpleRx EMR"
        className="flex-shrink-0"
      >
        <rect x="2" y="2" width="60" height="60" rx="14" fill="#1565C0" />
        <path
          d="M10 32 h10 l4 -10 l6 20 l4 -14 l4 8 l4 -4 h12"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="10" cy="32" r="2.5" fill="#00BCD4" />
      </svg>

      {/* ─── Wordmark ─── */}
      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`font-extrabold tracking-tight ${textSize} ${textColor}`}>
            Simple<span className="text-accent">Rx</span>
            <span className={`ml-1.5 ${textColor}`}>EMR</span>
          </div>
          {/* Optional: smaller sub-tagline under wordmark, only at lg+ sizes */}
          {(size === 'lg' || size === 'xl') && (
            <div className={`mt-1 font-semibold tracking-[0.2em] ${emrSize} ${emrColor} opacity-70`}>
              CLINIC MANAGEMENT
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(Logo)
