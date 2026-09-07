import { AppEvent } from '../models/events'
import { ImportMetaRecord, ImportResult, IngestSource } from '../models/ingest'
import { parseChat } from '../parsers/chat'
import { parseSnaps } from '../parsers/snap'
import { parseCalls } from '../parsers/call'
import { parseMemories } from '../parsers/memory'
import { enrichMessagesWithChatMedia } from '../parsers/chatMedia'
import { db, StoredMediaFile } from './schema'

export interface ImportProgress {
  phase: string
  current: number
  total: number
}

export type ProgressCallback = (progress: ImportProgress) => void

export async function runImport(
  source: IngestSource,
  onProgress?: ProgressCallback,
): Promise<ImportResult> {
  const warnings: string[] = []
  const allEvents: AppEvent[] = []
  const allFiles = await source.listFiles()

  // 1. Parse chat_history.json
  onProgress?.({ phase: 'Reading chat history...', current: 1, total: 5 })
  let messageCount = 0
  try {
    const rawChat = await source.readJson('json/chat_history.json')
    const { events: rawEvents, warnings: chatWarnings } = parseChat(rawChat)
    const { events: enrichedEvents, warnings: mediaWarnings } = enrichMessagesWithChatMedia(
      rawEvents,
      allFiles,
    )
    allEvents.push(...enrichedEvents)
    warnings.push(...chatWarnings, ...mediaWarnings)
    messageCount = enrichedEvents.length
  } catch (err) {
    warnings.push(`Could not read json/chat_history.json: ${(err as Error).message}`)
  }

  // 2. Parse snap_history.json
  onProgress?.({ phase: 'Reading snap history...', current: 2, total: 5 })
  let snapCount = 0
  try {
    const rawSnaps = await source.readJson('json/snap_history.json')
    const { events, warnings: snapWarnings } = parseSnaps(rawSnaps)
    allEvents.push(...events)
    warnings.push(...snapWarnings)
    snapCount = events.length
  } catch (err) {
    warnings.push(`Could not read json/snap_history.json: ${(err as Error).message}`)
  }

  // 3. Parse talk_history.json
  onProgress?.({ phase: 'Reading call history...', current: 3, total: 5 })
  let callCount = 0
  try {
    const rawCalls = await source.readJson('json/talk_history.json')
    const { events, warnings: callWarnings } = parseCalls(rawCalls)
    allEvents.push(...events)
    warnings.push(...callWarnings)
    callCount = events.length
  } catch (err) {
    warnings.push(`Could not read json/talk_history.json: ${(err as Error).message}`)
  }

  // 4. Parse memories
  onProgress?.({ phase: 'Reading memories and media...', current: 4, total: 5 })
  let memoryCount = 0
  let timestampsPreserved = true
  try {
    let rawMemories: unknown = null
    try {
      rawMemories = await source.readJson('json/memories_history.json')
    } catch {
      warnings.push('json/memories_history.json not found, parsing memories from files only')
    }

    const {
      events,
      warnings: memWarnings,
      timestampsPreserved: memTsPreserved,
    } = parseMemories(rawMemories, allFiles)
    allEvents.push(...events)
    warnings.push(...memWarnings)
    memoryCount = events.length
    timestampsPreserved = memTsPreserved
  } catch (err) {
    warnings.push(`Error parsing memories: ${(err as Error).message}`)
  }

  // 5. Ingest media files into Dexie mediaFiles table
  onProgress?.({ phase: 'Indexing media files in local database...', current: 5, total: 5 })
  const mediaToStore: StoredMediaFile[] = []
  for (const f of allFiles) {
    if (f.path.startsWith('memories/') && !f.path.endsWith('memories.html')) {
      const ext = f.path.slice(f.path.lastIndexOf('.') + 1).toLowerCase()
      const mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'png' ? 'image/png' : 'image/jpeg'
      mediaToStore.push({
        path: f.path,
        blob: f.file,
        mimeType,
      })
    } else if (f.path.startsWith('chat_media/')) {
      const ext = f.path.slice(f.path.lastIndexOf('.') + 1).toLowerCase()
      let mimeType = 'image/jpeg'
      if (ext === 'mp4' || ext === 'mov') {
        mimeType = 'video/mp4'
      } else if (ext === 'png') {
        mimeType = 'image/png'
      } else if (ext === 'gif') {
        mimeType = 'image/gif'
      } else if (ext === 'webp') {
        mimeType = 'image/webp'
      }
      mediaToStore.push({
        path: f.path,
        blob: f.file,
        mimeType,
      })
    }
  }

  // 6. Bulk insert into IndexedDB (Dexie) in chunks of 5000
  const importedAt = new Date().toISOString()
  const metaRecord: ImportMetaRecord = {
    id: 'last_import',
    importedAt,
    messageCount,
    snapCount,
    callCount,
    memoryCount,
    warnings,
    timestampsPreserved,
  }

  await db.transaction('rw', [db.events, db.meta, db.mediaFiles], async () => {
    await db.events.clear()
    await db.meta.clear()
    await db.mediaFiles.clear()

    const CHUNK_SIZE = 5000
    for (let i = 0; i < allEvents.length; i += CHUNK_SIZE) {
      await db.events.bulkAdd(allEvents.slice(i, i + CHUNK_SIZE))
    }

    for (let i = 0; i < mediaToStore.length; i += CHUNK_SIZE) {
      await db.mediaFiles.bulkPut(mediaToStore.slice(i, i + CHUNK_SIZE))
    }

    await db.meta.put(metaRecord)
  })

  return {
    messageCount,
    snapCount,
    callCount,
    memoryCount,
    warnings,
    importedAt,
    timestampsPreserved,
  }
}
