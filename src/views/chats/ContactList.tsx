import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Search,
  X,
  ArrowDownAZ,
  ArrowUpZA,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Clock,
  Layers,
  Users,
  MessageSquare,
  Camera,
  Sparkles,
  Bookmark,
  ChevronDown,
  Check,
} from 'lucide-react'
import { ContactSummary } from '../../db/db'
import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'

interface ContactListProps {
  contacts: ContactSummary[]
  selectedContact: string | null
  onSelectContact: (contact: string) => void
  totalEventsCount: number
}

export type ContactSortField = 'recent' | 'name' | 'total' | 'texts' | 'media' | 'snaps' | 'saved'

export type SortDirection = 'asc' | 'desc'

export interface SortOptionConfig {
  id: ContactSortField
  label: string
  shortLabel: string
  description: string
  defaultDirection: SortDirection
  icon: typeof Clock
}

export const SORT_OPTIONS: SortOptionConfig[] = [
  {
    id: 'recent',
    label: 'Recent Activity',
    shortLabel: 'Recent',
    description: 'Order by latest message',
    defaultDirection: 'desc',
    icon: Clock,
  },
  {
    id: 'name',
    label: 'Contact Name',
    shortLabel: 'Name',
    description: 'Alphabetical order by name',
    defaultDirection: 'asc',
    icon: ArrowDownAZ,
  },
  {
    id: 'total',
    label: 'Total Activity',
    shortLabel: 'Total',
    description: 'Total combined messages & snaps',
    defaultDirection: 'desc',
    icon: Layers,
  },
  {
    id: 'texts',
    label: 'Text Messages',
    shortLabel: 'Texts',
    description: 'Total text messages count',
    defaultDirection: 'desc',
    icon: MessageSquare,
  },
  {
    id: 'media',
    label: 'Media Attachments',
    shortLabel: 'Media',
    description: 'Photos & videos sent in chat',
    defaultDirection: 'desc',
    icon: Camera,
  },
  {
    id: 'snaps',
    label: 'Snaps Exchanged',
    shortLabel: 'Snaps',
    description: 'Direct photo & video snaps',
    defaultDirection: 'desc',
    icon: Sparkles,
  },
  {
    id: 'saved',
    label: 'Saved in Chat',
    shortLabel: 'Saved',
    description: 'Messages and media bookmarked in chat',
    defaultDirection: 'desc',
    icon: Bookmark,
  },
]

export function getDirectionLabel(field: ContactSortField, dir: SortDirection): string {
  if (field === 'name') {
    return dir === 'asc' ? 'A → Z' : 'Z → A'
  }
  if (field === 'recent') {
    return dir === 'desc' ? 'Newest first' : 'Oldest first'
  }
  return dir === 'desc' ? 'Most first' : 'Fewest first'
}

export function compareContacts(
  a: ContactSummary,
  b: ContactSummary,
  field: ContactSortField,
  direction: SortDirection,
): number {
  let diff = 0

  switch (field) {
    case 'recent':
      diff = a.lastActivity.localeCompare(b.lastActivity)
      break
    case 'name':
      diff = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      break
    case 'total':
      diff = a.totalMessages + a.totalSnaps - (b.totalMessages + b.totalSnaps)
      break
    case 'texts':
      diff = (a.totalTexts ?? 0) - (b.totalTexts ?? 0)
      break
    case 'media':
      diff = (a.totalMedia ?? 0) - (b.totalMedia ?? 0)
      break
    case 'snaps':
      diff = (a.totalSnaps ?? 0) - (b.totalSnaps ?? 0)
      break
    case 'saved':
      diff = (a.totalSaved ?? 0) - (b.totalSaved ?? 0)
      break
  }

  // If ascending: a - b (or a.localeCompare(b)). If descending: invert.
  const primary = direction === 'asc' ? diff : -diff
  if (primary !== 0) return primary

  // Deterministic tie-breaker 1: most recent activity first
  const tieActivity = b.lastActivity.localeCompare(a.lastActivity)
  if (tieActivity !== 0) return tieActivity

  // Deterministic tie-breaker 2: alphabetical display name
  return a.displayName.localeCompare(b.displayName)
}

function renderContactBadge(item: ContactSummary, field: ContactSortField) {
  switch (field) {
    case 'texts':
      return (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-text font-semibold">
          {(item.totalTexts ?? 0).toLocaleString()} texts
        </span>
      )
    case 'media':
      return (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-text font-semibold">
          {(item.totalMedia ?? 0).toLocaleString()} media
        </span>
      )
    case 'snaps':
      return (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-text font-semibold">
          {(item.totalSnaps ?? 0).toLocaleString()} snaps
        </span>
      )
    case 'saved':
      return (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-text font-semibold">
          {(item.totalSaved ?? 0).toLocaleString()} saved
        </span>
      )
    case 'total':
      return (
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent-text font-semibold">
          {(item.totalMessages + item.totalSnaps).toLocaleString()} total
        </span>
      )
    default:
      return (
        <span className="opacity-80 font-mono">
          {(item.totalMessages + item.totalSnaps).toLocaleString()}
        </span>
      )
  }
}

