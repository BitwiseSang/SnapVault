import { MemoryEvent } from '../models/events'
import { IngestedFile } from '../models/ingest'
import { parseSnapchatDate } from './date'

interface RawMemoryEntry {
  Date?: unknown
  'Media Type'?: unknown
  Location?: unknown
  'Download Link'?: unknown
  'Media Download Url'?: unknown
}

export interface ParseMemoryResult {
  events: MemoryEvent[]
  warnings: string[]
}

/**
 * Parses Snapchat memories using the files-drive strategy (files are primary source of truth).
 * Enumerate files in `memories/`:
 * - Identify main media files ending in `-main.(jpg|mp4|...)`
 * - Match optional sibling overlay file ending in `-overlay.png`
 * - Match metadata from memories_history.json by date (YYYY-MM-DD) + media type
 */
export function parseMemories(rawJson: unknown, allFiles: IngestedFile[]): ParseMemoryResult {
  const events: MemoryEvent[] = []
  const warnings: string[] = []

  // 1. Index raw JSON entries by date
  const jsonByDate = new Map<string, RawMemoryEntry[]>()

  if (rawJson && typeof rawJson === 'object') {
    const rawObj = rawJson as { 'Saved Media'?: unknown }
    if (Array.isArray(rawObj['Saved Media'])) {
      for (const item of rawObj['Saved Media']) {
        if (item && typeof item === 'object') {
          const entry = item as RawMemoryEntry
          if (typeof entry.Date === 'string') {
            const datePrefix = entry.Date.slice(0, 10) // "YYYY-MM-DD"
            const list = jsonByDate.get(datePrefix) ?? []
            list.push(entry)
            jsonByDate.set(datePrefix, list)
          }
        }
      }
    } else {
      warnings.push('memories_history.json does not contain a "Saved Media" array')
    }
  }

  // 2. Identify all files in memories/
  const overlayMap = new Map<string, string>() // basePrefix -> overlay path
  const mainFiles: { path: string; basePrefix: string; ext: string; datePrefix: string }[] = []

  for (const f of allFiles) {
    const path = f.path
    if (!path.startsWith('memories/')) continue
    if (path.endsWith('memories.html')) continue

    // Extract filename after last slash
    const filename = path.slice(path.lastIndexOf('/') + 1)
    // Matches e.g. "2019-11-01_143f7137-6e9f-438a-c87d-ad54d7b72c70-main.jpg"
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_([a-f0-9-]+)-(main|overlay)\.([a-z0-9]+)$/i)
    if (!match) continue

    const datePrefix = match[1]!
    const uuid = match[2]!
    const kind = match[3]!.toLowerCase()
    const ext = match[4]!.toLowerCase()
    const basePrefix = `${datePrefix}_${uuid}`

    if (kind === 'overlay') {
      overlayMap.set(basePrefix, path)
    } else if (kind === 'main') {
      mainFiles.push({
        path,
        basePrefix,
        ext,
        datePrefix,
      })
    }
  }

  // Sort main files for deterministic ordering
  mainFiles.sort((a, b) => a.path.localeCompare(b.path))

  // Keep track of used JSON entries per date to prevent duplicate assignment
  const usedJsonIndices = new Map<string, Set<number>>()

  for (const item of mainFiles) {
    const { path, basePrefix, ext, datePrefix } = item
    const overlayFile = overlayMap.get(basePrefix)
    const mediaKind: 'Image' | 'Video' = ext === 'mp4' ? 'Video' : 'Image'

    let timestamp = `${datePrefix}T00:00:00.000Z`
    let location = ''

    const candidates = jsonByDate.get(datePrefix)
    if (candidates && candidates.length > 0) {
      if (!usedJsonIndices.has(datePrefix)) {
        usedJsonIndices.set(datePrefix, new Set())
      }
      const used = usedJsonIndices.get(datePrefix)!

      // Find first unused candidate of matching media type, or any unused candidate
      let foundIdx = -1
      for (let i = 0; i < candidates.length; i++) {
        if (used.has(i)) continue
        const cand = candidates[i]!
        const candType = typeof cand['Media Type'] === 'string' ? cand['Media Type'] : ''
        if (candType.toLowerCase() === mediaKind.toLowerCase()) {
          foundIdx = i
          break
        }
      }

      // If no exact media-type match, take first unused
      if (foundIdx === -1) {
        for (let i = 0; i < candidates.length; i++) {
          if (!used.has(i)) {
            foundIdx = i
            break
          }
        }
      }

      if (foundIdx !== -1) {
        used.add(foundIdx)
        const matched = candidates[foundIdx]!
        timestamp = parseSnapchatDate(matched.Date)
        location = typeof matched.Location === 'string' ? matched.Location : ''
      }
    }

    const id = `mem_${basePrefix}`

    events.push({
      id,
      type: 'memory',
      timestamp,
      mediaFile: path,
      overlayFile,
      mediaKind,
      location,
    })
  }

  return { events, warnings }
}
