import Logo from './Logo'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo variant="light" size="lg" showText={false}/>
        <div className="text-center">
          <div className="font-extrabold text-primary text-lg leading-none">
            Simple<span className="text-accent">Rx</span>
            <span className="ml-1.5">EMR</span>
          </div>
          <p className="text-slate-400 text-sm mt-2">Loading...</p>
        </div>
        <div className="spinner text-primary" />
      </div>
    </div>
  )
}
