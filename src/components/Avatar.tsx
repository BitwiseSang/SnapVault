import { useMemo } from 'react'
import { Users } from 'lucide-react'

interface AvatarProps {
  name: string
  isGroup?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const COLOR_PALETTES = [
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
  'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
]

export function Avatar({ name, isGroup = false, size = 'md', className = '' }: AvatarProps) {
  const colorClass = useMemo(() => {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % COLOR_PALETTES.length
    return COLOR_PALETTES[idx]
  }, [name])

  const initials = useMemo(() => {
    if (!name.trim()) return '?'
    const parts = name
      .trim()
      .split(/[\s_.-]+/)
      .filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }, [name])

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-xl',
  }[size]

  return (
    <div
      className={`inline-flex items-center justify-center font-semibold rounded-full border shrink-0 select-none ${sizeClasses} ${colorClass} ${className}`}
      aria-label={name}
      title={name}
    >
      {isGroup ? <Users className="w-4 h-4" /> : initials}
    </div>
  )
}
