import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Film,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
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

const ZOOM_SCALES = [1, 2, 3] as const
const ZOOM_LABELS = ['1x', '2x', '3x'] as const

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

  const [zoomLevel, setZoomLevel] = useState<0 | 1 | 2>(0)
  const [transformOrigin, setTransformOrigin] = useState<string>('50% 50%')

  // Reset zoom during render whenever active memory changes (avoids cascading render warning)
  const [prevMemoryId, setPrevMemoryId] = useState(memory?.id)
  if (memory?.id !== prevMemoryId) {
    setPrevMemoryId(memory?.id)
    setZoomLevel(0)
    setTransformOrigin('50% 50%')
  }

  const isImage = memory?.mediaKind === 'Image'

  const cycleZoom = useCallback(
    (clientX?: number, clientY?: number, targetRect?: DOMRect) => {
      if (!isImage) return
      setZoomLevel((prev) => {
        const next = ((prev + 1) % 3) as 0 | 1 | 2
        if (next === 0) {
          setTransformOrigin('50% 50%')
        } else if (clientX !== undefined && clientY !== undefined && targetRect) {
          const x = Math.max(
            0,
            Math.min(100, ((clientX - targetRect.left) / targetRect.width) * 100),
          )
          const y = Math.max(
            0,
            Math.min(100, ((clientY - targetRect.top) / targetRect.height) * 100),
          )
          setTransformOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
        }
        return next
      })
    },
    [isImage],
  )

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (zoomLevel === 0 || !isImage) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    setTransformOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
  }

  const handleImageClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!isImage) return
    cycleZoom(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomLevel > 0) {
          setZoomLevel(0)
          setTransformOrigin('50% 50%')
        } else {
          onClose()
        }
      }
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    },
    [onClose, onPrev, onNext, zoomLevel],
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
        className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white z-50 pointer-events-auto"
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

        {/* Header actions: Magnification zoom button + Close button */}
        <div className="flex items-center gap-2">
          {isImage && mainUrl && (
            <button
              type="button"
              onClick={() => cycleZoom()}
              aria-label={`Zoom level ${ZOOM_LABELS[zoomLevel]}. Click to zoom.`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xs border transition cursor-pointer select-none ${
                zoomLevel > 0
                  ? 'bg-accent text-accent-fg border-accent font-bold shadow-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              {zoomLevel === 2 ? (
                <ZoomOut
                  className={`w-3.5 h-3.5 ${zoomLevel > 0 ? 'text-accent-fg' : 'text-accent'}`}
                />
              ) : (
                <ZoomIn
                  className={`w-3.5 h-3.5 ${zoomLevel > 0 ? 'text-accent-fg' : 'text-accent'}`}
                />
              )}
              <span>{ZOOM_LABELS[zoomLevel]}</span>
            </button>
          )}

          <IconButton
            label="Close (Esc)"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </IconButton>
        </div>
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
        className={`relative max-h-[82vh] max-w-[90vw] flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl group select-none ${
          isImage ? (zoomLevel === 2 ? 'cursor-zoom-out' : 'cursor-zoom-in') : ''
        }`}
        onClick={handleImageClick}
        onMouseMove={handleMouseMove}
      >
        {isLoading && (
          <div className="w-64 h-96 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {mainUrl && (
          <div
            className="relative inline-block max-h-[82vh] transition-transform duration-200 ease-out"
            style={
              isImage
                ? {
                    transform: `scale(${ZOOM_SCALES[zoomLevel]})`,
                    transformOrigin,
                  }
                : undefined
            }
          >
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
                draggable={false}
                className="max-h-[82vh] w-auto rounded-2xl object-contain shadow-lg select-none"
              />
            )}

            {/* Overlay layer */}
            {overlayUrl && (
              <img
                src={overlayUrl}
                alt="Overlay"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-2xl z-10 select-none"
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
