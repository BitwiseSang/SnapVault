import { AppEvent, EventType, MessageEvent, SnapEvent } from '../models/events'
import { ImportMetaRecord } from '../models/ingest'
import { db } from './schema'

export { db }

export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', [db.events, db.meta, db.mediaFiles], async () => {
    await db.events.clear()
    await db.meta.clear()
    await db.mediaFiles.clear()
  })
}

export async function getLatestImportMeta(): Promise<ImportMetaRecord | undefined> {
  return db.meta.get('last_import')
}

export async function getEventsByType<T extends AppEvent>(type: EventType): Promise<T[]> {
  const list = await db.events.where('type').equals(type).sortBy('timestamp')
  return list as T[]
}

export async function getEventsByContact(contact: string): Promise<AppEvent[]> {
  return db.events.where('contact').equals(contact).sortBy('timestamp')
}

export async function getChatMessagesByContact(contact: string): Promise<MessageEvent[]> {
  const events = await db.events
    .where('[type+contact]')
    .equals(['message', contact])
    .sortBy('timestamp')
  return events as MessageEvent[]
}

export type TimelineEvent = MessageEvent | SnapEvent

export async function getConversationTimeline(contact: string): Promise<TimelineEvent[]> {
  if (contact === '__all__') {
    const list = await db.events.where('type').anyOf(['message', 'snap']).sortBy('timestamp')
    return list as TimelineEvent[]
  }

  const list = await db.events
    .where('contact')
    .equals(contact)
    .filter((ev) => ev.type === 'message' || ev.type === 'snap')
    .sortBy('timestamp')
  return list as TimelineEvent[]
}

export async function getMediaBlob(path: string): Promise<Blob | undefined> {
  const record = await db.mediaFiles.get(path)
  return record?.blob
}

export interface ContactSummary {
  contact: string
  displayName: string
  totalMessages: number
  totalSnaps: number
  lastActivity: string
  isGroup: boolean
}

export async function getAllContactSummaries(): Promise<ContactSummary[]> {
  const events = await db.events.where('type').anyOf(['message', 'snap']).toArray()

  const summaryMap = new Map<string, ContactSummary>()

  for (const ev of events) {
    if (!ev.contact) continue
    const contact = ev.contact
    const existing = summaryMap.get(contact) ?? {
      contact,
      displayName: contact,
      totalMessages: 0,
      totalSnaps: 0,
      lastActivity: ev.timestamp,
      isGroup: false,
    }

    if (ev.type === 'message') {
      existing.totalMessages++
      const msg = ev as MessageEvent
      if (msg.conversationTitle) {
        existing.displayName = msg.conversationTitle
        existing.isGroup = true
      }
    } else if (ev.type === 'snap') {
      existing.totalSnaps++
    }

    if (ev.timestamp > existing.lastActivity) {
      existing.lastActivity = ev.timestamp
    }

    summaryMap.set(contact, existing)
  }

  return Array.from(summaryMap.values()).sort((a, b) =>
    b.lastActivity.localeCompare(a.lastActivity),
  )
}
