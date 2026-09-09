import { ContactSummary, TimelineEvent } from '../db/db'
import { MessageEvent, SnapEvent } from '../models/events'

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    if (year && month && day) {
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function getSenderLabel(ev: TimelineEvent, contact: string, displayName: string): string {
  if ('direction' in ev) {
    if (ev.direction === 'sent') return 'Me'
    if (contact === '__all__' && ev.contact) {
      return ev.contact
    }
    return displayName
  }
  return displayName
}

function getEventContentSummary(ev: TimelineEvent): string {
  if (ev.type === 'message') {
    const msg = ev as MessageEvent
    const hasMedia = Boolean((msg.chatMediaFiles && msg.chatMediaFiles.length > 0) || msg.mediaIds)
    const mediaTypeUpper = (msg.mediaType || 'TEXT').toUpperCase()

    if (msg.content && msg.content.trim()) {
      if (hasMedia || mediaTypeUpper === 'MEDIA') {
        return `${msg.content.trim()} [Attachment: ${mediaTypeUpper}]`
      }
      return msg.content.trim()
    }

    if (mediaTypeUpper === 'NOTE') return '[Voice Note]'
    if (mediaTypeUpper === 'STICKER') return '[Sticker]'
    if (mediaTypeUpper === 'LOCATION') return '[Location Shared]'
    if (hasMedia || mediaTypeUpper === 'MEDIA') return `[Attachment: ${mediaTypeUpper}]`
    return '[Ephemeral message - no text saved]'
  }

  if (ev.type === 'snap') {
    const snap = ev as SnapEvent
    return `[Snap: ${snap.mediaType || 'Media'}]`
  }

  return '[Event]'
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

export function formatChatAsMarkdown(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): string {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const isAll = contact === '__all__'
  const displayName = isAll ? 'All Conversations' : (summary?.displayName ?? contact)

  const start = sortedEvents.length > 0 ? sortedEvents[0]!.timestamp.slice(0, 10) : null
  const end =
    sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1]!.timestamp.slice(0, 10) : null
  const dateRangeStr = start && end ? (start === end ? start : `${start} to ${end}`) : 'N/A'

  let sentCount = 0
  let receivedCount = 0
  for (const ev of sortedEvents) {
    if (ev.direction === 'sent') sentCount++
    if (ev.direction === 'received') receivedCount++
  }

  const lines: string[] = [
    `# Chat History: ${displayName}${!isAll && contact !== displayName ? ` (@${contact})` : ''}`,
    `- **Exported**: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `- **Date Range**: ${dateRangeStr}`,
    `- **Total Messages**: ${sortedEvents.length} (${sentCount} sent, ${receivedCount} received)`,
    '',
    '---',
    '',
  ]

  if (sortedEvents.length === 0) {
    lines.push('*No messages recorded in this conversation.*')
    return lines.join('\n')
  }

  for (const ev of sortedEvents) {
    const timestampStr = ev.timestamp.replace('T', ' ').slice(0, 19)
    const sender = getSenderLabel(ev, contact, displayName)
    const content = getEventContentSummary(ev)
    lines.push(`[${timestampStr}] ${sender}: ${content}`)
  }

  return lines.join('\n')
}

export function exportConversationAsMarkdown(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): void {
  const markdown = formatChatAsMarkdown(contact, summary, events)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeContact = sanitizeFilename(contact === '__all__' ? 'all_conversations' : contact)
  const filename = `snapvault_chat_${safeContact}_${dateStr}.md`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function generatePrintableHtml(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): string {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const isAll = contact === '__all__'
  const displayName = isAll ? 'All Conversations' : (summary?.displayName ?? contact)

  const start = sortedEvents.length > 0 ? sortedEvents[0]!.timestamp.slice(0, 10) : null
  const end =
    sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1]!.timestamp.slice(0, 10) : null
  const dateRangeStr = start && end ? (start === end ? start : `${start} to ${end}`) : 'N/A'

  let sentCount = 0
  let receivedCount = 0
  for (const ev of sortedEvents) {
    if (ev.direction === 'sent') sentCount++
    if (ev.direction === 'received') receivedCount++
  }

  let lastDate = ''
  const itemsHtml: string[] = []

  if (sortedEvents.length === 0) {
    itemsHtml.push('<p class="empty-state">No messages recorded in this conversation.</p>')
  } else {
    for (const ev of sortedEvents) {
      const datePart = ev.timestamp.slice(0, 10)
      if (datePart !== lastDate) {
        lastDate = datePart
        itemsHtml.push(
          `<div class="date-separator"><span>${escapeHtml(formatDisplayDate(datePart))}</span></div>`,
        )
      }

      const sender = getSenderLabel(ev, contact, displayName)
      const isSent = ev.direction === 'sent'
      const timeStr = ev.timestamp.slice(11, 16)
      const isSaved = ev.type === 'message' && (ev as MessageEvent).isSaved

      let contentHtml = ''
      if (ev.type === 'message') {
        const msg = ev as MessageEvent
        const hasMedia = Boolean(
          (msg.chatMediaFiles && msg.chatMediaFiles.length > 0) || msg.mediaIds,
        )
        const mediaTypeUpper = (msg.mediaType || 'TEXT').toUpperCase()

        if (msg.content && msg.content.trim()) {
          contentHtml = `<div class="text-content">${escapeHtml(msg.content.trim())}</div>`
          if (hasMedia || mediaTypeUpper === 'MEDIA') {
            contentHtml += `<div class="badge attachment">📎 Attachment: ${escapeHtml(mediaTypeUpper)}</div>`
          }
        } else if (mediaTypeUpper === 'NOTE') {
          contentHtml = '<div class="badge attachment">🎙️ Voice Note</div>'
        } else if (mediaTypeUpper === 'STICKER') {
          contentHtml = '<div class="badge attachment">🏷️ Sticker</div>'
        } else if (mediaTypeUpper === 'LOCATION') {
          contentHtml = '<div class="badge attachment">📍 Location Shared</div>'
        } else if (hasMedia || mediaTypeUpper === 'MEDIA') {
          contentHtml += `<div class="badge attachment">📎 Attachment: ${escapeHtml(mediaTypeUpper)}</div>`
        } else {
          contentHtml =
            '<div class="placeholder-text">Ephemeral message (content not exported by Snapchat)</div>'
        }
      } else if (ev.type === 'snap') {
        const snap = ev as SnapEvent
        contentHtml = `<div class="badge snap">👻 Snap: ${escapeHtml(snap.mediaType || 'Media')}</div>`
      }

      itemsHtml.push(`
        <article class="message-row ${isSent ? 'sent' : 'received'}" aria-label="Message from ${escapeHtml(sender)}">
          <div class="message-bubble ${isSent ? 'sent' : 'received'}">
            <header class="message-meta">
              <span class="sender-name">${escapeHtml(sender)}</span>
              <time class="timestamp" datetime="${escapeHtml(ev.timestamp)}">${escapeHtml(timeStr)}</time>
              ${isSaved ? '<span class="badge saved">Saved</span>' : ''}
            </header>
            <div class="message-body">
              ${contentHtml}
            </div>
          </div>
        </article>
      `)
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chat with ${escapeHtml(displayName)} — SnapVault</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .message-row {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .date-separator {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
      margin: 0;
      padding: 24px;
      font-size: 13px;
    }
    .chat-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .chat-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 6px 0;
      color: #0f172a;
    }
    .chat-meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      color: #4b5563;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-label {
      font-weight: 600;
      color: #374151;
    }
    .date-separator {
      text-align: center;
      margin: 20px 0 14px 0;
      position: relative;
    }
    .date-separator::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: #e5e7eb;
      z-index: 1;
    }
    .date-separator span {
      position: relative;
      z-index: 2;
      background: #ffffff;
      padding: 2px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #4b5563;
      border-radius: 9999px;
      border: 1px solid #e5e7eb;
    }
    .message-row {
      display: flex;
      margin-bottom: 8px;
    }
    .message-row.sent {
      justify-content: flex-end;
    }
    .message-row.received {
      justify-content: flex-start;
    }
    .message-bubble {
      max-width: 78%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .message-bubble.sent {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e3a8a;
    }
    .message-bubble.received {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      color: #111827;
    }
    .message-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
      font-size: 11px;
    }
    .sender-name {
      font-weight: 700;
    }
    .timestamp {
      color: #6b7280;
      font-size: 10.5px;
    }
    .badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
      display: inline-block;
    }
    .badge.saved {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .badge.attachment, .badge.snap, .badge.call {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
      margin-top: 2px;
    }
    .text-content {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .placeholder-text {
      font-style: italic;
      color: #6b7280;
      font-size: 11.5px;
    }
    .empty-state {
      text-align: center;
      color: #6b7280;
      font-style: italic;
      padding: 32px 0;
    }
  </style>
</head>
<body>
  <header class="chat-header">
    <h1 class="chat-title">${escapeHtml(displayName)}${!isAll && contact !== displayName ? ` (@${escapeHtml(contact)})` : ''}</h1>
    <div class="chat-meta-bar">
      <div class="meta-item"><span class="meta-label">Date Range:</span> ${escapeHtml(dateRangeStr)}</div>
      <div class="meta-item"><span class="meta-label">Total Messages:</span> ${sortedEvents.length} (${sentCount} sent, ${receivedCount} received)</div>
      <div class="meta-item"><span class="meta-label">Exported:</span> ${escapeHtml(new Date().toISOString().slice(0, 10))}</div>
    </div>
  </header>
  <main>
    ${itemsHtml.join('\n')}
  </main>
</body>
</html>`
}

export function exportConversationAsPdf(
  contact: string,
  summary: ContactSummary | undefined,
  events: TimelineEvent[],
): void {
  const html = generatePrintableHtml(contact, summary, events)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.title = 'Print Transcript'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      if (typeof iframe.contentWindow?.print === 'function') {
        iframe.contentWindow.print()
      }
    } catch {
      // Ignore print errors or cancellation
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 1000)
    }
  }, 250)
}
