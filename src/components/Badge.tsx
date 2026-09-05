import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'secondary' | 'outline' | 'warning'
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface-raised text-text-primary border-border',
    accent: 'bg-accent text-accent-fg font-bold border-transparent',
    secondary: 'bg-surface-raised text-text-secondary border-border',
    outline: 'bg-transparent text-text-secondary border-border',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  }[variant]

  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
  }[size]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium select-none ${variantStyles} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  )
}
