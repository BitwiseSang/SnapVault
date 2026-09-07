import { describe, expect, it } from 'vitest'
import { parseChat } from '../../src/parsers/chat'
import { parseSnaps } from '../../src/parsers/snap'
import { parseCalls } from '../../src/parsers/call'
import { parseMemories } from '../../src/parsers/memory'
import { IngestedFile } from '../../src/models/ingest'

describe('parseChat', () => {
  it('parses chat messages with contact grouping and directions', () => {
    const raw = {
      alice: [
        {
          From: 'alice',
          'Media Type': 'TEXT',
          Created: '2026-09-05 12:00:00 UTC',
          Content: 'Hello!',
          'Conversation Title': null,
          IsSender: false,
          'Created(microseconds)': 1788611483050,
          IsSaved: true,
          'Media IDs': '',
        },
        {
          From: 'user',
          'Media Type': 'MEDIA',
          Created: '2026-09-05 12:05:00 UTC',
          Content: null,
          'Conversation Title': 'Family Group',
          IsSender: true,
          'Created(microseconds)': 1788611783050,
          IsSaved: false,
          'Media IDs': 'media123',
        },
      ],
    }

    const { events, warnings } = parseChat(raw)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(2)

    expect(events[0]).toMatchObject({
      type: 'message',
      contact: 'alice',
      direction: 'received',
      mediaType: 'TEXT',
      content: 'Hello!',
      isSaved: true,
      conversationTitle: null,
    })

    expect(events[1]).toMatchObject({
      type: 'message',
      contact: 'alice',
      direction: 'sent',
      mediaType: 'MEDIA',
      content: null,
      isSaved: false,
      mediaIds: 'media123',
      conversationTitle: 'Family Group',
    })
  })

  it('degrades gracefully on invalid root or item', () => {
    const result1 = parseChat(null)
    expect(result1.events).toHaveLength(0)
    expect(result1.warnings.length).toBeGreaterThan(0)

    const result2 = parseChat({
      bob: ['not an object', null],
    })
    expect(result2.events).toHaveLength(0)
    expect(result2.warnings).toHaveLength(2)
  })
})

describe('parseSnaps', () => {
  it('parses snap events correctly', () => {
    const raw = {
      charlie: [
        {
          From: 'charlie',
          'Media Type': 'IMAGE',
          Created: '2026-09-04 10:00:00 UTC',
          'Conversation Title': null,
          IsSender: false,
          'Created(microseconds)': 1788518910259,
        },
        {
          From: 'me',
          'Media Type': 'VIDEO',
          Created: '2026-09-04 11:00:00 UTC',
          'Conversation Title': null,
          IsSender: true,
          'Created(microseconds)': 1788522510259,
        },
      ],
    }

    const { events, warnings } = parseSnaps(raw)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(2)
    expect(events[0]?.mediaType).toBe('IMAGE')
    expect(events[0]?.direction).toBe('received')
    expect(events[1]?.mediaType).toBe('VIDEO')
    expect(events[1]?.direction).toBe('sent')
  })
})

describe('parseCalls', () => {
  it('parses incoming and completed call records', () => {
    const raw = {
      'Outgoing Calls': [],
      'Incoming Calls': [
        {
          'Date & Time': '2026-08-21 14:05:41 UTC',
          Type: 'VIDEO',
          'People in Chat': 2,
          Result: 'Call Received',
          City: 'Nairobi',
          Country: 'KE',
          'Length (sec)': 58,
          Network: 'WIFI',
        },
      ],
      'Completed Calls': [
        {
          'Date & Time': '2026-08-19 06:29:10 UTC',
          Type: 'AUDIO',
          'People in Chat': 2,
          City: 'Nairobi',
          Country: 'KE',
          'Length (sec)': 25,
          Network: 'WIFI',
        },
      ],
      'Chat Sessions': [],
      'Game Sessions': [],
    }

    const { events, warnings } = parseCalls(raw)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(2)

    expect(events[0]).toMatchObject({
      type: 'call',
      callType: 'VIDEO',
      callCategory: 'Incoming Calls',
      result: 'Call Received',
      lengthSec: 58,
      city: 'Nairobi',
    })

    expect(events[1]).toMatchObject({
      type: 'call',
      callType: 'AUDIO',
      callCategory: 'Completed Calls',
      lengthSec: 25,
    })
  })
})

