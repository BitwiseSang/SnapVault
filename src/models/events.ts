export type EventType = 'message' | 'snap' | 'call' | 'memory'

export interface BaseEvent {
  id: string
  type: EventType
  timestamp: string // ISO 8601 string
  contact?: string // username when applicable
}

export interface MessageEvent extends BaseEvent {
  type: 'message'
  direction: 'sent' | 'received'
  mediaType: string // TEXT | MEDIA | NOTE | STICKER | LOCATION | SHARE | SHARESAVEDSTORY | STATUS
  content: string | null
  isSaved: boolean
  mediaIds: string
  conversationTitle: string | null
}

export interface SnapEvent extends BaseEvent {
  type: 'snap'
  direction: 'sent' | 'received'
  mediaType: 'IMAGE' | 'VIDEO'
  conversationTitle: string | null
}

export interface CallEvent extends BaseEvent {
  type: 'call'
  callType: 'VIDEO' | 'AUDIO'
  callCategory: 'Incoming Calls' | 'Outgoing Calls' | 'Completed Calls'
  result?: string // e.g. "Call Received" | "Call Failed" | "Call Succeeded"
  lengthSec: number
  network: string
  city: string
  country: string
}

export interface MemoryEvent extends BaseEvent {
  type: 'memory'
  mediaFile: string // relative path or identifier for the main media file
  overlayFile?: string // relative path or identifier for overlay PNG if present
  mediaKind: 'Image' | 'Video'
  location: string
}

export type AppEvent = MessageEvent | SnapEvent | CallEvent | MemoryEvent
