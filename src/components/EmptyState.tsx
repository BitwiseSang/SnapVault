import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto space-y-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary shadow-sm">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-text-primary tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
