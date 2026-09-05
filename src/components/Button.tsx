import { ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

    const variantStyles = {
      primary: 'bg-accent text-accent-fg font-semibold hover:opacity-90 shadow-sm',
      secondary: 'bg-surface-raised text-text-primary hover:bg-border border border-border',
      outline:
        'bg-transparent border border-border text-text-primary hover:bg-surface-raised hover:border-text-secondary',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised',
      destructive: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20',
    }[variant]

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
    }[size]

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${base} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
