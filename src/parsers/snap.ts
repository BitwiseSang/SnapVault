import { SnapEvent } from '../models/events'
import { parseSnapchatDate } from './date'

interface RawSnapEntry {
  From?: unknown
  'Media Type'?: unknown
  Created?: unknown
  'Conversation Title'?: unknown
  IsSender?: unknown
  'Created(microseconds)'?: unknown
}

export interface ParseSnapResult {
  events: SnapEvent[]
  warnings: string[]
}

export function parseSnaps(raw: unknown): ParseSnapResult {
  const events: SnapEvent[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      events: [],
      warnings: ['snap_history.json root is not an object keyed by contact'],
    }
  }

  const record = raw as Record<string, unknown>

  for (const [contact, snaps] of Object.entries(record)) {
    if (!Array.isArray(snaps)) {
      warnings.push(`Snap entry for contact "${contact}" is not an array, skipping`)
      continue
    }

    snaps.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') {
        warnings.push(`Malformed snap at index ${index} for contact "${contact}"`)
        return
      }

      const snap = item as RawSnapEntry
      const from = typeof snap.From === 'string' ? snap.From : contact
      const isSender = typeof snap.IsSender === 'boolean' ? snap.IsSender : from !== contact
      const rawMediaType = typeof snap['Media Type'] === 'string' ? snap['Media Type'] : 'IMAGE'
      const mediaType: 'IMAGE' | 'VIDEO' = rawMediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE'

      const conversationTitle =
        typeof snap['Conversation Title'] === 'string' && snap['Conversation Title'].trim()
          ? snap['Conversation Title'].trim()
          : null

      const timestamp = parseSnapchatDate(snap.Created, snap['Created(microseconds)'])
      const epochKey =
        typeof snap['Created(microseconds)'] === 'number'
          ? snap['Created(microseconds)'].toString()
          : timestamp

      const id = `snap_${contact}_${epochKey}_${index}`

      events.push({
        id,
        type: 'snap',
        timestamp,
        contact,
        direction: isSender ? 'sent' : 'received',
        mediaType,
        conversationTitle,
      })
    })
  }

  return { events, warnings }
}
