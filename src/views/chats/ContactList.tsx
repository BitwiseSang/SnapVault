import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X, ArrowDownAZ, Clock, Layers, Users } from 'lucide-react'
import { ContactSummary } from '../../db/db'
import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'

interface ContactListProps {
  contacts: ContactSummary[]
  selectedContact: string | null
  onSelectContact: (contact: string) => void
  totalEventsCount: number
}

type SortOrder = 'recent' | 'alphabetical'

export function ContactList({
  contacts,
  selectedContact,
  onSelectContact,
  totalEventsCount,
}: ContactListProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const parentRef = useRef<HTMLDivElement>(null)

  const filteredContacts = useMemo(() => {
    let list = contacts

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim()
      list = list.filter(
        (c) => c.displayName.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q),
      )
    }

    if (sortOrder === 'alphabetical') {
      return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName))
    }

    return [...list].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
  }, [contacts, filterQuery, sortOrder])

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

  return (
    <div className="flex flex-col h-full w-80 lg:w-96 border-r border-border bg-surface shrink-0">
      {/* List Header */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">Chats</h2>
            <Badge variant="secondary" size="sm">
              {contacts.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              label={
                sortOrder === 'recent'
                  ? 'Sorted by recent activity (click for A-Z)'
                  : 'Sorted alphabetically (click for recent)'
              }
              size="sm"
              onClick={() =>
                setSortOrder((prev) => (prev === 'recent' ? 'alphabetical' : 'recent'))
              }
            >
              {sortOrder === 'recent' ? (
                <Clock className="w-3.5 h-3.5 text-accent" />
              ) : (
                <ArrowDownAZ className="w-3.5 h-3.5 text-text-secondary" />
              )}
            </IconButton>
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
              className="text-accent underline cursor-pointer hover:opacity-80"
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
                        <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">
                          {item.totalMessages + item.totalSnaps}
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
