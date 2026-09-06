import { Video, Image as ImageIcon, MapPin, Maximize2, X } from 'lucide-react'
import { GeoMemoryEvent, formatCoordinates } from '../../utils/geo'
import { useMediaUrl } from '../../db/mediaUrl'
import { Spinner } from '../../components/Spinner'

interface MapMemoryCardProps {
  memory: GeoMemoryEvent
  onOpenLightbox: () => void
  onClose: () => void
}

export function MapMemoryCard({ memory, onOpenLightbox, onClose }: MapMemoryCardProps) {
  const { url: mainUrl, isLoading: isLoadingMain } = useMediaUrl(memory.mediaFile)
  const { url: overlayUrl } = useMediaUrl(memory.overlayFile)

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const isVideo = memory.mediaKind === 'Video'

  return (
    <div
      role="dialog"
      aria-label="Memory details"
      className="w-72 sm:w-80 bg-surface border border-border/80 rounded-2xl shadow-xl overflow-hidden flex flex-col pointer-events-auto backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-surface-raised/50">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          {isVideo ? (
            <Video className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isVideo ? 'Video Memory' : 'Photo Memory'}</span>
        </div>

        <button
          onClick={onClose}
          aria-label="Close card"
          className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Media preview */}
      <div
        onClick={onOpenLightbox}
        className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden cursor-pointer group"
      >
        {isLoadingMain && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="sm" />
          </div>
        )}

        {mainUrl ? (
          <>
            {isVideo ? (
              <video
                src={mainUrl}
                muted
                loop
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={mainUrl}
                alt="Snapchat memory preview"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
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
        ) : !isLoadingMain ? (
          <div className="text-xs text-text-secondary flex flex-col items-center gap-1">
            <ImageIcon className="w-6 h-6 opacity-40" />
            <span>Media unavailable</span>
          </div>
        ) : null}

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 pointer-events-none">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-semibold backdrop-blur-xs">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>View Fullscreen</span>
          </span>
        </div>
      </div>

      {/* Details footer */}
      <div className="p-3.5 flex flex-col gap-2 bg-surface">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-text-primary">
            {formatDate(memory.timestamp)}
          </span>
          <span className="text-[11px] text-text-secondary font-mono flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-accent shrink-0" />
            <span>{formatCoordinates(memory.coordinates)}</span>
          </span>
        </div>

        <button
          onClick={onOpenLightbox}
          className="mt-1 w-full py-1.5 px-3 rounded-xl bg-accent text-accent-fg text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition cursor-pointer shadow-xs"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Open Full Media</span>
        </button>
      </div>
    </div>
  )
}
