import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Image as ImageIcon,
  BarChart2,
  Search,
  Moon,
  Sun,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useApp } from './AppContext'
import { IconButton } from '../components/IconButton'
import { SearchOverlay } from '../views/search/SearchOverlay'

export function MainLayout() {
  const { theme, toggleTheme, meta, setIsSearchOpen } = useApp()
  const navigate = useNavigate()

  const navItems = [
    {
      to: '/chats',
      label: 'Chats',
      icon: MessageSquare,
      count: meta ? meta.messageCount : undefined,
    },
    {
      to: '/memories',
      label: 'Memories',
      icon: ImageIcon,
      count: meta ? meta.memoryCount : undefined,
    },
    {
      to: '/stats',
      label: 'Stats',
      icon: BarChart2,
    },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
        {/* Brand header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-5">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none"
            onClick={() => navigate('/chats')}
          >
            <div className="w-8 h-8 rounded-xl bg-accent text-accent-fg font-black text-sm flex items-center justify-center shadow-xs">
              SV
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block">SnapVault</span>
              <span className="text-[10px] text-text-secondary font-mono -mt-1 block">
                Local Archive
              </span>
            </div>
          </div>

          <IconButton
            label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={toggleTheme}
            size="sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </IconButton>
        </div>

        {/* Global search launcher */}
        <div className="p-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary bg-surface-raised hover:bg-border/60 border border-border rounded-xl transition cursor-pointer select-none group"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-text-secondary group-hover:text-text-primary" />
              <span>Quick search...</span>
            </span>
            <kbd className="text-[10px] font-mono bg-surface border border-border px-1.5 py-0.5 rounded text-text-secondary">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition select-none ${
                    isActive
                      ? 'bg-accent/10 text-text-primary font-semibold border border-accent/20'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-xs font-mono text-text-secondary bg-surface-raised px-1.5 py-0.5 rounded-full border border-border">
                    {item.count > 999 ? `${(item.count / 1000).toFixed(0)}k` : item.count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer controls */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-[11px] text-text-secondary px-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Offline & Private</span>
            </span>

            <button
              onClick={() => navigate('/import')}
              title="Re-import archive"
              className="flex items-center gap-1 hover:text-text-primary transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Re-import</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg">
        <Outlet />
      </main>

      {/* Global Cmd+K Search Modal */}
      <SearchOverlay />
    </div>
  )
}
