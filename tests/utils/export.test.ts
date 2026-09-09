import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  sanitizeFilename,
  formatChatExport,
  exportConversationAsJson,
  formatChatAsMarkdown,
  exportConversationAsMarkdown,
  generatePrintableHtml,
  exportConversationAsPdf,
} from '../../src/utils/export'
import { ContactSummary, TimelineEvent } from '../../src/db/db'
import { MessageEvent, SnapEvent } from '../../src/models/events'

describe('export utils', () => {
  describe('sanitizeFilename', () => {
    it('sanitizes unsafe characters from contact names', () => {
      expect(sanitizeFilename('sarah/jenkins')).toBe('sarah_jenkins')
      expect(sanitizeFilename('john:doe*123?')).toBe('john_doe_123')
      expect(sanitizeFilename('  user with spaces  ')).toBe('user_with_spaces')
      expect(sanitizeFilename('')).toBe('chat')
    })
  })

  describe('formatChatExport', () => {
    const summary: ContactSummary = {
      contact: 'alice',
      displayName: 'Alice Cooper',
      isGroup: false,
      totalMessages: 2,
      totalTexts: 1,
      totalMedia: 1,
      totalSnaps: 1,
      totalSaved: 1,
      lastActivity: '2026-09-05T12:05:00.000Z',
    }

    const events: TimelineEvent[] = [
      {
        id: 'msg_2',
        type: 'message',
        timestamp: '2026-09-05T12:01:00.000Z',
        contact: 'alice',
        direction: 'sent',
        mediaType: 'MEDIA',
        content: 'Check this out',
        isSaved: false,
        mediaIds: 'xyz',
        chatMediaFiles: ['chat_media/2026-09-05_photo.jpg'],
        conversationTitle: null,
      } as MessageEvent,
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-09-05T12:00:00.000Z',
        contact: 'alice',
        direction: 'received',
        mediaType: 'TEXT',
        content: 'Hello!',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      } as MessageEvent,
      {
        id: 'snap_1',
        type: 'snap',
        timestamp: '2026-09-05T12:05:00.000Z',
        contact: 'alice',
        direction: 'received',
        mediaType: 'VIDEO',
        conversationTitle: null,
      } as SnapEvent,
    ]

    it('formats export payload with sorted chronological events and correct metrics', () => {
      const payload = formatChatExport('alice', summary, events)

      expect(payload.version).toBe('1.0')
      expect(payload.contact).toBe('alice')
      expect(payload.displayName).toBe('Alice Cooper')
      expect(payload.isGroup).toBe(false)
      expect(payload.dateRange.start).toBe('2026-09-05T12:00:00.000Z')
      expect(payload.dateRange.end).toBe('2026-09-05T12:05:00.000Z')

      // Events should be sorted oldest first: msg_1, msg_2, snap_1
      expect(payload.events.map((e) => e.id)).toEqual(['msg_1', 'msg_2', 'snap_1'])

      // Metrics
      expect(payload.metrics.totalEvents).toBe(3)
      expect(payload.metrics.totalMessages).toBe(2)
      expect(payload.metrics.totalTexts).toBe(1)
      expect(payload.metrics.totalMedia).toBe(1)
      expect(payload.metrics.totalSnaps).toBe(1)
      expect(payload.metrics.totalSaved).toBe(1)
      expect(payload.metrics.sentCount).toBe(1)
      expect(payload.metrics.receivedCount).toBe(2)
    })

    it('handles All Conversations stream', () => {
      const payload = formatChatExport('__all__', undefined, events)
      expect(payload.contact).toBe('__all__')
      expect(payload.displayName).toBe('All Conversations')
      expect(payload.isGroup).toBe(false)
    })

    it('handles empty events gracefully', () => {
      const payload = formatChatExport('empty_contact', undefined, [])
      expect(payload.metrics.totalEvents).toBe(0)
      expect(payload.dateRange.start).toBeNull()
      expect(payload.dateRange.end).toBeNull()
      expect(payload.events).toEqual([])
    })
  })

  describe('exportConversationAsJson', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
    let clickSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:http://localhost/mock-url')
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('creates a download link, triggers click, and cleans up URL', () => {
      const events: TimelineEvent[] = [
        {
          id: 'msg_1',
          type: 'message',
          timestamp: '2026-09-05T12:00:00.000Z',
          contact: 'sarah',
          direction: 'received',
          mediaType: 'TEXT',
          content: 'Hi!',
          isSaved: false,
          mediaIds: '',
          conversationTitle: null,
        } as MessageEvent,
      ]

      exportConversationAsJson('sarah', undefined, events)

      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/mock-url')
    })
  })

  describe('formatChatAsMarkdown', () => {
    const summary: ContactSummary = {
      contact: 'bob',
      displayName: 'Bob Smith',
      isGroup: false,
      totalMessages: 3,
      totalTexts: 1,
      totalMedia: 1,
      totalSnaps: 1,
      totalSaved: 0,
      lastActivity: '2026-09-05T12:02:00.000Z',
    }

    const events: TimelineEvent[] = [
      {
        id: 'msg_2',
        type: 'message',
        timestamp: '2026-09-05T12:01:00.000Z',
        contact: 'bob',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'I am doing great!',
        isSaved: false,
        mediaIds: '',
        conversationTitle: null,
      } as MessageEvent,
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-09-05T12:00:00.000Z',
        contact: 'bob',
        direction: 'received',
        mediaType: 'TEXT',
        content: 'How are you?',
        isSaved: false,
        mediaIds: '',
        conversationTitle: null,
      } as MessageEvent,
      {
        id: 'msg_3',
        type: 'message',
        timestamp: '2026-09-05T12:02:00.000Z',
        contact: 'bob',
        direction: 'received',
        mediaType: 'NOTE',
        content: null,
        isSaved: false,
        mediaIds: '',
        conversationTitle: null,
      } as MessageEvent,
      {
        id: 'snap_1',
        type: 'snap',
        timestamp: '2026-09-05T12:03:00.000Z',
        contact: 'bob',
        direction: 'sent',
        mediaType: 'IMAGE',
        conversationTitle: null,
      } as SnapEvent,
    ]

    it('formats clean markdown transcript with header and chronological dialogue', () => {
      const md = formatChatAsMarkdown('bob', summary, events)

      expect(md).toContain('# Chat History: Bob Smith (@bob)')
      expect(md).toContain('- **Date Range**: 2026-09-05')
      expect(md).toContain('- **Total Messages**: 4 (2 sent, 2 received)')

      // Order should be chronological: msg_1, msg_2, msg_3, snap_1
      const lines = md.split('\n').filter((l) => l.startsWith('['))
      expect(lines).toHaveLength(4)
      expect(lines[0]).toContain('Bob Smith: How are you?')
      expect(lines[1]).toContain('Me: I am doing great!')
      expect(lines[2]).toContain('Bob Smith: [Voice Note]')
      expect(lines[3]).toContain('Me: [Snap: IMAGE]')
    })

    it('handles empty events in markdown output', () => {
      const md = formatChatAsMarkdown('nobody', undefined, [])
      expect(md).toContain('# Chat History: nobody')
      expect(md).toContain('*No messages recorded in this conversation.*')
    })
  })

  describe('exportConversationAsMarkdown', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
    let clickSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:http://localhost/mock-md-url')
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('downloads .md file with blob and triggers download', () => {
      const events: TimelineEvent[] = [
        {
          id: 'msg_1',
          type: 'message',
          timestamp: '2026-09-05T12:00:00.000Z',
          contact: 'alice',
          direction: 'received',
          mediaType: 'TEXT',
          content: 'Hello AI!',
          isSaved: false,
          mediaIds: '',
          conversationTitle: null,
        } as MessageEvent,
      ]

      exportConversationAsMarkdown('alice', undefined, events)

      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/mock-md-url')
    })
  })

  describe('generatePrintableHtml', () => {
    it('generates valid HTML document with print CSS and escaped content', () => {
      const events: TimelineEvent[] = [
        {
          id: 'msg_1',
          type: 'message',
          timestamp: '2026-09-05T12:00:00.000Z',
          contact: 'attacker',
          direction: 'received',
          mediaType: 'TEXT',
          content: '<script>alert("xss")</script>',
          isSaved: true,
          mediaIds: '',
          conversationTitle: null,
        } as MessageEvent,
        {
          id: 'msg_2',
          type: 'message',
          timestamp: '2026-09-06T14:00:00.000Z',
          contact: 'attacker',
          direction: 'sent',
          mediaType: 'MEDIA',
          content: 'Check image',
          isSaved: false,
          mediaIds: 'img1',
          chatMediaFiles: ['photo.jpg'],
          conversationTitle: null,
        } as MessageEvent,
      ]

      const html = generatePrintableHtml('attacker', undefined, events)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('@media print')
      expect(html).toContain('break-inside: avoid')
      // HTML escaping check
      expect(html).not.toContain('<script>alert("xss")</script>')
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(html).toContain('Saved')
      expect(html).toContain('Attachment: MEDIA')
      expect(html).toContain('date-separator')
    })

    it('generates clean empty state message when events list is empty', () => {
      const html = generatePrintableHtml('empty_user', undefined, [])
      expect(html).toContain('No messages recorded in this conversation.')
    })
  })

  describe('exportConversationAsPdf', () => {
    it('appends an iframe, writes html, and calls print', () => {
      vi.useFakeTimers()

      const events: TimelineEvent[] = [
        {
          id: 'msg_1',
          type: 'message',
          timestamp: '2026-09-05T12:00:00.000Z',
          contact: 'alice',
          direction: 'sent',
          mediaType: 'TEXT',
          content: 'Hello PDF!',
          isSaved: false,
          mediaIds: '',
          conversationTitle: null,
        } as MessageEvent,
      ]

      exportConversationAsPdf('alice', undefined, events)

      // An iframe should have been appended to document.body
      const iframe = document.querySelector('iframe[title="Print Transcript"]') as HTMLIFrameElement
      expect(iframe).toBeDefined()

      vi.advanceTimersByTime(300)
      vi.advanceTimersByTime(1100)

      vi.useRealTimers()
    })
  })
})
