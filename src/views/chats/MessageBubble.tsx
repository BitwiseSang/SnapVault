import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Camera,
  Video,
  Mic,
  Smile,
  MapPin,
  Share2,
  Bookmark,
  Bell,
  Sparkles,
  Info,
  Play,
  Pause,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { TimelineEvent } from '../../db/db'
import { MessageEvent, SnapEvent } from '../../models/events'
import { useMediaUrl } from '../../db/mediaUrl'
import { Spinner } from '../../components/Spinner'

interface MessageBubbleProps {
  event: TimelineEvent
  showSenderName?: boolean
  isHighlighted?: boolean
}

function ChatMediaLightboxModal({
  files,
  initialIndex,
  onClose,
}: {
  files: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentPath = files[currentIndex]
  const { url, isLoading } = useMediaUrl(currentPath)
  const isVideo = currentPath?.endsWith('.mp4') || currentPath?.endsWith('.mov')

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))
  }, [files.length])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))
  }, [files.length])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, handlePrev, handleNext])

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header */}
      <div
        className="w-full flex items-center justify-between z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-mono text-white/80 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
          {currentIndex + 1} / {files.length}
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main stage */}
      <div
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {files.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 z-10 p-2.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/80 transition cursor-pointer"
            title="Previous (Left arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {isLoading ? (
          <Spinner size="lg" />
        ) : url ? (
          isVideo ? (
            <video
              key={url}
              src={url}
              controls
              autoPlay
              playsInline
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          ) : (
            <img
              key={url}
              src={url}
              alt="Expanded media"
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
          )
        ) : (
          <div className="text-white/60 text-sm">Failed to load media</div>
        )}

        {files.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 z-10 p-2.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/80 transition cursor-pointer"
            title="Next (Right arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="h-6" />
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}

