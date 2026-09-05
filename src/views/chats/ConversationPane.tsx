import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSearchParams } from 'react-router-dom'
import {
  Layers,
  ArrowDownUp,
  Bookmark,
  Camera,
  MessageSquare,
  Sparkles,
  ArrowLeft,
} from 'lucide-react'
import { ContactSummary, TimelineEvent } from '../../db/db'
import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'
import { MessageBubble } from './MessageBubble'
import { EmptyState } from '../../components/EmptyState'

interface ConversationPaneProps {
  contact: string | null
  summary?: ContactSummary
  events: TimelineEvent[]
  isLoading: boolean
  onBack?: () => void
}

type FilterCategory = 'ALL' | 'TEXT' | 'MEDIA' | 'SAVED' | 'SNAPS'

export function ConversationPane({
  contact,
  summary,
  events,
  isLoading,
  onBack,
}: ConversationPaneProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const parentRef = useRef<HTMLDivElement>(null)

  const rawFilter = searchParams.get('filter')
  const filter: FilterCategory =
    rawFilter === 'TEXT' || rawFilter === 'MEDIA' || rawFilter === 'SAVED' || rawFilter === 'SNAPS'
      ? rawFilter
      : 'ALL'

  const sortOrder: 'oldest_first' | 'newest_first' =
    searchParams.get('sort') === 'newest_first' ? 'newest_first' : 'oldest_first'

  const setFilter = (f: FilterCategory) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (f === 'ALL') next.delete('filter')
      else next.set('filter', f)
      return next
    })
  }

  const toggleSort = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const newSort = sortOrder === 'oldest_first' ? 'newest_first' : 'oldest_first'
      if (newSort === 'oldest_first') next.delete('sort')
      else next.set('sort', newSort)
      return next
    })
  }

  const isAllStream = contact === '__all__'

  // Filter events based on active category
  const filteredEvents = useMemo(() => {
    let list = events
    if (filter === 'TEXT') {
      list = list.filter((e) => e.type === 'message' && e.content && e.content.trim())
    } else if (filter === 'MEDIA') {
      list = list.filter((e) => e.type === 'message' && e.mediaType !== 'TEXT')
    } else if (filter === 'SAVED') {
      list = list.filter((e) => e.type === 'message' && e.isSaved)
    } else if (filter === 'SNAPS') {
      list = list.filter((e) => e.type === 'snap')
    }

    if (sortOrder === 'newest_first') {
      return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    }
    return [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [events, filter, sortOrder])

  // Virtualizer for high-performance rendering of thousands of messages
  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  // Auto-scroll to bottom on initial load if oldest_first
  useEffect(() => {
    if (sortOrder === 'oldest_first' && filteredEvents.length > 0 && parentRef.current) {
      setTimeout(() => {
        if (parentRef.current) {
          parentRef.current.scrollTop = parentRef.current.scrollHeight
        }
      }, 50)
    }
  }, [contact, filteredEvents.length, sortOrder])

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg p-8">
        <EmptyState
          icon={<MessageSquare className="w-8 h-8 text-accent" />}
          title="No conversation selected"
          description="Choose a conversation from the left sidebar to browse messages, snaps, and saved media."
        />
      </div>
    )
  }

  const dateRangeString = () => {
    if (events.length === 0) return ''
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const first = new Date(sorted[0]!.timestamp).toLocaleDateString([], {
      month: 'short',
      year: 'numeric',
    })
    const last = new Date(sorted[sorted.length - 1]!.timestamp).toLocaleDateString([], {
      month: 'short',
      year: 'numeric',
    })
    return `${first} — ${last}`
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      {/* Pane Header */}
      <div className="px-4 md:px-6 py-3.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="md:hidden p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised cursor-pointer transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {isAllStream ? (
            <div className="w-10 h-10 rounded-full bg-accent/20 text-accent-fg flex items-center justify-center border border-accent/30 shrink-0">
              <Layers className="w-5 h-5 text-text-primary" />
            </div>
          ) : (
            <Avatar name={summary?.displayName ?? contact} isGroup={summary?.isGroup} size="lg" />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary truncate">
                {isAllStream ? 'All Conversations' : (summary?.displayName ?? contact)}
              </h2>
              {summary?.isGroup && (
                <Badge variant="secondary" size="sm">
                  Group
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              {!isAllStream && <span>@{contact}</span>}
              {!isAllStream && <span>•</span>}
              <span>{events.length.toLocaleString()} events</span>
              {dateRangeString() && (
                <>
                  <span>•</span>
                  <span>{dateRangeString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <IconButton
            label={`Sorting: ${sortOrder === 'oldest_first' ? 'Oldest first (chat style)' : 'Newest first'}`}
            onClick={toggleSort}
            size="sm"
          >
            <ArrowDownUp className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-2 border-b border-border bg-surface/50 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
            filter === 'ALL'
              ? 'bg-accent text-accent-fg font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          }`}
        >
          All ({events.length})
        </button>
        <button
          onClick={() => setFilter('TEXT')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            filter === 'TEXT'
              ? 'bg-accent text-accent-fg font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          Text Messages
        </button>
        <button
          onClick={() => setFilter('MEDIA')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            filter === 'MEDIA'
              ? 'bg-accent text-accent-fg font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          }`}
        >
          <Camera className="w-3 h-3" />
          Media
        </button>
        <button
          onClick={() => setFilter('SAVED')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            filter === 'SAVED'
              ? 'bg-accent text-accent-fg font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          }`}
        >
          <Bookmark className="w-3 h-3" />
          Saved
        </button>
        <button
          onClick={() => setFilter('SNAPS')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
            filter === 'SNAPS'
              ? 'bg-accent text-accent-fg font-bold'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Snaps
        </button>
      </div>

      {/* Message Feed */}
      <div ref={parentRef} className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-text-secondary">
            Loading conversation...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title="No messages match filter"
              description={`No ${filter.toLowerCase()} items found in this conversation.`}
              action={
                <button
                  onClick={() => setFilter('ALL')}
                  className="text-xs text-accent font-semibold underline cursor-pointer hover:opacity-80"
                >
                  Show all events
                </button>
              }
            />
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = filteredEvents[virtualRow.index]
              if (!event) return null

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageBubble event={event} showSenderName={isAllStream || summary?.isGroup} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
