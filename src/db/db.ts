import {
  AppEvent,
  CallEvent,
  EventType,
  MemoryEvent,
  MessageEvent,
  SnapEvent,
} from '../models/events'
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
  totalTexts: number
  totalMedia: number
  totalSnaps: number
  totalSaved: number
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
      totalTexts: 0,
      totalMedia: 0,
      totalSnaps: 0,
      totalSaved: 0,
      lastActivity: ev.timestamp,
      isGroup: false,
    }

    if (ev.type === 'message') {
      existing.totalMessages++
      const msg = ev as MessageEvent
      const mt = (msg.mediaType || 'TEXT').toUpperCase()
      if (mt === 'TEXT') {
        existing.totalTexts++
      } else if (mt === 'MEDIA') {
        existing.totalMedia++
      }
      if (msg.isSaved) {
        existing.totalSaved++
      }
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

export interface RankedContact {
  contact: string
  displayName: string
  totalCount: number
  sentCount: number
  receivedCount: number
}

export interface MonthlyCount {
  monthKey: string // "YYYY-MM"
  label: string // "Jan 24"
  value: number // Primary value (e.g. sent)
  subValue: number // Secondary value (e.g. received)
}

export interface StatsData {
  totalMessages: { total: number; sent: number; received: number }
  totalSnaps: { total: number; sent: number; received: number; images: number; videos: number }
  totalMemories: { total: number; images: number; videos: number }
  totalCalls: {
    total: number
    incoming: number
    completed: number
    outgoing: number
    audio: number
    video: number
    totalDurationSec: number
    avgDurationSec: number
  }
  firstEventDate: string | null
  monthlyMessages: MonthlyCount[]
  monthlySnaps: MonthlyCount[]
  monthlyMemories: MonthlyCount[]
  monthlyCalls: MonthlyCount[]
  topContactsOverall: RankedContact[]
  topContactsSnaps: RankedContact[]
}

export async function getStatsData(): Promise<StatsData> {
  const events = await db.events.toArray()

  const stats: StatsData = {
    totalMessages: { total: 0, sent: 0, received: 0 },
    totalSnaps: { total: 0, sent: 0, received: 0, images: 0, videos: 0 },
    totalMemories: { total: 0, images: 0, videos: 0 },
    totalCalls: {
      total: 0,
      incoming: 0,
      completed: 0,
      outgoing: 0,
      audio: 0,
      video: 0,
      totalDurationSec: 0,
      avgDurationSec: 0,
    },
    firstEventDate: null,
    monthlyMessages: [],
    monthlySnaps: [],
    monthlyMemories: [],
    monthlyCalls: [],
    topContactsOverall: [],
    topContactsSnaps: [],
  }

  const contactOverallMap = new Map<
    string,
    { sent: number; received: number; displayName: string }
  >()
  const contactSnapMap = new Map<string, { sent: number; received: number; displayName: string }>()

  const monthMsgMap = new Map<string, { sent: number; received: number }>()
  const monthSnapMap = new Map<string, { sent: number; received: number }>()
  const monthMemMap = new Map<string, { count: number }>()
  const monthCallMap = new Map<string, { count: number }>()

  let earliestTime = ''

  for (const ev of events) {
    if (!earliestTime || ev.timestamp < earliestTime) {
      if (ev.timestamp && !ev.timestamp.startsWith('1970')) {
        earliestTime = ev.timestamp
      }
    }

    const monthKey = ev.timestamp ? ev.timestamp.slice(0, 7) : ''

    if (ev.type === 'message') {
      const msg = ev as MessageEvent
      stats.totalMessages.total++
      const isSent = msg.direction === 'sent'
      if (isSent) stats.totalMessages.sent++
      else stats.totalMessages.received++

      if (monthKey) {
        const m = monthMsgMap.get(monthKey) ?? { sent: 0, received: 0 }
        if (isSent) m.sent++
        else m.received++
        monthMsgMap.set(monthKey, m)
      }

      if (msg.contact) {
        const c = contactOverallMap.get(msg.contact) ?? {
          sent: 0,
          received: 0,
          displayName: msg.conversationTitle ?? msg.contact,
        }
        if (isSent) c.sent++
        else c.received++
        contactOverallMap.set(msg.contact, c)
      }
    } else if (ev.type === 'snap') {
      const snap = ev as SnapEvent
      stats.totalSnaps.total++
      const isSent = snap.direction === 'sent'
      if (isSent) stats.totalSnaps.sent++
      else stats.totalSnaps.received++

      if (snap.mediaType === 'VIDEO') stats.totalSnaps.videos++
      else stats.totalSnaps.images++

      if (monthKey) {
        const m = monthSnapMap.get(monthKey) ?? { sent: 0, received: 0 }
        if (isSent) m.sent++
        else m.received++
        monthSnapMap.set(monthKey, m)
      }

      if (snap.contact) {
        const c = contactOverallMap.get(snap.contact) ?? {
          sent: 0,
          received: 0,
          displayName: snap.contact,
        }
        if (isSent) c.sent++
        else c.received++
        contactOverallMap.set(snap.contact, c)

        const sc = contactSnapMap.get(snap.contact) ?? {
          sent: 0,
          received: 0,
          displayName: snap.contact,
        }
        if (isSent) sc.sent++
        else sc.received++
        contactSnapMap.set(snap.contact, sc)
      }
    } else if (ev.type === 'memory') {
      const mem = ev as MemoryEvent
      stats.totalMemories.total++
      if (mem.mediaKind === 'Video') stats.totalMemories.videos++
      else stats.totalMemories.images++

      if (monthKey) {
        const m = monthMemMap.get(monthKey) ?? { count: 0 }
        m.count++
        monthMemMap.set(monthKey, m)
      }
    } else if (ev.type === 'call') {
      const call = ev as CallEvent
      stats.totalCalls.total++
      if (call.callCategory === 'Incoming Calls') stats.totalCalls.incoming++
      else if (call.callCategory === 'Completed Calls') stats.totalCalls.completed++
      else if (call.callCategory === 'Outgoing Calls') stats.totalCalls.outgoing++

      if (call.callType === 'VIDEO') stats.totalCalls.video++
      else stats.totalCalls.audio++

      stats.totalCalls.totalDurationSec += call.lengthSec

      if (monthKey) {
        const m = monthCallMap.get(monthKey) ?? { count: 0 }
        m.count++
        monthCallMap.set(monthKey, m)
      }
    }
  }

  stats.firstEventDate = earliestTime || null
  if (stats.totalCalls.completed > 0) {
    stats.totalCalls.avgDurationSec = Math.round(
      stats.totalCalls.totalDurationSec / stats.totalCalls.completed,
    )
  }

  // Convert monthly maps to sorted arrays
  const formatMonthLabel = (key: string) => {
    try {
      const [y, m] = key.split('-')
      const d = new Date(Number(y), Number(m) - 1, 1)
      return d.toLocaleDateString([], { month: 'short', year: '2-digit' })
    } catch {
      return key
    }
  }

  const allMonths = Array.from(
    new Set([
      ...monthMsgMap.keys(),
      ...monthSnapMap.keys(),
      ...monthMemMap.keys(),
      ...monthCallMap.keys(),
    ]),
  ).sort()

  stats.monthlyMessages = allMonths.map((mk) => {
    const d = monthMsgMap.get(mk) ?? { sent: 0, received: 0 }
    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      value: d.sent,
      subValue: d.received,
    }
  })

  stats.monthlySnaps = allMonths.map((mk) => {
    const d = monthSnapMap.get(mk) ?? { sent: 0, received: 0 }
    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      value: d.sent,
      subValue: d.received,
    }
  })

  stats.monthlyMemories = allMonths.map((mk) => {
    const d = monthMemMap.get(mk) ?? { count: 0 }
    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      value: d.count,
      subValue: 0,
    }
  })

  stats.monthlyCalls = allMonths.map((mk) => {
    const d = monthCallMap.get(mk) ?? { count: 0 }
    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      value: d.count,
      subValue: 0,
    }
  })

  // Rank contacts
  stats.topContactsOverall = Array.from(contactOverallMap.entries())
    .map(([contact, data]) => ({
      contact,
      displayName: data.displayName,
      totalCount: data.sent + data.received,
      sentCount: data.sent,
      receivedCount: data.received,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10)

  stats.topContactsSnaps = Array.from(contactSnapMap.entries())
    .map(([contact, data]) => ({
      contact,
      displayName: data.displayName,
      totalCount: data.sent + data.received,
      sentCount: data.sent,
      receivedCount: data.received,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10)

  return stats
}