function ChatMediaTile({
  filePath,
  isSingle = false,
  onClick,
}: {
  filePath: string
  isSingle?: boolean
  onClick: () => void
}) {
  const { url, isLoading } = useMediaUrl(filePath)
  const isVideo = filePath.endsWith('.mp4') || filePath.endsWith('.mov')

  if (isLoading) {
    return (
      <div
        className={`${
          isSingle ? 'h-48 w-full' : 'aspect-square'
        } rounded-xl bg-surface-raised border border-border flex items-center justify-center`}
      >
        <Spinner size="sm" />
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={`${
          isSingle ? 'p-3' : 'aspect-square p-1'
        } rounded-xl bg-surface border border-border text-xs text-text-secondary flex items-center justify-center gap-1.5`}
      >
        <Camera className="w-4 h-4 opacity-50" />
        {isSingle && <span>Media unavailable</span>}
      </div>
    )
  }

  if (isVideo && isSingle) {
    return (
      <div className="rounded-xl overflow-hidden bg-black max-w-full">
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="max-h-[320px] w-full object-contain rounded-xl"
        />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden bg-surface-raised border border-border/40 cursor-pointer group/tile ${
        isSingle ? 'max-h-[320px] w-full flex justify-center' : 'aspect-square'
      }`}
    >
      {isVideo ? (
        <>
          <video
            src={url}
            preload="metadata"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover/tile:bg-black/40 transition">
            <div className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center shadow-md">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
          </div>
        </>
      ) : (
        <>
          <img
            src={url}
            alt="Chat attachment"
            loading="lazy"
            className={`w-full ${
              isSingle ? 'max-h-[320px] object-cover' : 'h-full object-cover'
            } group-hover/tile:scale-102 transition duration-150`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover/tile:bg-black/15 transition flex items-end justify-end p-1.5 opacity-0 group-hover/tile:opacity-100">
            <div className="bg-black/60 text-white rounded-md p-1 shadow-sm">
              <Maximize2 className="w-3 h-3" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ChatMediaGrid({
  files,
  onSelectMedia,
}: {
  files: string[]
  onSelectMedia: (index: number) => void
}) {
  if (files.length === 1) {
    return (
      <div className="w-full">
        <ChatMediaTile filePath={files[0]!} isSingle onClick={() => onSelectMedia(0)} />
      </div>
    )
  }

  const gridColsClass =
    files.length === 2
      ? 'grid-cols-2'
      : files.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className={`grid ${gridColsClass} gap-1.5 w-full`}>
      {files.map((file, idx) => (
        <ChatMediaTile key={file} filePath={file} onClick={() => onSelectMedia(idx)} />
      ))}
    </div>
  )
}

function ChatAudioPlayer({
  filePath,
  isSent,
  isSaved,
}: {
  filePath: string
  isSent: boolean
  isSaved: boolean
}) {
  const { url, isLoading } = useMediaUrl(filePath)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const formatSec = (s: number) => {
    if (isNaN(s) || !isFinite(s)) return '0:00'
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition min-w-[210px] sm:min-w-[240px] ${
        isSent
          ? 'bg-black/8 border-black/15 text-accent-fg'
          : 'bg-surface border-border text-text-primary'
      }`}
    >
      <button
        onClick={togglePlay}
        disabled={isLoading || !url}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
          isSent
            ? 'bg-black/12 hover:bg-black/20 text-accent-fg'
            : 'bg-accent text-accent-fg hover:opacity-90'
        } disabled:opacity-50`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false)
            setCurrentTime(0)
          }}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration)
          }}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold">Audio Note</span>
          {isSaved && (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded font-semibold ${
                isSent ? 'bg-black/12' : 'bg-accent/15 text-text-primary'
              }`}
            >
              <Bookmark className="w-2 h-2 fill-current" />
              Saved
            </span>
          )}
        </div>

        {/* Waveform / playback scrub indicator */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="flex items-center gap-1 flex-1 opacity-75">
            {[0.4, 0.7, 1.0, 0.5, 0.8, 0.6, 0.9, 0.6, 0.3].map((height, idx) => {
              const progress = duration > 0 ? currentTime / duration : 0
              const barThreshold = (idx + 1) / 9
              const isActive = isPlaying && progress >= barThreshold - 0.1
              return (
                <span
                  key={idx}
                  className={`w-0.5 rounded-full transition-all duration-150 ${
                    isActive ? 'scale-y-125 opacity-100 bg-current' : 'opacity-60 bg-current'
                  }`}
                  style={{ height: `${Math.round(height * 16)}px` }}
                />
              )
            })}
          </div>
          <span className="text-[10px] font-mono tabular-nums opacity-80">
            {formatSec(currentTime > 0 ? currentTime : duration)}
          </span>
        </div>
      </div>
    </div>
  )
}

