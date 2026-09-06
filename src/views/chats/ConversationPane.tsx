import { useEffect, useMemo, useRef, useState, useCallback, type UIEvent } from 'react'
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

function formatDateSeparator(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.round((nowDate.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'

    const isThisYear = d.getFullYear() === now.getFullYear()
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: isThisYear ? undefined : 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

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

  const targetMsgId = searchParams.get('msgId')

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

  const BATCH_SIZE = 80

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [prevKey, setPrevKey] = useState(`${contact}-${filter}-${sortOrder}`)
  const currentKey = `${contact}-${filter}-${sortOrder}`

  // Reset batch size if conversation context changes
  if (prevKey !== currentKey) {
    setPrevKey(currentKey)
    setVisibleCount(BATCH_SIZE)
  }

  // If a specific message was requested via search, ensure it's in the visible slice
  const targetIdxInFull = useMemo(() => {
    if (!targetMsgId) return -1
    return filteredEvents.findIndex((e) => e.id === targetMsgId)
  }, [filteredEvents, targetMsgId])

  const effectiveVisibleCount = useMemo(() => {
    if (targetIdxInFull === -1) return visibleCount
    if (sortOrder === 'oldest_first') {
      const neededFromEnd = filteredEvents.length - targetIdxInFull + 40
      return Math.max(visibleCount, neededFromEnd)
    } else {
      const neededFromStart = targetIdxInFull + 40
      return Math.max(visibleCount, neededFromStart)
    }
  }, [visibleCount, targetIdxInFull, sortOrder, filteredEvents.length])

  // Windowed events slice
  const startIndex = useMemo(() => {
    if (sortOrder === 'oldest_first') {
      return Math.max(0, filteredEvents.length - effectiveVisibleCount)
    }
    return 0
  }, [sortOrder, filteredEvents.length, effectiveVisibleCount])

  const visibleEvents = useMemo(() => {
    if (sortOrder === 'oldest_first') {
      return filteredEvents.slice(startIndex)
    }
    return filteredEvents.slice(0, effectiveVisibleCount)
  }, [filteredEvents, sortOrder, startIndex, effectiveVisibleCount])

  const hasOlderMessages = useMemo(() => {
    if (sortOrder === 'oldest_first') {
      return startIndex > 0
    }
    return effectiveVisibleCount < filteredEvents.length
  }, [sortOrder, startIndex, effectiveVisibleCount, filteredEvents.length])

  const loadMore = useCallback(() => {
    if (!hasOlderMessages) return
    setVisibleCount((prev) => Math.min(filteredEvents.length, prev + BATCH_SIZE))
  }, [hasOlderMessages, filteredEvents.length])

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (sortOrder === 'oldest_first') {
      if (el.scrollTop < 250 && hasOlderMessages) {
        loadMore()
      }
    } else {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distFromBottom < 250 && hasOlderMessages) {
        loadMore()
      }
    }
  }

  // Virtualizer for high-performance rendering of windowed messages with dynamic measurement
  const virtualizer = useVirtualizer({
    count: visibleEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const ev = visibleEvents[index]
      if (!ev) return 64
      let size = 56
      const globalIndex = sortOrder === 'oldest_first' ? startIndex + index : index
      const prevEv = globalIndex > 0 ? filteredEvents[globalIndex - 1] : undefined
      const isNewDate =
        globalIndex === 0 ||
        (prevEv !== undefined && ev.timestamp.slice(0, 10) !== prevEv.timestamp.slice(0, 10))
      if (isNewDate) {
        size += 38
      }
      if (ev.type === 'snap' || ev.mediaType !== 'TEXT') {
        size += 48
      } else if (ev.content && ev.content.length > 70) {
        size += Math.min(100, Math.floor(ev.content.length / 35) * 18)
      }
      if (
        (sortOrder === 'oldest_first' && index === 0) ||
        (sortOrder === 'newest_first' && index === visibleEvents.length - 1)
      ) {
        size += 36
      }
      return size
    },
    overscan: 20,
    paddingStart: 16,
    paddingEnd: 16,
    anchorTo: sortOrder === 'oldest_first' ? 'end' : 'start',
    followOnAppend: true,
    scrollEndThreshold: 80,
    getItemKey: (index) => visibleEvents[index]?.id ?? index,
  })

  const hasAutoScrolledRef = useRef<string | null>(null)

  // Scroll to targeted search result message if msgId is in URL
  useEffect(() => {
    if (!targetMsgId || visibleEvents.length === 0) return

    const idx = visibleEvents.findIndex((e) => e.id === targetMsgId)
    if (idx !== -1) {
      setTimeout(() => {
        virtualizer.scrollToIndex(idx, { align: 'center' })
      }, 60)
    }
  }, [targetMsgId, visibleEvents, virtualizer])

  // Auto-scroll to bottom only on conversation switch
  useEffect(() => {
    if (targetMsgId || sortOrder !== 'oldest_first' || visibleEvents.length === 0) return

    if (hasAutoScrolledRef.current !== currentKey) {
      hasAutoScrolledRef.current = currentKey
      setTimeout(() => {
        virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' })
      }, 40)
    }
  }, [currentKey, visibleEvents.length, sortOrder, targetMsgId, virtualizer])

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
      <div
        ref={parentRef}
        onScroll={handleScroll}
        style={{ overflowAnchor: 'none' }}
        className="flex-1 overflow-y-auto px-6 min-h-0"
      >
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
              const event = visibleEvents[virtualRow.index]
              if (!event) return null

              const globalIndex =
                sortOrder === 'oldest_first' ? startIndex + virtualRow.index : virtualRow.index
              const prevEvent = globalIndex > 0 ? filteredEvents[globalIndex - 1] : undefined
              const showDateSeparator =
                globalIndex === 0 ||
                (prevEvent !== undefined &&
                  event.timestamp.slice(0, 10) !== prevEvent.timestamp.slice(0, 10))

              const isBeginningOfConversation =
                !hasOlderMessages &&
                (sortOrder === 'oldest_first'
                  ? virtualRow.index === 0
                  : virtualRow.index === visibleEvents.length - 1)

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {virtualRow.index === 0 && hasOlderMessages && sortOrder === 'oldest_first' && (
                    <div className="flex justify-center my-3 select-none">
                      <button
                        onClick={loadMore}
                        className="px-3 py-1 rounded-full text-[11px] font-medium bg-surface-raised/80 hover:bg-surface-raised border border-border text-text-secondary cursor-pointer transition shadow-2xs"
                      >
                        Loading earlier messages...
                      </button>
                    </div>
                  )}
                  {isBeginningOfConversation && sortOrder === 'oldest_first' && (
                    <div className="flex justify-center my-4 select-none">
                      <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-surface-raised/50 border border-border/50 text-text-tertiary">
                        Beginning of conversation
                      </span>
                    </div>
                  )}
                  {showDateSeparator && (
                    <div className="flex justify-center my-3 select-none">
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-raised border border-border text-text-secondary shadow-2xs">
                        {formatDateSeparator(event.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    event={event}
                    showSenderName={isAllStream || summary?.isGroup}
                    isHighlighted={event.id === targetMsgId}
                  />
                  {virtualRow.index === visibleEvents.length - 1 &&
                    hasOlderMessages &&
                    sortOrder === 'newest_first' && (
                      <div className="flex justify-center my-3 select-none">
                        <button
                          onClick={loadMore}
                          className="px-3 py-1 rounded-full text-[11px] font-medium bg-surface-raised/80 hover:bg-surface-raised border border-border text-text-secondary cursor-pointer transition shadow-2xs"
                        >
                          Loading older messages...
                        </button>
                      </div>
                    )}
                  {isBeginningOfConversation && sortOrder === 'newest_first' && (
                    <div className="flex justify-center my-4 select-none">
                      <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-surface-raised/50 border border-border/50 text-text-tertiary">
                        Beginning of conversation
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
