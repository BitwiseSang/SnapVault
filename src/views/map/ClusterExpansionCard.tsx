import { useState } from 'react'
import { Maximize2, X, Image as ImageIcon, Video as VideoIcon, ZoomIn } from 'lucide-react'
import { GeoCluster, GeoMemoryEvent, formatCoordinates } from '../../utils/geo'
import { useMediaUrl } from '../../db/mediaUrl'

function ClusterItemThumbnail({
  memory,
  isSelected,
  onClick,
  onOpenLightbox,
}: {
  memory: GeoMemoryEvent
  isSelected: boolean
  onClick: () => void
  onOpenLightbox: () => void
}) {
  const { url } = useMediaUrl(memory.mediaFile)
  const { url: overlayUrl } = useMediaUrl(memory.overlayFile)
  const isVideo = memory.mediaKind === 'Video'

  const formatShortTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatShortDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })
    } catch {
      return iso
    }
  }

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-surface-raised flex flex-col shrink-0 ${
        isSelected
          ? 'border-accent shadow-md ring-2 ring-accent/30 scale-[1.02]'
          : 'border-border/60 hover:border-text-secondary/60 opacity-90 hover:opacity-100'
      }`}
    >
      <div className="relative aspect-[4/3] w-full min-h-[84px] bg-black flex items-center justify-center overflow-hidden">
        {url ? (
          <>
            {isVideo ? (
              <video
                src={`${url}#t=0.001`}
                preload="metadata"
                muted
                playsInline
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <img
                src={url}
                alt="Memory preview"
                loading="lazy"
                className="w-full h-full object-cover pointer-events-none"
              />
            )}
            {overlayUrl && (
              <img
                src={overlayUrl}
                alt="Overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-secondary">
            {isVideo ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          </div>
        )}

        {/* Media type icon tag */}
        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white z-20">
          {isVideo ? <VideoIcon className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
        </div>

        {/* Hover open action */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenLightbox()
          }}
          title="Open in fullscreen"
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white z-30 cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-1.5 flex flex-col text-[10px] bg-surface">
        <span className="font-semibold text-text-primary truncate">
          {formatShortDate(memory.timestamp)}
        </span>
        <span className="text-text-secondary text-[9px]">{formatShortTime(memory.timestamp)}</span>
      </div>
    </div>
  )
}

interface ClusterExpansionCardProps {
  cluster: GeoCluster
  selectedMemoryId: string | null
  onSelectMemory: (memory: GeoMemoryEvent) => void
  onOpenLightbox: (memory: GeoMemoryEvent) => void
  onZoomIn: () => void
  onClose: () => void
}

export function ClusterExpansionCard({
  cluster,
  selectedMemoryId,
  onSelectMemory,
  onOpenLightbox,
  onZoomIn,
  onClose,
}: ClusterExpansionCardProps) {
  const [visibleLimit, setVisibleLimit] = useState(30)
  const selectedMemory =
    cluster.items.find((m) => m.id === selectedMemoryId) ?? cluster.items[0] ?? null

  const visibleItems = cluster.items.slice(0, visibleLimit)
  const hasMore = visibleLimit < cluster.items.length

  return (
    <div
      role="dialog"
      aria-label="Expanded cluster memories"
      className="w-80 sm:w-96 bg-surface/95 border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-8rem)]"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-surface-raised/50 shrink-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
            <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
            <span>{cluster.items.length} Memories at this Location</span>
          </div>
          <span className="text-[10px] text-text-secondary font-mono mt-0.5">
            {formatCoordinates(cluster.center)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onZoomIn}
            title="Zoom closer to this area"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close cluster view"
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable grid of memories */}
      <div className="p-3 overflow-y-auto min-h-0 max-h-72 sm:max-h-84 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {visibleItems.map((m) => (
          <ClusterItemThumbnail
            key={m.id}
            memory={m}
            isSelected={selectedMemory?.id === m.id}
            onClick={() => onSelectMemory(m)}
            onOpenLightbox={() => onOpenLightbox(m)}
          />
        ))}

        {hasMore && (
          <div className="col-span-full py-1.5 text-center">
            <button
              onClick={() => setVisibleLimit((prev) => prev + 30)}
              className="w-full py-1.5 px-3 rounded-xl bg-surface-raised hover:bg-surface border border-border text-text-primary text-xs font-semibold transition cursor-pointer"
            >
              Load more ({cluster.items.length - visibleLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Footer bar with direct lightbox action for the cluster */}
      {selectedMemory && (
        <div className="p-2.5 border-t border-border bg-surface flex items-center justify-between gap-2 shrink-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-text-primary truncate">
              {selectedMemory.mediaKind === 'Video' ? 'Selected Video' : 'Selected Photo'}
            </span>
            <span className="text-[10px] text-text-secondary truncate">
              {cluster.items.length} {cluster.items.length === 1 ? 'memory' : 'memories'} in this
              cluster
            </span>
          </div>

          <button
            onClick={() => onOpenLightbox(selectedMemory)}
            className="px-3 py-1.5 rounded-xl bg-accent text-accent-fg text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shadow-xs shrink-0"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Open Fullscreen</span>
          </button>
        </div>
      )}
    </div>
  )
}
