import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchApp } from '../../src/search/index'
import { MessageEvent, MemoryEvent } from '../../src/models/events'

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

  it('handles contractions and normalization without generating rogue tokens', () => {
    const events: MessageEvent[] = [
      {
        id: 'msg_dont',
        type: 'message',
        timestamp: '2026-08-15T10:00:00.000Z',
        contact: 'john_doe',
        direction: 'sent',
        mediaType: 'TEXT',
        content: "Don't forget to call me later",
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
      {
        id: 'msg_lets',
        type: 'message',
        timestamp: '2026-08-16T11:00:00.000Z',
        contact: 'jane_doe',
        direction: 'sent',
        mediaType: 'TEXT',
        content: "Let's grab lunch at noon",
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
    ]

    buildSearchIndex(events)

    // Searching with apostrophe matches
    const resDont = searchApp("don't")
    expect(resDont.length).toBe(1)
    expect(resDont[0]?.id).toBe('msg_dont')

    // Searching without apostrophe also matches
    const resDontNoApos = searchApp('dont')
    expect(resDontNoApos.length).toBe(1)
    expect(resDontNoApos[0]?.id).toBe('msg_dont')

    // Searching 'lets' matches only the second message
    const resLets = searchApp("let's")
    expect(resLets.length).toBe(1)
    expect(resLets[0]?.id).toBe('msg_lets')
  })

  it('enforces AND semantics across multiple search terms', () => {
    const events: MessageEvent[] = [
      {
        id: 'msg_pizza_tonight',
        type: 'message',
        timestamp: '2026-08-15T10:00:00.000Z',
        contact: 'sam',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'Ordering pizza tonight for the party',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
      {
        id: 'msg_pizza_tomorrow',
        type: 'message',
        timestamp: '2026-08-16T11:00:00.000Z',
        contact: 'sam',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'Leftover pizza tomorrow for lunch',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
    ]

    buildSearchIndex(events)

    // Both words must match
    const resTonight = searchApp('pizza tonight')
    expect(resTonight.length).toBe(1)
    expect(resTonight[0]?.id).toBe('msg_pizza_tonight')

    const resTomorrow = searchApp('pizza tomorrow')
    expect(resTomorrow.length).toBe(1)
    expect(resTomorrow[0]?.id).toBe('msg_pizza_tomorrow')

    // No results when one term is missing
    const resNone = searchApp('pizza sushi')
    expect(resNone.length).toBe(0)
  })

  it('supports date keyword searches and media synonyms for memories', () => {
    const events: MemoryEvent[] = [
      {
        id: 'mem_summer',
        type: 'memory',
        timestamp: '2026-08-19T14:30:00.000Z',
        mediaFile: 'memories/2026-08-19_snap.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 40.7128, -74.0060 (New York)',
      },
      {
        id: 'mem_winter',
        type: 'memory',
        timestamp: '2026-12-25T09:15:00.000Z',
        mediaFile: 'memories/2026-12-25_video.mp4',
        mediaKind: 'Video',
        location: '',
      },
    ]

    buildSearchIndex(events)

    // Match by full month
    const resAugust = searchApp('August')
    expect(resAugust.some((r) => r.id === 'mem_summer')).toBe(true)

    // Match by short month
    const resAug = searchApp('Aug')
    expect(resAug.some((r) => r.id === 'mem_summer')).toBe(true)

    // Match photo synonym
    const resPhoto = searchApp('photo New York')
    expect(resPhoto.length).toBe(1)
    expect(resPhoto[0]?.id).toBe('mem_summer')

    // Match video synonym
    const resVideo = searchApp('video December')
    expect(resVideo.length).toBe(1)
    expect(resVideo[0]?.id).toBe('mem_winter')
  })
})
