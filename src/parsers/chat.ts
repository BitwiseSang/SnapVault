import { MessageEvent } from '../models/events'
import { parseSnapchatDate } from './date'

interface RawChatMessage {
  From?: unknown
  'Media Type'?: unknown
  Created?: unknown
  Content?: unknown
  'Conversation Title'?: unknown
  IsSender?: unknown
  'Created(microseconds)'?: unknown
  IsSaved?: unknown
  'Media IDs'?: unknown
}

export interface ParseChatResult {
  events: MessageEvent[]
  warnings: string[]
}

export function parseChat(raw: unknown): ParseChatResult {
  const events: MessageEvent[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      events: [],
      warnings: ['chat_history.json root is not an object keyed by contact'],
    }
  }

  const record = raw as Record<string, unknown>

  for (const [contact, messages] of Object.entries(record)) {
    if (!Array.isArray(messages)) {
      warnings.push(`Chat entry for contact "${contact}" is not an array, skipping`)
      continue
    }

    messages.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') {
        warnings.push(`Malformed message at index ${index} for contact "${contact}"`)
        return
      }

      const msg = item as RawChatMessage
      const from = typeof msg.From === 'string' ? msg.From : contact
      const isSender = typeof msg.IsSender === 'boolean' ? msg.IsSender : from !== contact
      const mediaType = typeof msg['Media Type'] === 'string' ? msg['Media Type'] : 'TEXT'
      const content = typeof msg.Content === 'string' ? msg.Content : null
      const isSaved = typeof msg.IsSaved === 'boolean' ? msg.IsSaved : false
      const mediaIds = typeof msg['Media IDs'] === 'string' ? msg['Media IDs'] : ''
      const conversationTitle =
        typeof msg['Conversation Title'] === 'string' && msg['Conversation Title'].trim()
          ? msg['Conversation Title'].trim()
          : null

      const timestamp = parseSnapchatDate(msg.Created, msg['Created(microseconds)'])
      const epochKey =
        typeof msg['Created(microseconds)'] === 'number'
          ? msg['Created(microseconds)'].toString()
          : timestamp

      const id = `msg_${contact}_${epochKey}_${index}`

      events.push({
        id,
        type: 'message',
        timestamp,
        contact,
        direction: isSender ? 'sent' : 'received',
        mediaType,
        content,
        isSaved,
        mediaIds,
        conversationTitle,
      })
    })
  }

  return { events, warnings }
}
