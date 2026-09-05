import { useState, useRef, useEffect } from 'react'
import { Video, MapPin } from 'lucide-react'
import { MemoryEvent } from '../../models/events'
import { useMediaUrl } from '../../db/mediaUrl'
import { Spinner } from '../../components/Spinner'

interface MemoryCardProps {
  memory: MemoryEvent
  onClick: (memory: MemoryEvent) => void
}

export function MemoryCard({ memory, onClick }: MemoryCardProps) {
  const [isInView, setIsInView] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver: only fetch blobs when near or in viewport
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true)
          obs.disconnect()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { url: mainUrl, isLoading: isLoadingMain } = useMediaUrl(
    isInView ? memory.mediaFile : undefined,
  )
  const { url: overlayUrl } = useMediaUrl(isInView ? memory.overlayFile : undefined)

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  const cleanLocation = (loc: string) => {
    if (!loc || loc.includes('0.0, 0.0')) return null
    return loc.replace('Latitude, Longitude:', '').trim()
  }

  const loc = cleanLocation(memory.location)

  return (
    <div
      ref={cardRef}
      onClick={() => onClick(memory)}
      className="group relative rounded-2xl overflow-hidden bg-surface border border-border/80 shadow-xs hover:shadow-md hover:border-text-secondary/40 transition-all duration-200 cursor-pointer select-none"
    >
      {/* Media container */}
      <div className="relative w-full aspect-9/16 bg-surface-raised flex items-center justify-center overflow-hidden">
        {isLoadingMain && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="sm" />
          </div>
        )}

        {mainUrl && (
          <>
            {memory.mediaKind === 'Video' ? (
              <video
                src={mainUrl}
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
                onMouseEnter={(e) => {
                  void e.currentTarget.play().catch(() => {})
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.pause()
                  e.currentTarget.currentTime = 0
                }}
              />
            ) : (
              <img
                src={mainUrl}
                alt="Snapchat Memory"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
            )}

            {/* Overlay layer (stickers & captions) */}
            {overlayUrl && (
              <img
                src={overlayUrl}
                alt="Overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
              />
            )}
          </>
        )}

        {/* Video badge indicator */}
        {memory.mediaKind === 'Video' && (
          <div className="absolute top-2.5 right-2.5 z-20 w-6 h-6 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center shadow-xs">
            <Video className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Gradient backdrop for bottom text */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/80 via-black/40 to-transparent z-20 pointer-events-none" />

        {/* Bottom meta strip */}
        <div className="absolute inset-x-0 bottom-0 p-3 z-30 flex flex-col justify-end text-white pointer-events-none">
          <span className="text-xs font-semibold drop-shadow-xs">
            {formatDate(memory.timestamp)}
          </span>
          {loc && (
            <span className="text-[10px] opacity-85 flex items-center gap-1 mt-0.5 truncate drop-shadow-xs">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{loc}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
