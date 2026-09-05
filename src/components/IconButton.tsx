import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary' | 'outline' | 'accent'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, label, size = 'md', variant = 'ghost', className = '', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed'

    const sizeStyles = {
      sm: 'w-7 h-7 p-1 text-xs',
      md: 'w-9 h-9 p-1.5 text-sm',
      lg: 'w-10 h-10 p-2 text-base',
    }[size]

    const variantStyles = {
      ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
      secondary: 'bg-surface-raised text-text-primary hover:bg-border border border-border',
      outline:
        'border border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised',
      accent: 'bg-accent text-accent-fg font-semibold hover:opacity-90',
    }[variant]

    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={`${base} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  },
)

IconButton.displayName = 'IconButton'
