import { useState } from 'react'
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
} from 'lucide-react'
import { TimelineEvent } from '../../db/db'
import { MessageEvent, SnapEvent } from '../../models/events'

interface MessageBubbleProps {
  event: TimelineEvent
  showSenderName?: boolean
  isHighlighted?: boolean
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

function AudioNoteCard({ isSent, isSaved }: { isSent: boolean; isSaved: boolean }) {
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

        {/* Waveform graphic */}
        <div className="flex items-center gap-1 mt-1.5 opacity-60">
          <span className="w-0.5 h-2 bg-current rounded-full" />
          <span className="w-0.5 h-3.5 bg-current rounded-full" />
          <span className="w-0.5 h-5 bg-current rounded-full" />
          <span className="w-0.5 h-2.5 bg-current rounded-full" />
          <span className="w-0.5 h-4 bg-current rounded-full" />
          <span className="w-0.5 h-2 bg-current rounded-full" />
          <span className="w-0.5 h-4.5 bg-current rounded-full" />
          <span className="w-0.5 h-3 bg-current rounded-full" />
          <span className="w-0.5 h-1.5 bg-current rounded-full" />
        </div>
      </div>
    </div>
  )
}

function ShareCard({ event, isSent }: { event: MessageEvent; isSent: boolean }) {
  return (
    <div className="space-y-1.5 min-w-[190px]">
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
          isSent ? 'bg-black/8 border-black/15' : 'bg-surface border-border'
        }`}
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>Shared Story / Link</span>
      </div>
      {event.content && event.content.trim() && (
        <p className="text-sm break-words whitespace-pre-wrap leading-relaxed px-0.5">
          {event.content}
        </p>
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
        return <AudioNoteCard isSent={isSent} isSaved={msg.isSaved} />
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
