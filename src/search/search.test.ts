import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchApp } from './index'
import { MessageEvent, MemoryEvent } from '../models/events'

describe('Search Index', () => {
  it('indexes contacts, message content, and memories with search queries', () => {
    const events: (MessageEvent | MemoryEvent)[] = [
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-09-05T12:00:00.000Z',
        contact: 'sarah_connor',
        direction: 'received',
        mediaType: 'TEXT',
        content: 'Meet me at the cyberdyne building tomorrow',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
      {
        id: 'mem_1',
        type: 'memory',
        timestamp: '2026-09-02T15:27:36.000Z',
        mediaFile: 'memories/2026-09-02_xyz-main.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.5560, 35.2450 (Eldoret)',
      },
    ]

    buildSearchIndex(events)

    // 1. Search by contact
    const contactResults = searchApp('sarah')
    expect(contactResults.length).toBeGreaterThan(0)
    expect(contactResults.some((r) => r.contact === 'sarah_connor')).toBe(true)

    // 2. Search by message content
    const msgResults = searchApp('cyberdyne')
    expect(msgResults.length).toBeGreaterThan(0)
    expect(msgResults[0]?.content).toContain('cyberdyne')

    // 3. Search by memory location
    const memResults = searchApp('Eldoret')
    expect(memResults.length).toBeGreaterThan(0)
    expect(memResults[0]?.location).toContain('Eldoret')
  })

  it('returns empty array when query is blank or no index exists', () => {
    expect(searchApp('')).toEqual([])
    expect(searchApp('   ')).toEqual([])
  })
})
