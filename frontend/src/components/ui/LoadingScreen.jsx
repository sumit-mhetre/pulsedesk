export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.svg" alt="SimpleRx EMR" className="w-16 h-16 object-contain"/>
        <div className="text-center">
          <p className="font-bold text-primary text-lg">SimpleRx EMR</p>
          <p className="text-slate-400 text-sm mt-0.5">Loading...</p>
        </div>
        <div className="spinner text-primary" />
      </div>
    </div>
  )
}