function SnapCard({ event, isSent }: { event: SnapEvent; isSent: boolean }) {
  const [showInfo, setShowInfo] = useState(false)
  const isVideo = event.mediaType === 'VIDEO'

  return (
    <div className="space-y-1.5 min-w-[200px] sm:min-w-[230px]">
      <div
        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition ${
          isSent
            ? 'bg-black/8 border-black/15 text-accent-fg'
            : 'bg-surface border-border text-text-primary'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
            isSent
              ? 'bg-black/12 text-accent-fg'
              : isVideo
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {isVideo ? <Video className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs">{isSent ? 'Sent Snap' : 'Received Snap'}</span>
              <span
                className={`text-[9px] font-mono px-1 py-0.5 rounded font-semibold uppercase tracking-wider ${
                  isSent
                    ? 'bg-black/12'
                    : 'bg-surface-raised border border-border text-text-secondary'
                }`}
              >
                {isVideo ? 'Video' : 'Photo'}
              </span>
            </div>
            <button
              onClick={() => setShowInfo((prev) => !prev)}
              title="Why isn't this playable?"
              className="opacity-60 hover:opacity-100 cursor-pointer p-0.5 rounded transition"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
            {isSent ? 'Delivered' : 'Opened'} • Ephemeral snap
          </p>
        </div>
      </div>

      {showInfo && (
        <div
          className={`text-[10px] p-2 rounded-lg leading-relaxed ${
            isSent
              ? 'bg-black/12 text-accent-fg'
              : 'bg-surface-raised text-text-secondary border border-border'
          }`}
        >
          Snapchat direct snaps are ephemeral and deleted after viewing. Media files are not
          included in data exports.
        </div>
      )}
    </div>
  )
}

function MediaCard({ event, isSent }: { event: MessageEvent; isSent: boolean }) {
  const [showInfo, setShowInfo] = useState(false)
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const hasFiles = Boolean(event.chatMediaFiles && event.chatMediaFiles.length > 0)

  if (hasFiles && event.chatMediaFiles) {
    return (
      <div className="space-y-2 min-w-[200px] max-w-[340px] sm:max-w-[420px]">
        <ChatMediaGrid
          files={event.chatMediaFiles}
          onSelectMedia={(idx) => setActiveMediaIndex(idx)}
        />

        {event.content && event.content.trim() && (
          <p className="text-sm break-words whitespace-pre-wrap leading-relaxed px-0.5 mt-1.5">
            {event.content}
          </p>
        )}

        {activeMediaIndex !== null && (
          <ChatMediaLightboxModal
            files={event.chatMediaFiles}
            initialIndex={activeMediaIndex}
            onClose={() => setActiveMediaIndex(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 min-w-[200px] sm:min-w-[230px]">
      <div
        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition ${
          isSent
            ? 'bg-black/8 border-black/15 text-accent-fg'
            : 'bg-surface border-border text-text-primary'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
            isSent
              ? 'bg-black/12 text-accent-fg'
              : 'bg-surface-raised text-accent border border-border'
          }`}
        >
          <Camera className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs">Media Attachment</span>
              {event.isSaved && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                    isSent
                      ? 'bg-black/12 text-accent-fg'
                      : 'bg-accent/15 text-text-primary border border-accent/25'
                  }`}
                >
                  <Bookmark className="w-2.5 h-2.5 fill-current" />
                  Saved
                </span>
              )}
            </div>
            <button
              onClick={() => setShowInfo((prev) => !prev)}
              title="Media availability info"
              className="opacity-60 hover:opacity-100 cursor-pointer p-0.5 rounded transition"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
            {event.isSaved ? 'Saved in Chat' : 'Chat Media'}
          </p>
        </div>
      </div>

      {showInfo && (
        <div
          className={`text-[10px] p-2 rounded-lg leading-relaxed ${
            isSent
              ? 'bg-black/12 text-accent-fg'
              : 'bg-surface-raised text-text-secondary border border-border'
          }`}
        >
          Snapchat logs message history in exports, but attachment files are not bundled in offline
          data downloads.
        </div>
      )}

      {event.content && event.content.trim() && (
        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed px-0.5">
          {event.content}
        </p>
      )}
    </div>
  )
}

function AudioNoteCard({ event, isSent }: { event: MessageEvent; isSent: boolean }) {
  const hasFile = Boolean(event.chatMediaFiles && event.chatMediaFiles.length > 0)
  if (hasFile && event.chatMediaFiles?.[0]) {
    return (
      <ChatAudioPlayer filePath={event.chatMediaFiles[0]} isSent={isSent} isSaved={event.isSaved} />
    )
  }

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition min-w-[190px] ${
        isSent
          ? 'bg-black/8 border-black/15 text-accent-fg'
          : 'bg-surface border-border text-text-primary'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isSent
            ? 'bg-black/12 text-accent-fg'
            : 'bg-surface-raised text-accent border border-border'
        }`}
      >
        <Mic className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold">Audio Note</span>
          {event.isSaved && (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded font-semibold ${
                isSent ? 'bg-black/12' : 'bg-accent/15 text-text-primary'
              }`}
            >
              <Bookmark className="w-2 h-2 fill-current" />
              Saved
            </span>
          )}
        </div>

        {/* Waveform graphic */}
        <div className="flex items-center gap-1 mt-1.5 opacity-60">
          <span className="w-0.5 h-2 bg-current rounded-full" />
          <span className="w-0.5 h-3.5 bg-current rounded-full" />
          <span className="w-0.5 h-5 bg-current rounded-full" />
          <span className="w-0.5 h-2.5 bg-current rounded-full" />
          <span className="w-0.5 h-4 bg-current rounded-full" />
          <span className="w-0.5 h-2 bg-current rounded-full" />
          <span className="w-0.5 h-4.5 bg-current rounded-full" />
          <span className="w-0.5 h-3.5 bg-current rounded-full" />
          <span className="w-0.5 h-1.5 bg-current rounded-full" />
        </div>
      </div>
    </div>
  )
}

