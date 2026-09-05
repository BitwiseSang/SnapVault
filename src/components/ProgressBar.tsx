interface ProgressBarProps {
  current: number
  total: number
  label?: string
  className?: string
}

export function ProgressBar({ current, total, label, className = '' }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, total > 0 ? (current / total) * 100 : 0))

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-xs text-text-secondary font-medium">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-border rounded-full h-2 overflow-hidden">
        <div
          className="bg-accent h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
