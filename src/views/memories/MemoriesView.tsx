import { useState, useEffect, useMemo } from 'react'
import { Image as ImageIcon, Video as VideoIcon, ArrowDownUp } from 'lucide-react'
import { MemoryEvent } from '../../models/events'
import { getEventsByType } from '../../db/db'
import { MediaGrid } from './MediaGrid'
import { MediaLightbox } from './MediaLightbox'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'
import { Spinner } from '../../components/Spinner'

type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'
type SortOrder = 'newest_first' | 'oldest_first'

export function MemoriesView() {
  const [memories, setMemories] = useState<MemoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('ALL')
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest_first')
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)

  // Fetch memories from IndexedDB on mount
  useEffect(() => {
    let isMounted = true
    getEventsByType<MemoryEvent>('memory')
      .then((res) => {
        if (isMounted) {
          setMemories(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load memories:', err)
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Extract all unique years available in the memories dataset
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const m of memories) {
      if (m.timestamp) {
        const year = m.timestamp.slice(0, 4)
        if (year && !isNaN(Number(year))) {
          years.add(year)
        }
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [memories])

  // Filter and sort memories
  const filteredMemories = useMemo(() => {
    let list = memories

    // Type filter
    if (typeFilter === 'IMAGE') {
      list = list.filter((m) => m.mediaKind === 'Image')
    } else if (typeFilter === 'VIDEO') {
      list = list.filter((m) => m.mediaKind === 'Video')
    }

    // Year filter
    if (selectedYear !== 'ALL') {
      list = list.filter((m) => m.timestamp.startsWith(selectedYear))
    }

    // Sort order
    if (sortOrder === 'newest_first') {
      return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    }
    return [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [memories, typeFilter, selectedYear, sortOrder])

  const handleSelectMemory = (_memory: MemoryEvent, index: number) => {
    setActiveLightboxIndex(index)
  }

  const handleCloseLightbox = () => {
    setActiveLightboxIndex(null)
  }

  const handlePrevLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev > 0 ? prev - 1 : filteredMemories.length - 1
    })
  }

  const handleNextLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev < filteredMemories.length - 1 ? prev + 1 : 0
    })
  }

  const activeLightboxMemory =
    activeLightboxIndex !== null ? (filteredMemories[activeLightboxIndex] ?? null) : null

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-5 bg-bg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Memories Gallery
            </h1>
            <Badge variant="secondary" size="md">
              {filteredMemories.length.toLocaleString()}
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Saved photos, videos, and overlaid captions from your Snapchat export.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs bg-surface-raised border border-border text-text-primary px-3 py-1.5 rounded-xl focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="ALL">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* Sort button */}
          <IconButton
            label={`Sorting: ${sortOrder === 'newest_first' ? 'Newest first' : 'Oldest first'}`}
            size="md"
            variant="secondary"
            onClick={() =>
              setSortOrder((prev) => (prev === 'newest_first' ? 'oldest_first' : 'newest_first'))
            }
          >
            <ArrowDownUp className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* Filter Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 shrink-0">
        <button
          onClick={() => setTypeFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
            typeFilter === 'ALL'
              ? 'bg-accent text-accent-fg font-bold shadow-xs'
              : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          All Media ({memories.length})
        </button>

        <button
          onClick={() => setTypeFilter('IMAGE')}
          className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center gap-1.5 ${
            typeFilter === 'IMAGE'
              ? 'bg-accent text-accent-fg font-bold shadow-xs'
              : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Photos
        </button>

        <button
          onClick={() => setTypeFilter('VIDEO')}
          className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center gap-1.5 ${
            typeFilter === 'VIDEO'
              ? 'bg-accent text-accent-fg font-bold shadow-xs'
              : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          <VideoIcon className="w-3.5 h-3.5" />
          Videos
        </button>
      </div>

      {/* Gallery content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-text-secondary">
            <Spinner size="lg" />
            <span>Loading memories...</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<ImageIcon className="w-8 h-8 text-accent" />}
              title="No memories found"
              description="No saved photos or videos match the current filters."
              action={
                <button
                  onClick={() => {
                    setTypeFilter('ALL')
                    setSelectedYear('ALL')
                  }}
                  className="text-xs text-accent font-semibold underline cursor-pointer hover:opacity-80"
                >
                  Clear all filters
                </button>
              }
            />
          </div>
        ) : (
          <MediaGrid memories={filteredMemories} onSelectMemory={handleSelectMemory} />
        )}
      </div>

      {/* Lightbox view */}
      {activeLightboxMemory && (
        <MediaLightbox
          memory={activeLightboxMemory}
          currentIndex={activeLightboxIndex!}
          totalCount={filteredMemories.length}
          onClose={handleCloseLightbox}
          onPrev={handlePrevLightbox}
          onNext={handleNextLightbox}
        />
      )}
    </div>
  )
}
