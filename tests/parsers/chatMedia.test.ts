import { describe, expect, it } from 'vitest'
import { enrichMessagesWithChatMedia } from '../../src/parsers/chatMedia'
import { MessageEvent } from '../../src/models/events'
import { IngestedFile } from '../../src/models/ingest'

describe('enrichMessagesWithChatMedia', () => {
  const dummyBlob = new Blob([''], { type: 'image/jpeg' })

  it('matches single and multiple media IDs to files', () => {
    const messages: MessageEvent[] = [
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-08-24T07:58:05.000Z',
        contact: 'stray_bunnie',
        direction: 'received',
        mediaType: 'MEDIA',
        content: null,
        isSaved: true,
        mediaIds: 'b~EiASFUp5ZmJDdDJVWGplUFo3Y2k3V3NUQjIBD0gCUARgAQ',
        conversationTitle: null,
      },
      {
        id: 'msg_2',
        type: 'message',
        timestamp: '2026-08-24T04:39:01.000Z',
        contact: 'stray_bunnie',
        direction: 'sent',
        mediaType: 'MEDIA',
        content: 'Check these out',
        isSaved: true,
        mediaIds:
          'b~EiASFURjcTBDMVVtUlhTd1BSZjFkUUpEMzIBD0gFUARgAQ | 2ed2ec9a96294245f6f8149a3a9e7e2f',
        conversationTitle: null,
      },
      {
        id: 'msg_3',
        type: 'message',
        timestamp: '2026-08-24T09:00:00.000Z',
        contact: 'stray_bunnie',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'Text message without media',
        isSaved: false,
        mediaIds: '',
        conversationTitle: null,
      },
    ]

    const files: IngestedFile[] = [
      {
        path: 'chat_media/2026-08-24_b~EiASFUp5ZmJDdDJVWGplUFo3Y2k3V3NUQjIBD0gCUARgAQ.gif',
        file: dummyBlob,
      },
      {
        path: 'chat_media/2026-08-24_b~EiASFURjcTBDMVVtUlhTd1BSZjFkUUpEMzIBD0gFUARgAQ.jpg',
        file: dummyBlob,
      },
      {
        path: 'chat_media/2026-08-24_2ed2ec9a96294245f6f8149a3a9e7e2f.jpg',
        file: dummyBlob,
      },
    ]

    const { events, warnings } = enrichMessagesWithChatMedia(messages, files)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(3)

    // First message matched 1 file
    expect(events[0]?.chatMediaFiles).toEqual([
      'chat_media/2026-08-24_b~EiASFUp5ZmJDdDJVWGplUFo3Y2k3V3NUQjIBD0gCUARgAQ.gif',
    ])

    // Second message matched 2 files in order
    expect(events[1]?.chatMediaFiles).toEqual([
      'chat_media/2026-08-24_b~EiASFURjcTBDMVVtUlhTd1BSZjFkUUpEMzIBD0gFUARgAQ.jpg',
      'chat_media/2026-08-24_2ed2ec9a96294245f6f8149a3a9e7e2f.jpg',
    ])

    // Third message had no media
    expect(events[2]?.chatMediaFiles).toBeUndefined()
  })

  it('handles missing media files gracefully', () => {
    const messages: MessageEvent[] = [
      {
        id: 'msg_missing',
        type: 'message',
        timestamp: '2026-08-24T07:58:05.000Z',
        contact: 'user1',
        direction: 'received',
        mediaType: 'MEDIA',
        content: null,
        isSaved: false,
        mediaIds: 'missing_id_123',
        conversationTitle: null,
      },
    ]

    const { events } = enrichMessagesWithChatMedia(messages, [])
    expect(events[0]?.chatMediaFiles).toBeUndefined()
  })

  it('enriches NOTE voice notes with audio file', () => {
    const messages: MessageEvent[] = [
      {
        id: 'msg_note',
        type: 'message',
        timestamp: '2026-09-06T15:49:57.000Z',
        contact: 'stray_bunnie',
        direction: 'received',
        mediaType: 'NOTE',
        content: null,
        isSaved: true,
        mediaIds: 'b~EiASFUhuSWMzak9ySDZ6VkxiYkhCTHE0TjIBD0gCUARgAQ',
        conversationTitle: null,
      },
    ]

    const files: IngestedFile[] = [
      {
        path: 'chat_media/2026-09-06_b~EiASFUhuSWMzak9ySDZ6VkxiYkhCTHE0TjIBD0gCUARgAQ.mp4',
        file: dummyBlob,
      },
    ]

    const { events } = enrichMessagesWithChatMedia(messages, files)
    expect(events[0]?.chatMediaFiles).toEqual([
      'chat_media/2026-09-06_b~EiASFUhuSWMzak9ySDZ6VkxiYkhCTHE0TjIBD0gCUARgAQ.mp4',
    ])
  })
})
