interface ProgressBarProps {
  progress: number // 0-100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="h-2 w-full border border-gray-300 bg-gray-100" role="progressbar" aria-valuenow={Math.round(clamped)}>
      <div className="h-full bg-black transition-all duration-200 ease-linear" style={{ width: `${clamped}%` }} />
    </div>
  )
}