export function ContactList({
  contacts,
  selectedContact,
  onSelectContact,
  totalEventsCount,
}: ContactListProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [sortField, setSortField] = useState<ContactSortField>('recent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const activeSortOption = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.id === sortField) ?? SORT_OPTIONS[0]!
  }, [sortField])

  const handleSelectField = (field: ContactSortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      const opt = SORT_OPTIONS.find((o) => o.id === field)
      setSortField(field)
      setSortDirection(opt?.defaultDirection ?? 'desc')
    }
    setIsMenuOpen(false)
  }

  const toggleDirection = () => {
    setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  const filteredContacts = useMemo(() => {
    let list = contacts

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim()
      list = list.filter(
        (c) => c.displayName.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q),
      )
    }

    return [...list].sort((a, b) => compareContacts(a, b, sortField, sortDirection))
  }, [contacts, filterQuery, sortField, sortDirection])

  // Include "__all__" unified stream as item 0 when not filtering, or if it matches
  const showAllItem = !filterQuery.trim() || 'all conversations'.includes(filterQuery.toLowerCase())

  const items = useMemo(() => {
    const arr: (ContactSummary | '__all__')[] = []
    if (showAllItem) {
      arr.push('__all__')
    }
    arr.push(...filteredContacts)
    return arr
  }, [showAllItem, filteredContacts])

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 5,
  })

  const formatDate = (iso: string) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      const isThisYear = d.getFullYear() === now.getFullYear()
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: isThisYear ? undefined : '2-digit',
      })
    } catch {
      return ''
    }
  }

  const ActiveIcon = activeSortOption.icon

  return (
    <div className="flex flex-col h-full w-full bg-surface shrink-0">
      {/* List Header */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">Chats</h2>
            <Badge variant="secondary" size="sm">
              {contacts.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 relative">
            {/* Sort Menu Button */}
            <button
              ref={buttonRef}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              aria-label={`Sort conversations, currently by ${activeSortOption.label}`}
              title={`Sort by: ${activeSortOption.label} (${getDirectionLabel(sortField, sortDirection)})`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-raised hover:bg-surface-raised/80 border border-border text-text-primary transition cursor-pointer shadow-2xs"
            >
              <ActiveIcon className="w-3.5 h-3.5 text-accent-text shrink-0" />
              <span className="font-semibold">{activeSortOption.shortLabel}</span>
              <ChevronDown
                className={`w-3 h-3 text-text-secondary transition-transform duration-150 ${
                  isMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Direction Toggle Button */}
            <button
              onClick={toggleDirection}
              title={`Currently: ${getDirectionLabel(sortField, sortDirection)}. Click to invert.`}
              aria-label={`Invert sort direction, currently ${getDirectionLabel(sortField, sortDirection)}`}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-raised hover:bg-surface-raised/80 border border-border text-accent-text transition cursor-pointer shadow-2xs"
            >
              {sortField === 'name' ? (
                sortDirection === 'asc' ? (
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpZA className="w-3.5 h-3.5" />
                )
              ) : sortDirection === 'desc' ? (
                <ArrowDownWideNarrow className="w-3.5 h-3.5" />
              ) : (
                <ArrowUpNarrowWide className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Sort Dropdown Menu */}
            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1.5 w-60 bg-surface border border-border rounded-xl shadow-xl z-50 p-1.5 space-y-0.5"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/40 mb-1 flex items-center justify-between">
                  <span>Sort conversations by</span>
                  <span className="text-accent-text font-mono text-[9px] font-normal lowercase">
                    {getDirectionLabel(sortField, sortDirection)}
                  </span>
                </div>

                {SORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = sortField === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectField(opt.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-accent/10 text-accent-text font-semibold'
                          : 'text-text-primary hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-accent-text' : 'text-text-secondary'
                          }`}
                        />
                        <span className="truncate">{opt.label}</span>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent-text shrink-0 ml-2">
                          <span>{getDirectionLabel(opt.id, sortDirection)}</span>
                          <Check className="w-3.5 h-3.5 text-accent-text shrink-0" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter conversations..."
            className="w-full bg-surface-raised border border-border rounded-xl pl-8 pr-8 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent transition"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2.5 text-text-secondary hover:text-text-primary cursor-pointer p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Virtualized Contact List */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-secondary space-y-2">
            <p>No conversations found</p>
            <button
              onClick={() => setFilterQuery('')}
              className="text-accent-text underline cursor-pointer hover:opacity-80"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index]
              if (!item) return null

              const isAll = item === '__all__'
              const isSelected = isAll
                ? selectedContact === '__all__'
                : selectedContact === item.contact

              return (
                <div
                  key={virtualRow.key}
                  onClick={() => onSelectContact(isAll ? '__all__' : item.contact)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition select-none border-b border-border/40 ${
                    isSelected
                      ? 'bg-accent/10 border-l-3 border-l-accent'
                      : 'hover:bg-surface-raised'
                  }`}
                >
                  {isAll ? (
                    <div className="w-9 h-9 rounded-full bg-accent/20 text-accent-fg font-black flex items-center justify-center shrink-0 border border-accent/30">
                      <Layers className="w-4 h-4 text-text-primary" />
                    </div>
                  ) : (
                    <Avatar name={item.displayName} isGroup={item.isGroup} size="md" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {isAll ? 'All Conversations' : item.displayName}
                        </span>
                        {!isAll && item.isGroup && (
                          <span title="Group chat" className="inline-flex items-center">
                            <Users className="w-3 h-3 text-text-secondary shrink-0" />
                          </span>
                        )}
                      </div>

                      {!isAll && item.lastActivity && (
                        <span className="text-[10px] text-text-secondary shrink-0 font-mono">
                          {formatDate(item.lastActivity)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-0.5 text-xs text-text-secondary">
                      <span className="truncate text-[11px]">
                        {isAll
                          ? `${totalEventsCount.toLocaleString()} total messages & snaps`
                          : `@${item.contact}`}
                      </span>

                      {!isAll && (
                        <span className="text-[10px] shrink-0 ml-1">
                          {renderContactBadge(item, sortField)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
