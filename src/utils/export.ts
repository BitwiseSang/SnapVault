import { ContactSummary, TimelineEvent } from '../db/db'

export interface ChatExportPayload {
  version: string
  exportedAt: string
  contact: string
  displayName: string
  isGroup: boolean
  metrics: {
    totalEvents: number
    totalMessages: number
    totalTexts: number
    totalMedia: number
    totalSnaps: number
    totalSaved: number
    sentCount: number
    receivedCount: number
  }
  dateRange: {
    start: string | null
    end: string | null
  }
  events: TimelineEvent[]
}

export function sanitizeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[/\\?%*:|"<> ]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'chat'
  )
}

export function formatChatExport(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): ChatExportPayload {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const isAll = contact === '__all__'
  const displayName = isAll ? 'All Conversations' : (summary?.displayName ?? contact)
  const isGroup = summary?.isGroup ?? false

  let totalMessages = 0
  let totalTexts = 0
  let totalMedia = 0
  let totalSnaps = 0
  let totalSaved = 0
  let sentCount = 0
  let receivedCount = 0

  for (const ev of sortedEvents) {
    if (ev.direction === 'sent') sentCount++
    if (ev.direction === 'received') receivedCount++

    if (ev.type === 'message') {
      totalMessages++
      const mt = (ev.mediaType || 'TEXT').toUpperCase()
      if (mt === 'TEXT') totalTexts++
      else if (mt === 'MEDIA') totalMedia++
      if (ev.isSaved) totalSaved++
    } else if (ev.type === 'snap') {
      totalSnaps++
    }
  }

  const start = sortedEvents.length > 0 ? sortedEvents[0]!.timestamp : null
  const end = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1]!.timestamp : null

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    contact,
    displayName,
    isGroup,
    metrics: {
      totalEvents: sortedEvents.length,
      totalMessages,
      totalTexts,
      totalMedia,
      totalSnaps,
      totalSaved,
      sentCount,
      receivedCount,
    },
    dateRange: {
      start,
      end,
    },
    events: sortedEvents,
  }
}

export function exportConversationAsJson(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): void {
  const exportData = formatChatExport(contact, summary, events)
  const jsonString = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeContact = sanitizeFilename(contact === '__all__' ? 'all_conversations' : contact)
  const filename = `snapvault_chat_${safeContact}_${dateStr}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
