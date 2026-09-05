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
}

let searchIndexInstance: MiniSearch<SearchDoc> | null = null

export function buildSearchIndex(events: AppEvent[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'snippet', 'contact', 'content', 'location'],
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
    ],
    searchOptions: {
      boost: { title: 3, contact: 2, content: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  })

  const docs: SearchDoc[] = []
  const uniqueContacts = new Set<string>()

  for (const ev of events) {
    // 1. Index contact names
    if (ev.contact && !uniqueContacts.has(ev.contact)) {
      uniqueContacts.add(ev.contact)
      docs.push({
        id: `contact_${ev.contact}`,
        type: 'contact',
        contact: ev.contact,
        timestamp: ev.timestamp,
        title: ev.contact,
        snippet: `Contact conversation with ${ev.contact}`,
      })
    }

    // 2. Index messages with non-null text content
    if (ev.type === 'message') {
      const msg = ev as MessageEvent
      if (msg.content && msg.content.trim()) {
        const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + '...' : msg.content
        docs.push({
          id: msg.id,
          type: 'message',
          contact: msg.contact,
          content: msg.content,
          timestamp: msg.timestamp,
          title: msg.contact ?? 'Chat',
          snippet: preview,
        })
      }
    }

    // 3. Index memories with location or date
    if (ev.type === 'memory') {
      const mem = ev as MemoryEvent
      if (mem.location && mem.location.trim() && !mem.location.includes('0.0, 0.0')) {
        docs.push({
          id: mem.id,
          type: 'memory',
          timestamp: mem.timestamp,
          location: mem.location,
          mediaFile: mem.mediaFile,
          title: `Memory (${mem.mediaKind})`,
          snippet: mem.location,
        })
      }
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
  return results.slice(0, 30) as unknown as SearchDoc[]
}

/**
 * Hook to search with built-in debouncing
 */
export function useSearch(
  query: string,
  delayMs = 150,
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
