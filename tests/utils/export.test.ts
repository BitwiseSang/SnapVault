import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  sanitizeFilename,
  formatChatExport,
  exportConversationAsJson,
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
})
