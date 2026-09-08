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
  Download,
} from 'lucide-react'
import { ContactSummary, TimelineEvent } from '../../db/db'
import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'
import { MessageBubble } from './MessageBubble'
import { EmptyState } from '../../components/EmptyState'
import { exportConversationAsJson } from '../../utils/export'

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
      next.delete('msgId')
      return next
    })
  }

  const toggleSort = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const newSort = sortOrder === 'oldest_first' ? 'newest_first' : 'oldest_first'
      if (newSort === 'oldest_first') next.delete('sort')
      else next.set('sort', newSort)
      next.delete('msgId')
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

  // Virtualizer for high-performance rendering of messages with dynamic measurement.
  //
  // Tuning notes:
  //   - estimateSize values are calibrated slightly above real rendered heights so that
  //     resizeItem() sees delta ≤ 0 (item shrank or matched) rather than delta > 0 (item grew),
  //     which eliminates the scrollAdjustment cascade that caused jitter on upward scroll.
  //   - overscan is low (5) to minimise the burst of simultaneous ResizeObserver callbacks
  //     that fired during fast upward scrolls with the previous overscan of 20.
  //   - directDomUpdates writes translateY positions straight to the DOM, bypassing React
  //     renders for position-only changes and keeping the reconciler out of the scroll path.
  //   - useFlushSync:false prevents the virtualizer from calling flushSync() inside scroll
  //     event handlers, which was blocking the main thread and amplifying jitter.
  //   - useAnimationFrameWithResizeObserver batches measurement callbacks to one per frame,
  //     converting measurement bursts (N items simultaneously entering viewport) into a
  //     single correction per frame.
  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const ev = filteredEvents[index]
      if (!ev) return 80
      // Base: 72 px (vs 56 previously). Accounts for my-1 margins (16 px), py-2 bubble
      // padding (16 px), one line of text (~20 px), and the footer time row (~16 px).
      let size = 72
      const prevEv = index > 0 ? filteredEvents[index - 1] : undefined
      const isNewDate =
        index === 0 ||
        (prevEv !== undefined && ev.timestamp.slice(0, 10) !== prevEv.timestamp.slice(0, 10))
      if (isNewDate) {
        // 52 px (vs 38): my-3 margins (24 px) + text (~18 px) + border/gap (~10 px).
        size += 52
      }
      if (ev.type === 'message' && ev.chatMediaFiles && ev.chatMediaFiles.length > 0) {
        if (ev.mediaType === 'NOTE') {
          // Audio note player pill: p-3 + 40px play button + time row
          size += 50
        } else if (ev.chatMediaFiles.length === 1) {
          // Single photo/video: fixed container 320px
          size += 310
        } else if (ev.chatMediaFiles.length === 2) {
          // 2 items side-by-side: 1 square row (~150px-180px)
          size += 180
        } else {
          // 3+ items: 2 or more square grid rows (~300px-380px)
          size += 330
        }
        if (ev.content && ev.content.trim()) {
          // Caption bubble rendered underneath media
          size += 44 + Math.min(100, Math.floor(ev.content.length / 35) * 22)
        }
      } else if (ev.type === 'snap' || (ev.type === 'message' && ev.mediaType !== 'TEXT')) {
        // Fallback cards (ephemeral snap or unexported media attachment card)
        size += 56
      } else if (ev.type === 'message' && ev.content && ev.content.length > 50) {
        // 22 px/line (vs 18), threshold 50 chars (vs 70), cap 120 px (vs 100).
        size += Math.min(120, Math.floor(ev.content.length / 35) * 22)
      }
      if (
        (sortOrder === 'oldest_first' && index === 0) ||
        (sortOrder === 'newest_first' && index === filteredEvents.length - 1)
      ) {
        // 52 px (vs 36): my-4 margins (32 px) + badge text (~12 px) + letter-spacing.
        size += 52
      }
      return size
    },
    overscan: 5,
    paddingStart: 16,
    paddingEnd: 16,
    getItemKey: (index) => filteredEvents[index]?.id ?? index,
    // Bypass React reconciler for position-only updates during scroll.
    directDomUpdates: true,
    // Defer re-renders to React scheduler; do not call flushSync() in scroll handlers.
    useFlushSync: false,
    // Batch ResizeObserver callbacks to one rAF tick, converting measurement bursts
    // (N items simultaneously entering viewport) into a single correction per frame.
    useAnimationFrameWithResizeObserver: true,
  })

  const lastScrolledKeyRef = useRef<string | null>(null)
  const lastScrolledMsgIdRef = useRef<string | null>(null)

  const currentScrollKey = `${contact}-${filter}-${sortOrder}`

  // Reset target message scroll tracker if targetMsgId changes or is removed
  useEffect(() => {
    if (!targetMsgId) {
      lastScrolledMsgIdRef.current = null
    }
  }, [targetMsgId])

  // Scroll effect: handles one-time centering on target search message,
  // or scrolling to the bottom on conversation switch, sort change, or filter change.
  useEffect(() => {
    if (isLoading || filteredEvents.length === 0) return

    if (targetMsgId) {
      if (lastScrolledMsgIdRef.current !== targetMsgId) {
        const idx = filteredEvents.findIndex((e) => e.id === targetMsgId)
        if (idx !== -1) {
          lastScrolledMsgIdRef.current = targetMsgId
          lastScrolledKeyRef.current = currentScrollKey
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(idx, { align: 'center' })
          })
        }
      }
      return
    }

    if (lastScrolledKeyRef.current !== currentScrollKey) {
      lastScrolledKeyRef.current = currentScrollKey
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(filteredEvents.length - 1, { align: 'end' })
        if (parentRef.current) {
          parentRef.current.scrollTop = parentRef.current.scrollHeight
        }
      })
    }
  }, [isLoading, filteredEvents, targetMsgId, currentScrollKey, virtualizer])

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
            label="Download chat as JSON"
            onClick={() => {
              if (contact && events.length > 0) {
                exportConversationAsJson(contact, summary, events)
              }
            }}
            disabled={isLoading || events.length === 0}
            size="sm"
          >
            <Download className="w-4 h-4" />
          </IconButton>

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
        style={{ overflowAnchor: 'none', willChange: 'transform' }}
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
            ref={virtualizer.containerRef}
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = filteredEvents[virtualRow.index]
              if (!event) return null

              const prevEvent =
                virtualRow.index > 0 ? filteredEvents[virtualRow.index - 1] : undefined
              const showDateSeparator =
                virtualRow.index === 0 ||
                (prevEvent !== undefined &&
                  event.timestamp.slice(0, 10) !== prevEvent.timestamp.slice(0, 10))

              const isBeginningOfConversation =
                sortOrder === 'oldest_first'
                  ? virtualRow.index === 0
                  : virtualRow.index === filteredEvents.length - 1

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
                    // translate3d instead of translateY — triggers GPU compositing.
                    // directDomUpdates will overwrite this on subsequent ticks; keeping
                    // it here ensures a correct initial position before the first rAF.
                    transform: `translate3d(0, ${virtualRow.start}px, 0)`,
                  }}
                >
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
