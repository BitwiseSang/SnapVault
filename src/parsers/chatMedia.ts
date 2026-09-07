import { MessageEvent } from '../models/events'
import { IngestedFile } from '../models/ingest'

export interface EnrichChatMediaResult {
  events: MessageEvent[]
  warnings: string[]
}

/**
 * Enriches parsed chat messages with references to media files located in `chat_media/`.
 *
 * In Snapchat exports, saved chat media attachments carry a `Media IDs` field (sometimes
 * multiple IDs separated by " | "). Files in `chat_media/` follow the format:
 * `YYYY-MM-DD_<media-id>.<ext>`.
 *
 * This function builds an index of chat media files by their media ID and attaches
 * matching file paths to the corresponding MessageEvent.
 */
export function enrichMessagesWithChatMedia(
  messages: MessageEvent[],
  allFiles: IngestedFile[],
): EnrichChatMediaResult {
  const warnings: string[] = []

  // 1. Index chat_media files by their media ID
  const mediaIdToFile = new Map<string, string>()

  for (const f of allFiles) {
    if (!f.path.startsWith('chat_media/')) continue

    const filename = f.path.slice(f.path.lastIndexOf('/') + 1)
    // Matches e.g. "2026-08-24_b~EiASFURjcTBDMVVtUlhTd1BSZjFkUUpEMzIBD0gFUARgAQ.jpg"
    // or "2024-09-14_5eb01824472c90d77a99fc072323e8c2.heif"
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/)
    if (!match) continue

    const rest = match[2]!
    // Strip standard media extension to extract the clean media ID
    const cleanId = rest.replace(/\.(jpe?g|mp4|png|gif|webp|heif|mov)$/i, '')
    if (cleanId) {
      mediaIdToFile.set(cleanId, f.path)
    }
  }

  // 2. Walk messages and match Media IDs
  let totalMediaIds = 0
  let matchedMediaIds = 0

  const events: MessageEvent[] = messages.map((msg) => {
    if (!msg.mediaIds || !msg.mediaIds.trim()) {
      return msg
    }

    const ids = msg.mediaIds
      .split(' | ')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (ids.length === 0) {
      return msg
    }

    totalMediaIds += ids.length
    const chatMediaFiles: string[] = []

    for (const id of ids) {
      const filePath = mediaIdToFile.get(id)
      if (filePath) {
        chatMediaFiles.push(filePath)
        matchedMediaIds++
      }
    }

    if (chatMediaFiles.length > 0) {
      return {
        ...msg,
        chatMediaFiles,
      }
    }

    return msg
  })

  if (totalMediaIds > 0 && matchedMediaIds === 0 && mediaIdToFile.size > 0) {
    warnings.push('Found chat media files and messages with Media IDs, but none could be matched.')
  }

  return { events, warnings }
}
