export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-btn">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="4" fill="white"/>
            <path d="M14 4 L14 8 M14 20 L14 24 M4 14 L8 14 M20 14 L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M7 7 L10 10 M18 18 L21 21 M7 21 L10 18 M18 10 L21 7" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="font-bold text-primary text-lg">PulseDesk</p>
          <p className="text-slate-400 text-sm mt-0.5">Loading...</p>
        </div>
        <div className="spinner text-primary" />
      </div>
    </div>
  )
}
