import { useEffect, useCallback } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Film,
  Image as ImageIcon,
} from 'lucide-react'
import { MemoryEvent } from '../../models/events'
import { useMediaUrl } from '../../db/mediaUrl'
import { IconButton } from '../../components/IconButton'
import { Spinner } from '../../components/Spinner'

interface MediaLightboxProps {
  memory: MemoryEvent | null
  currentIndex: number
  totalCount: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function MediaLightbox({
  memory,
  currentIndex,
  totalCount,
  onClose,
  onPrev,
  onNext,
}: MediaLightboxProps) {
  const { url: mainUrl, isLoading } = useMediaUrl(memory?.mediaFile)
  const { url: overlayUrl } = useMediaUrl(memory?.overlayFile)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    },
    [onClose, onPrev, onNext],
  )

  useEffect(() => {
    if (!memory) return
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [memory, handleKeyDown])

  if (!memory) return null

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const cleanLocation = (loc: string) => {
    if (!loc || loc.includes('0.0, 0.0')) return null
    return loc.replace('Latitude, Longitude:', '').trim()
  }

  const loc = cleanLocation(memory.location)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-xs">
            {currentIndex + 1} / {totalCount}
          </span>
          <span className="text-xs text-white/80 flex items-center gap-1.5">
            {memory.mediaKind === 'Video' ? (
              <Film className="w-3.5 h-3.5" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            {memory.mediaKind}
          </span>
        </div>

        <IconButton label="Close (Esc)" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Navigation chevrons */}
      {totalCount > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPrev()
            }}
            aria-label="Previous memory (Left arrow)"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-xs transition cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onNext()
            }}
            aria-label="Next memory (Right arrow)"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-xs transition cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Main media display */}
      <div
        className="relative max-h-[82vh] max-w-[90vw] flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="w-64 h-96 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {mainUrl && (
          <div className="relative inline-block max-h-[82vh]">
            {memory.mediaKind === 'Video' ? (
              <video
                src={mainUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[82vh] w-auto rounded-2xl object-contain shadow-lg"
              />
            ) : (
              <img
                src={mainUrl}
                alt="Snapchat Memory"
                className="max-h-[82vh] w-auto rounded-2xl object-contain shadow-lg"
              />
            )}

            {/* Overlay layer */}
            {overlayUrl && (
              <img
                src={overlayUrl}
                alt="Overlay"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-2xl z-10"
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom meta strip */}
      <div
        className="absolute bottom-0 inset-x-0 p-4 text-center text-white/90 z-50 flex flex-col items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          <span>{formatDate(memory.timestamp)}</span>
        </div>
        {loc && (
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <MapPin className="w-3 h-3 text-red-400" />
            <span>{loc}</span>
          </div>
        )}
      </div>
    </div>
  )
}
