import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { ImportMetaRecord } from '../models/ingest'
import { getLatestImportMeta, db } from '../db/db'
import { buildSearchIndex } from '../search'

export type Theme = 'dark' | 'light'

interface AppContextValue {
  theme: Theme
  toggleTheme: () => void
  isReady: boolean
  isLoadingMeta: boolean
  meta: ImportMetaRecord | null
  refreshData: () => Promise<void>
  isSearchOpen: boolean
  setIsSearchOpen: (open: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snapvault_theme') as Theme | null
      if (saved === 'dark' || saved === 'light') return saved
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
    }
    return 'dark'
  })

  const [meta, setMeta] = useState<ImportMetaRecord | null>(null)
  const [isLoadingMeta, setIsLoadingMeta] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Sync theme with document element
  useEffect(() => {
    localStorage.setItem('snapvault_theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const refreshData = useCallback(async () => {
    try {
      const latest = await getLatestImportMeta()
      setMeta(latest ?? null)

      if (latest) {
        const events = await db.events.toArray()
        buildSearchIndex(events)
      }
    } catch (err) {
      console.error('Failed to load import metadata:', err)
    } finally {
      setIsLoadingMeta(false)
    }
  }, [])

  // Initial load on mount
  useEffect(() => {
    let isMounted = true

    getLatestImportMeta()
      .then(async (latest) => {
        if (!isMounted) return
        setMeta(latest ?? null)
        setIsLoadingMeta(false)

        if (latest) {
          const events = await db.events.toArray()
          if (isMounted) {
            buildSearchIndex(events)
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load import metadata:', err)
          setIsLoadingMeta(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value: AppContextValue = {
    theme,
    toggleTheme,
    isReady: !!meta,
    isLoadingMeta,
    meta,
    refreshData,
    isSearchOpen,
    setIsSearchOpen,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return ctx
}
