import MiniSearch, { SearchResult } from 'minisearch'
import { useEffect, useMemo, useState } from 'react'
import { AppEvent, MessageEvent, MemoryEvent } from '../models/events'

export interface SearchDoc {
  id: string
  type: 'contact' | 'message' | 'memory'
  contact?: string
  content?: string
  timestamp: string
  location?: string
  mediaFile?: string
  title: string
  snippet: string
  date?: string
}

let searchIndexInstance: MiniSearch<SearchDoc> | null = null

export function searchTokenizer(text: string): string[] {
  // Normalize contractions: "don't" -> "dont", "let's" -> "lets", "it's" -> "its", "i'm" -> "im"
  // This prevents apostrophes from generating rogue single-letter 't'/'s' tokens that match other contractions
  const normalized = text.toLowerCase().replace(/(\p{L})['’](\p{L})/gu, '$1$2')
  return normalized.split(/[^\p{L}\p{N}_]+/u).filter((term) => term.length > 0)
}

export function formatDateKeywords(isoTimestamp: string): string {
  try {
    const d = new Date(isoTimestamp)
    if (Number.isNaN(d.getTime())) return ''
    const monthFull = d.toLocaleDateString('en-US', { month: 'long' })
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
    const year = d.getFullYear().toString()
    const day = d.getDate().toString()
    return `${monthFull} ${monthShort} ${year} ${day}`
  } catch {
    return ''
  }
}

export function buildSearchIndex(events: AppEvent[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'snippet', 'contact', 'content', 'location', 'date'],
    storeFields: [
      'id',
      'type',
      'contact',
      'content',
      'timestamp',
      'location',
      'mediaFile',
      'title',
      'snippet',
      'date',
    ],
    tokenize: searchTokenizer,
    searchOptions: {
      boost: { title: 3, contact: 2, content: 1.5 },
      combineWith: 'AND',
      prefix: (_term: string, i: number, terms: string[]) => i === terms.length - 1,
      fuzzy: (term: string) => (term.length >= 5 ? 1 : 0),
    },
  })

  const docs: SearchDoc[] = []
  const uniqueContacts = new Set<string>()

  for (const ev of events) {
    const dateStr = ev.timestamp ? ev.timestamp.slice(0, 10) : ''

    // 1. Index contact names
    if (ev.contact && !uniqueContacts.has(ev.contact)) {
      uniqueContacts.add(ev.contact)
      docs.push({
        id: `contact_${ev.contact}`,
        type: 'contact',
        contact: ev.contact,
        timestamp: ev.timestamp,
        date: '',
        title: ev.contact,
        snippet: `@${ev.contact}`,
      })
    }

    // 2. Index messages with non-null text content
    if (ev.type === 'message') {
      const msg = ev as MessageEvent
      if (msg.content && msg.content.trim()) {
        const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content
        const dateWords = formatDateKeywords(msg.timestamp)
        docs.push({
          id: msg.id,
          type: 'message',
          contact: msg.contact,
          content: `${msg.content} ${dateWords}`,
          timestamp: msg.timestamp,
          date: dateStr,
          title: msg.contact ?? 'Chat',
          snippet: preview,
        })
      }
    }

    // 3. Index memories
    if (ev.type === 'memory') {
      const mem = ev as MemoryEvent
      const hasLocation = mem.location && mem.location.trim() && !mem.location.includes('0.0, 0.0')
      const cleanLoc = hasLocation ? mem.location.replace('Latitude, Longitude:', '').trim() : ''
      const dateWords = formatDateKeywords(mem.timestamp)
      const mediaSynonyms = mem.mediaKind === 'Video' ? 'video clip' : 'photo image picture snap'

      docs.push({
        id: mem.id,
        type: 'memory',
        timestamp: mem.timestamp,
        date: dateStr,
        location: cleanLoc,
        mediaFile: mem.mediaFile,
        title: `${mem.mediaKind} Memory`,
        snippet: cleanLoc ? `${dateStr} • ${cleanLoc}` : dateStr,
        content: `${dateWords} ${mediaSynonyms} ${cleanLoc}`,
      })
    }
  }

  index.addAll(docs)
  searchIndexInstance = index
  return index
}

export function searchApp(query: string): SearchDoc[] {
  if (!searchIndexInstance || !query.trim()) {
    return []
  }

  const results: SearchResult[] = searchIndexInstance.search(query.trim())
  return results.slice(0, 40) as unknown as SearchDoc[]
}

/**
 * Hook to search with built-in debouncing
 */
export function useSearch(
  query: string,
  delayMs = 120,
): { results: SearchDoc[]; isSearching: boolean } {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [query, delayMs])

  const isSearching = query !== debouncedQuery

  const results = useMemo(() => {
    return debouncedQuery.trim() ? searchApp(debouncedQuery) : []
  }, [debouncedQuery])

  return { results, isSearching }
}
