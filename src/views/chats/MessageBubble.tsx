import { Camera, Video, Mic, Smile, MapPin, Share2, Bookmark, Bell } from 'lucide-react'
import { TimelineEvent } from '../../db/db'

interface MessageBubbleProps {
  event: TimelineEvent
  showSenderName?: boolean
}

export function MessageBubble({ event, showSenderName = false }: MessageBubbleProps) {
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

  const getMediaPlaceholder = () => {
    if (isSnap) {
      return (
        <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
          {event.mediaType === 'VIDEO' ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          Snap ({event.mediaType.toLowerCase()})
        </span>
      )
    }

    // MessageEvent
    const msg = event
    switch (msg.mediaType) {
      case 'MEDIA':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <Camera className="w-3.5 h-3.5" /> Media attachment
          </span>
        )
      case 'NOTE':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <Mic className="w-3.5 h-3.5" /> Audio note
          </span>
        )
      case 'STICKER':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <Smile className="w-3.5 h-3.5" /> Sticker
          </span>
        )
      case 'LOCATION':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <MapPin className="w-3.5 h-3.5" /> Shared location
          </span>
        )
      case 'SHARE':
      case 'SHARESAVEDSTORY':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <Share2 className="w-3.5 h-3.5" /> Shared story
          </span>
        )
      case 'STATUS':
        return (
          <span className="inline-flex items-center gap-1.5 opacity-80 text-xs italic">
            <Bell className="w-3.5 h-3.5" /> Status update
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 opacity-70 text-xs italic">
            Ephemeral message
          </span>
        )
    }
  }

  return (
    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} my-1 group`}>
      {showSenderName && !isSent && event.contact && (
        <span className="text-[11px] font-medium text-text-secondary mb-0.5 ml-2">
          {event.contact}
        </span>
      )}

      <div
        className={`max-w-[78%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl relative shadow-2xs transition-all ${
          isSent
            ? 'bg-sent text-accent-fg font-medium rounded-br-xs'
            : 'bg-surface-raised border border-border text-text-primary rounded-bl-xs'
        }`}
      >
        {/* Message body / placeholder */}
        {event.type === 'message' && event.content ? (
          <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{event.content}</p>
        ) : (
          getMediaPlaceholder()
        )}

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