function ShareCard({ event, isSent }: { event: MessageEvent; isSent: boolean }) {
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const hasFiles = Boolean(event.chatMediaFiles && event.chatMediaFiles.length > 0)

  return (
    <div className="space-y-1.5 min-w-[190px] max-w-[340px] sm:max-w-[420px]">
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
          isSent ? 'bg-black/8 border-black/15' : 'bg-surface border-border'
        }`}
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Shared Story / Link</span>
      </div>

      {hasFiles && event.chatMediaFiles && (
        <div className="mt-1.5">
          <ChatMediaGrid
            files={event.chatMediaFiles}
            onSelectMedia={(idx) => setActiveMediaIndex(idx)}
          />
        </div>
      )}

      {event.content && event.content.trim() && (
        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed px-0.5">
          {event.content}
        </p>
      )}

      {activeMediaIndex !== null && event.chatMediaFiles && (
        <ChatMediaLightboxModal
          files={event.chatMediaFiles}
          initialIndex={activeMediaIndex}
          onClose={() => setActiveMediaIndex(null)}
        />
      )}
    </div>
  )
}

export function MessageBubble({
  event,
  showSenderName = false,
  isHighlighted = false,
}: MessageBubbleProps) {
  const isSent = event.direction === 'sent'
  const isSnap = event.type === 'snap'

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const renderContent = () => {
    if (isSnap) {
      return <SnapCard event={event} isSent={isSent} />
    }

    const msg = event
    switch (msg.mediaType) {
      case 'MEDIA':
        return <MediaCard event={msg} isSent={isSent} />
      case 'NOTE':
        return <AudioNoteCard event={msg} isSent={isSent} />
      case 'STICKER':
        return (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
              isSent ? 'bg-black/8 border-black/15' : 'bg-surface border-border'
            }`}
          >
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Sticker</span>
          </div>
        )
      case 'LOCATION':
        return (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
              isSent ? 'bg-black/8 border-black/15' : 'bg-surface border-border'
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>Shared Location</span>
          </div>
        )
      case 'SHARE':
      case 'SHARESAVEDSTORY':
        return <ShareCard event={msg} isSent={isSent} />
      case 'STATUS':
        return (
          <div className="inline-flex items-center gap-1.5 text-xs italic opacity-80">
            <Bell className="w-3.5 h-3.5" />
            <span>Status update</span>
          </div>
        )
      default:
        if (msg.content && msg.content.trim()) {
          return (
            <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 opacity-70 text-xs italic">
            <Sparkles className="w-3 h-3" />
            Ephemeral message
          </span>
        )
    }
  }

  return (
    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} my-1 group`}>
      {showSenderName && event.contact && (
        <span
          className={`text-[11px] font-medium text-text-secondary mb-0.5 ${
            isSent ? 'mr-2' : 'ml-2'
          }`}
        >
          {isSent ? `To: @${event.contact}` : `@${event.contact}`}
        </span>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 rounded-2xl relative shadow-2xs transition-all ${
          isSent
            ? 'bg-sent text-accent-fg font-medium rounded-br-xs'
            : 'bg-surface-raised border border-border text-text-primary rounded-bl-xs'
        } ${isHighlighted ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg shadow-lg animate-pulse' : ''}`}
      >
        {renderContent()}

        {/* Footer info: time + saved bookmark */}
        <div
          className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
            isSent ? 'text-accent-fg/70' : 'text-text-secondary'
          }`}
        >
          {event.type === 'message' && event.isSaved && (
            <span title="Saved in chat" className="inline-flex items-center">
              <Bookmark className="w-2.5 h-2.5 fill-current shrink-0" />
            </span>
          )}
          <span>{formatTime(event.timestamp)}</span>
        </div>
      </div>
    </div>
  )
}
