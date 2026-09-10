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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
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

  const containerClasses = isSingle ? 'w-full h-[280px] sm:h-[320px]' : 'w-full aspect-square'
  const roundingClass = isSingle ? 'rounded-2xl' : 'rounded-xl'

  if (isLoading) {
    return (
      <div
        className={`${containerClasses} ${roundingClass} bg-surface-raised border border-border flex items-center justify-center`}
      >
        <Spinner size="sm" />
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={`${containerClasses} p-3 ${roundingClass} bg-surface border border-border text-xs text-text-secondary flex items-center justify-center gap-1.5`}
      >
        <Camera className="w-4 h-4 opacity-50" />
        {isSingle && <span>Media unavailable</span>}
      </div>
    )
  }

  if (isVideo && isSingle) {
    return (
      <div
        className={`${containerClasses} ${roundingClass} overflow-hidden bg-black flex items-center justify-center`}
      >
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className={`w-full h-full object-contain ${roundingClass}`}
        />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`relative ${containerClasses} ${roundingClass} overflow-hidden bg-surface-raised border border-border/40 cursor-pointer group/tile flex items-center justify-center`}
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
            className="w-full h-full object-cover group-hover/tile:scale-102 transition duration-150"
          />
          <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs text-white rounded-md p-1 shadow-xs opacity-0 group-hover/tile:opacity-100 transition">
            <Maximize2 className="w-3 h-3" />
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

const WAVEFORM_BARS = [
  0.35, 0.55, 0.8, 0.45, 0.65, 0.95, 0.7, 0.4, 0.6, 0.85, 1.0, 0.75, 0.5, 0.7, 0.9, 0.6, 0.45, 0.8,
  0.95, 0.7, 0.55, 0.4, 0.65, 0.8, 0.5, 0.35,
]

function ChatAudioPlayer({
  filePath,
  isSent = false,
  isSaved = false,
  timestamp,
  showTimestamp = true,
}: {
  filePath: string
  isSent?: boolean
  isSaved?: boolean
  timestamp?: string
  showTimestamp?: boolean
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
      className={`flex items-center gap-3 p-3 rounded-2xl border transition shadow-2xs w-[280px] sm:w-[360px] max-w-full ${
        isSent
          ? 'bg-surface-raised border-border text-text-primary'
          : 'bg-surface border-border text-text-primary'
      }`}
    >
      <button
        onClick={togglePlay}
        disabled={isLoading || !url}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer bg-accent text-accent-fg hover:opacity-90 shadow-2xs disabled:opacity-50"
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

      {/* Waveform visualization: vertically centered with play button, spanning remaining space */}
      <div className="flex-1 flex items-center gap-1 sm:gap-1.5 h-10 px-0.5 min-w-0">
        {WAVEFORM_BARS.map((height, idx) => {
          const progress = duration > 0 ? currentTime / duration : 0
          const barThreshold = (idx + 1) / WAVEFORM_BARS.length
          const isActive = isPlaying && progress >= barThreshold - 0.05
          return (
            <span
              key={idx}
              className={`flex-1 max-w-[4px] min-w-[2px] rounded-full transition-all duration-150 ${
                isActive
                  ? 'scale-y-110 opacity-100 bg-accent-text dark:bg-accent'
                  : 'opacity-40 bg-text-secondary'
              }`}
              style={{ height: `${Math.max(4, Math.round(height * 24))}px` }}
            />
          )
        })}
      </div>

      {/* Saved label & time: vertical column with gap between top-right and bottom-right */}
      <div className="self-stretch flex flex-col justify-between items-end shrink-0 min-h-[40px] pl-0.5">
        {isSaved ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold bg-accent/15 text-accent-text border border-accent/25 shrink-0">
            <Bookmark className="w-2 h-2 fill-current" />
            Saved
          </span>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">
            {formatSec(currentTime > 0 ? currentTime : duration)}
          </span>
          {showTimestamp && timestamp && (
            <span className="text-[10px] text-text-secondary font-sans opacity-70">
              • {timestamp}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function SnapCard({
  event,
  isSent,
  timestamp = '',
  highlightClasses = '',
}: {
  event: SnapEvent
  isSent: boolean
  timestamp?: string
  highlightClasses?: string
}) {
  const [showInfo, setShowInfo] = useState(false)
  const isVideo = event.mediaType === 'VIDEO'

  return (
    <div
      className={`space-y-1.5 min-w-[210px] sm:min-w-[250px] max-w-full p-3 rounded-2xl border transition shadow-2xs ${
        isSent
          ? 'bg-surface-raised border-border text-text-primary'
          : 'bg-surface border-border text-text-primary'
      } ${highlightClasses}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
            isVideo
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
              <span className="text-[9px] font-mono px-1 py-0.5 rounded font-semibold uppercase tracking-wider bg-surface-raised border border-border text-text-secondary">
                {isVideo ? 'Video' : 'Photo'}
              </span>
            </div>
            <button
              onClick={() => setShowInfo((prev) => !prev)}
              title="Why isn't this playable?"
              className="opacity-60 hover:opacity-100 cursor-pointer p-0.5 rounded transition text-text-secondary"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[10px] opacity-75 text-text-secondary leading-tight">
              {isSent ? 'Delivered' : 'Opened'} • Ephemeral snap
            </p>
            {timestamp && (
              <span className="text-[10px] text-text-secondary opacity-70 shrink-0">
                {timestamp}
              </span>
            )}
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="text-[10px] p-2 rounded-xl leading-relaxed bg-surface-raised text-text-secondary border border-border">
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

function StickerCard({
  isSent,
  isSaved = false,
  timestamp = '',
  highlightClasses = '',
}: {
  isSent: boolean
  isSaved?: boolean
  timestamp?: string
  highlightClasses?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl border transition shadow-2xs text-xs font-medium ${
        isSent
          ? 'bg-surface-raised border-border text-text-primary'
          : 'bg-surface border-border text-text-primary'
      } ${highlightClasses}`}
    >
      <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
        <Smile className="w-4 h-4" />
      </div>
      <span className="font-bold text-xs">Sticker</span>
      {isSaved && (
        <span title="Saved in chat" className="inline-flex items-center">
          <Bookmark className="w-2.5 h-2.5 fill-current text-accent-text shrink-0" />
        </span>
      )}
      {timestamp && (
        <span className="text-[10px] text-text-secondary opacity-70">• {timestamp}</span>
      )}
    </div>
  )
}

function AudioNoteCard({
  event,
  isSent,
  timestamp = '',
  highlightClasses = '',
}: {
  event: MessageEvent
  isSent: boolean
  timestamp?: string
  highlightClasses?: string
}) {
  const hasFile = Boolean(event.chatMediaFiles && event.chatMediaFiles.length > 0)
  if (hasFile && event.chatMediaFiles?.[0]) {
    return (
      <ChatAudioPlayer
        filePath={event.chatMediaFiles[0]}
        isSent={isSent}
        isSaved={event.isSaved}
        timestamp={timestamp || formatTime(event.timestamp)}
        showTimestamp={true}
      />
    )
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl border transition shadow-2xs w-[260px] sm:w-[320px] max-w-full ${
        isSent
          ? 'bg-surface-raised border-border text-text-primary'
          : 'bg-surface border-border text-text-primary'
      } ${highlightClasses}`}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-surface-raised text-accent-text border border-border shadow-2xs">
        <Mic className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold">Audio Note</span>
          {event.isSaved && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-semibold bg-accent/15 text-accent-text border border-accent/25 shrink-0">
              <Bookmark className="w-2 h-2 fill-current" />
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1.5">
          {/* Static waveform placeholder */}
          <div className="flex items-center gap-1 opacity-50 flex-1">
            {[0.4, 0.7, 1.0, 0.5, 0.8, 0.6, 0.9, 0.6, 0.3].map((h, i) => (
              <span
                key={i}
                className="w-0.5 bg-current rounded-full"
                style={{ height: `${Math.round(h * 14)}px` }}
              />
            ))}
          </div>
          {timestamp && (
            <span className="text-[10px] text-text-secondary opacity-70 shrink-0">{timestamp}</span>
          )}
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
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null)
  const isSent = event.direction === 'sent'
  const isSnap = event.type === 'snap'

  const message = event.type === 'message' ? event : null
  const hasMediaFiles = Boolean(message?.chatMediaFiles && message.chatMediaFiles.length > 0)

  const isVisualMedia =
    hasMediaFiles &&
    (message?.mediaType === 'MEDIA' ||
      message?.mediaType === 'SHARE' ||
      message?.mediaType === 'SHARESAVEDSTORY')

  const isAudioNote = hasMediaFiles && message?.mediaType === 'NOTE'

  const isRedundantVoiceNoteCaption =
    message?.mediaType === 'NOTE' &&
    Boolean(message?.content && /^(voice|audio)\s*(note|message)?$/i.test(message.content.trim()))

  const hasCaption = Boolean(
    message?.content && message.content.trim() && !isRedundantVoiceNoteCaption,
  )

  const formattedTime = formatTime(event.timestamp)
  const isSingleVideo =
    message?.chatMediaFiles?.length === 1 &&
    (message.chatMediaFiles[0]!.endsWith('.mp4') || message.chatMediaFiles[0]!.endsWith('.mov'))
  const isSharedStory = message?.mediaType === 'SHARE' || message?.mediaType === 'SHARESAVEDSTORY'

  const highlightClasses = isHighlighted
    ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg shadow-lg animate-pulse'
    : ''

  const renderContent = () => {
    if (isSnap) {
      return <SnapCard event={event} isSent={isSent} timestamp={formattedTime} />
    }

    const msg = event
    switch (msg.mediaType) {
      case 'MEDIA':
        return <MediaCard event={msg} isSent={isSent} />
      case 'NOTE':
        return <AudioNoteCard event={msg} isSent={isSent} timestamp={formattedTime} />
      case 'STICKER':
        return <StickerCard isSent={isSent} isSaved={msg.isSaved} timestamp={formattedTime} />
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

      {isVisualMedia ? (
        hasCaption ? (
          <div className="flex flex-col gap-1.5 w-[280px] sm:w-[340px] max-w-[85vw]">
            {/* Unwrapped media grid on top */}
            <div
              className={`relative rounded-2xl overflow-hidden shadow-2xs w-full ${highlightClasses}`}
            >
              <ChatMediaGrid
                files={message!.chatMediaFiles!}
                onSelectMedia={(idx) => setActiveMediaIndex(idx)}
              />

              {isSharedStory && (
                <span className="text-[10px] text-white font-medium bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full absolute top-2 left-2 pointer-events-none z-10">
                  Shared Story
                </span>
              )}
            </div>

            {/* Wrapped caption bubble below */}
            <div
              className={`px-3.5 py-2 rounded-2xl shadow-2xs w-fit max-w-full ${
                isSent
                  ? 'bg-sent text-accent-fg font-medium rounded-br-xs self-end'
                  : 'bg-surface-raised border border-border text-text-primary rounded-bl-xs self-start'
              }`}
            >
              <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                {message!.content}
              </p>

              {/* Footer info: time + saved bookmark */}
              <div
                className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                  isSent ? 'text-accent-fg/70' : 'text-text-secondary'
                }`}
              >
                {message!.isSaved && (
                  <span title="Saved in chat" className="inline-flex items-center">
                    <Bookmark className="w-2.5 h-2.5 fill-current shrink-0" />
                  </span>
                )}
                <span>{formattedTime}</span>
              </div>
            </div>

            {activeMediaIndex !== null && (
              <ChatMediaLightboxModal
                files={message!.chatMediaFiles!}
                initialIndex={activeMediaIndex}
                onClose={() => setActiveMediaIndex(null)}
              />
            )}
          </div>
        ) : (
          <div
            className={`relative rounded-2xl overflow-hidden shadow-2xs w-[280px] sm:w-[340px] max-w-[85vw] ${highlightClasses}`}
          >
            <ChatMediaGrid
              files={message!.chatMediaFiles!}
              onSelectMedia={(idx) => setActiveMediaIndex(idx)}
            />

            {isSharedStory && (
              <span className="text-[10px] text-white font-medium bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full absolute top-2 left-2 pointer-events-none z-10">
                Shared Story
              </span>
            )}

            {/* Floating timestamp badge */}
            <div
              className={`absolute ${
                isSingleVideo ? 'top-2 right-2' : 'bottom-2 right-2'
              } px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1 shadow-xs pointer-events-none select-none z-10`}
            >
              {message!.isSaved && (
                <span title="Saved in chat" className="inline-flex items-center">
                  <Bookmark className="w-2.5 h-2.5 fill-current shrink-0 text-amber-300" />
                </span>
              )}
              <span>{formattedTime}</span>
            </div>

            {activeMediaIndex !== null && (
              <ChatMediaLightboxModal
                files={message!.chatMediaFiles!}
                initialIndex={activeMediaIndex}
                onClose={() => setActiveMediaIndex(null)}
              />
            )}
          </div>
        )
      ) : isAudioNote ? (
        hasCaption ? (
          <div className="flex flex-col gap-1.5 w-[280px] sm:w-[360px] max-w-[85vw]">
            {/* Unwrapped voice note card on top */}
            <div className={`w-full rounded-2xl ${highlightClasses}`}>
              <ChatAudioPlayer
                filePath={message!.chatMediaFiles![0]!}
                isSent={isSent}
                isSaved={false}
                showTimestamp={false}
              />
            </div>

            {/* Wrapped caption bubble below */}
            <div
              className={`px-3.5 py-2 rounded-2xl shadow-2xs w-fit max-w-full ${
                isSent
                  ? 'bg-sent text-accent-fg font-medium rounded-br-xs self-end'
                  : 'bg-surface-raised border border-border text-text-primary rounded-bl-xs self-start'
              }`}
            >
              <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                {message!.content}
              </p>

              <div
                className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                  isSent ? 'text-accent-fg/70' : 'text-text-secondary'
                }`}
              >
                {message!.isSaved && (
                  <span title="Saved in chat" className="inline-flex items-center">
                    <Bookmark className="w-2.5 h-2.5 fill-current shrink-0" />
                  </span>
                )}
                <span>{formattedTime}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={`w-fit max-w-[85vw] rounded-2xl ${highlightClasses}`}>
            <ChatAudioPlayer
              filePath={message!.chatMediaFiles![0]!}
              isSent={isSent}
              isSaved={message!.isSaved}
              timestamp={formattedTime}
              showTimestamp={true}
            />
          </div>
        )
      ) : isSnap ? (
        <SnapCard
          event={event}
          isSent={isSent}
          timestamp={formattedTime}
          highlightClasses={highlightClasses}
        />
      ) : message?.mediaType === 'STICKER' ? (
        <StickerCard
          isSent={isSent}
          isSaved={message.isSaved}
          timestamp={formattedTime}
          highlightClasses={highlightClasses}
        />
      ) : message?.mediaType === 'NOTE' ? (
        <AudioNoteCard
          event={message}
          isSent={isSent}
          timestamp={formattedTime}
          highlightClasses={highlightClasses}
        />
      ) : (
        /* Standard wrapped chat bubble */
        <div
          className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 rounded-2xl relative shadow-2xs transition-all ${
            isSent
              ? 'bg-sent text-accent-fg font-medium rounded-br-xs'
              : 'bg-surface-raised border border-border text-text-primary rounded-bl-xs'
          } ${highlightClasses}`}
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
            <span>{formattedTime}</span>
          </div>
        </div>
      )}
    </div>
  )
}
