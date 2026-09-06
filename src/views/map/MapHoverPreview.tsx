import { Video, Image as ImageIcon, MapPin, Layers } from 'lucide-react'
import { GeoCluster, GeoMemoryEvent, formatCoordinates } from '../../utils/geo'
import { useMediaUrl } from '../../db/mediaUrl'

interface MapHoverPreviewProps {
  memory?: GeoMemoryEvent
  cluster?: GeoCluster
  x: number
  y: number
  containerWidth: number
  containerHeight: number
}

export function MapHoverPreview({
  memory,
  cluster,
  x,
  y,
  containerWidth,
  containerHeight,
}: MapHoverPreviewProps) {
  const targetMemory = memory ?? cluster?.items[0] ?? null
  const { url } = useMediaUrl(targetMemory?.mediaFile)
  const { url: overlayUrl } = useMediaUrl(targetMemory?.overlayFile)
  const isVideo = targetMemory?.mediaKind === 'Video'
  const isCluster = Boolean(cluster && cluster.items.length > 1)

  if (!targetMemory) return null

  // Card dimensions
  const cardWidth = 220
  const cardHeight = 150

  // Smart positioning: display above the marker if enough space, otherwise below
  const isNearTop = y < cardHeight + 40
  const rawTop = isNearTop ? y + 24 : y - cardHeight - 16
  const top = Math.max(12, Math.min(rawTop, containerHeight - cardHeight - 12))

  // Horizontal clamping within the map bounds
  const rawLeft = x - cardWidth / 2
  const left = Math.max(12, Math.min(rawLeft, containerWidth - cardWidth - 12))

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div
      style={{ top: `${top}px`, left: `${left}px` }}
      className="absolute z-40 w-[220px] bg-surface/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl overflow-hidden pointer-events-none flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Thumbnail area */}
      <div className="relative w-full h-24 bg-black flex items-center justify-center overflow-hidden">
        {url ? (
          <>
            {isVideo ? (
              <video
                src={`${url}#t=0.001`}
                preload="metadata"
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={url} alt="Snap preview" className="w-full h-full object-cover" />
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
          <div className="text-text-secondary flex items-center justify-center">
            {isVideo ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
          </div>
        )}

        {/* Media type or cluster badge */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold backdrop-blur-xs z-20">
          {isCluster ? (
            <>
              <Layers className="w-2.5 h-2.5 text-accent" />
              <span>{cluster!.items.length} Snaps</span>
            </>
          ) : isVideo ? (
            <>
              <Video className="w-2.5 h-2.5 text-sky-400" />
              <span>Video</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-2.5 h-2.5 text-amber-400" />
              <span>Photo</span>
            </>
          )}
        </div>
      </div>

      {/* Details snippet */}
      <div className="p-2 flex flex-col gap-0.5 bg-surface">
        <div className="flex items-center justify-between text-[11px] font-bold text-text-primary">
          <span>{formatDate(targetMemory.timestamp)}</span>
          <span className="text-[10px] text-text-secondary font-normal font-mono">
            {formatTime(targetMemory.timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[9px] text-text-secondary truncate mt-0.5">
          <MapPin className="w-2.5 h-2.5 text-accent shrink-0" />
          <span className="truncate">{formatCoordinates(targetMemory.coordinates, 2)}</span>
        </div>

        {isCluster && (
          <span className="text-[9px] text-accent font-medium mt-0.5">Click to expand cluster</span>
        )}
      </div>
    </div>
  )
}