describe('parseMemories', () => {
  it('links main file with overlay and attaches matching JSON metadata', () => {
    const rawJson = {
      'Saved Media': [
        {
          Date: '2026-09-02 15:27:36 UTC',
          'Media Type': 'Video',
          Location: 'Latitude, Longitude: 0.5, 35.2',
          'Download Link': '',
          'Media Download Url': '',
        },
        {
          Date: '2026-09-02 16:00:00 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: 1.0, 36.0',
          'Download Link': '',
          'Media Download Url': '',
        },
      ],
    }

    const dummyBlob = new Blob([''], { type: 'image/jpeg' })
    const allFiles: IngestedFile[] = [
      {
        path: 'memories/2026-09-02_11111111-2222-3333-4444-555555555555-main.mp4',
        file: dummyBlob,
      },
      {
        path: 'memories/2026-09-02_11111111-2222-3333-4444-555555555555-overlay.png',
        file: dummyBlob,
      },
      {
        path: 'memories/2026-09-02_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-main.jpg',
        file: dummyBlob,
      },
      {
        path: 'memories/memories.html',
        file: dummyBlob,
      },
    ]

    const { events, warnings } = parseMemories(rawJson, allFiles)
    expect(warnings).toHaveLength(0)
    expect(events).toHaveLength(2)

    // Video memory
    const videoMem = events.find((e) => e.mediaKind === 'Video')
    expect(videoMem).toBeDefined()
    expect(videoMem?.mediaFile).toBe(
      'memories/2026-09-02_11111111-2222-3333-4444-555555555555-main.mp4',
    )
    expect(videoMem?.overlayFile).toBe(
      'memories/2026-09-02_11111111-2222-3333-4444-555555555555-overlay.png',
    )
    expect(videoMem?.location).toBe('Latitude, Longitude: 0.5, 35.2')
    expect(videoMem?.timestamp).toBe('2026-09-02T15:27:36.000Z')

    // Image memory
    const imgMem = events.find((e) => e.mediaKind === 'Image')
    expect(imgMem).toBeDefined()
    expect(imgMem?.overlayFile).toBeUndefined()
    expect(imgMem?.location).toBe('Latitude, Longitude: 1.0, 36.0')
  })

  it('handles memories files without matching JSON entries gracefully', () => {
    const dummyBlob = new Blob([''], { type: 'image/jpeg' })
    const allFiles: IngestedFile[] = [
      {
        path: 'memories/2025-01-01_12345678-1234-1234-1234-123456789abc-main.jpg',
        file: dummyBlob,
      },
    ]

    const { events } = parseMemories({ 'Saved Media': [] }, allFiles)
    expect(events).toHaveLength(1)
    expect(events[0]?.timestamp).toBe('2025-01-01T00:00:00.000Z')
    expect(events[0]?.location).toBe('')
  })

  it('correctly pairs same-day memories chronologically using lastModified instead of random UUIDs', () => {
    const rawJson = {
      'Saved Media': [
        // JSON entries in reverse-chronological order like real Snapchat export
        {
          Date: '2025-01-13 14:00:00 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: -0.1676, 35.9662', // Nakuru
          'Download Link': '',
          'Media Download Url': '',
        },
        {
          Date: '2025-01-13 08:00:00 UTC',
          'Media Type': 'Image',
          Location: 'Latitude, Longitude: 0.5195, 35.2750', // Eldoret
          'Download Link': '',
          'Media Download Url': '',
        },
      ],
    }

    const dummyBlob = new Blob([''], { type: 'image/jpeg' })
    // Note: fff has an alphabetically later UUID than aaa, but earlier lastModified
    const allFiles: IngestedFile[] = [
      {
        path: 'memories/2025-01-13_ffffffff-9999-9999-9999-999999999999-main.jpg',
        file: dummyBlob,
        lastModified: 1736755200000, // 08:00 UTC
      },
      {
        path: 'memories/2025-01-13_aaaaaaaa-1111-1111-1111-111111111111-main.jpg',
        file: dummyBlob,
        lastModified: 1736776800000, // 14:00 UTC
      },
    ]

    const { events } = parseMemories(rawJson, allFiles)
    expect(events).toHaveLength(2)

    // Earlier file (ffffffff) should receive earlier 08:00 UTC Eldoret location
    const morningEvent = events.find(
      (e) => e.mediaFile === 'memories/2025-01-13_ffffffff-9999-9999-9999-999999999999-main.jpg',
    )
    expect(morningEvent?.timestamp).toBe('2025-01-13T08:00:00.000Z')
    expect(morningEvent?.location).toBe('Latitude, Longitude: 0.5195, 35.2750')

    // Later file (aaaaaaaa) should receive later 14:00 UTC Nakuru location
    const afternoonEvent = events.find(
      (e) => e.mediaFile === 'memories/2025-01-13_aaaaaaaa-1111-1111-1111-111111111111-main.jpg',
    )
    expect(afternoonEvent?.timestamp).toBe('2025-01-13T14:00:00.000Z')
    expect(afternoonEvent?.location).toBe('Latitude, Longitude: -0.1676, 35.9662')
  })
})
