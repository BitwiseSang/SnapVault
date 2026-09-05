/**
 * Converts Snapchat timestamp strings or epoch numbers to ISO 8601 strings.
 * Handles:
 * - "2026-09-05 15:20:49 UTC"
 * - Epoch timestamp (millisecond or microsecond format)
 */
export function parseSnapchatDate(dateStr?: unknown, epochVal?: unknown): string {
  if (typeof epochVal === 'number' && !isNaN(epochVal) && epochVal > 0) {
    // 13 digits = milliseconds (e.g. 1788621649238)
    // 16 digits = microseconds (e.g. 1788621649238000)
    const ms = epochVal > 1e14 ? Math.floor(epochVal / 1000) : epochVal
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      return d.toISOString()
    }
  }

  if (typeof dateStr === 'string' && dateStr.trim()) {
    const trimmed = dateStr.trim()
    // Convert "YYYY-MM-DD HH:MM:SS UTC" to "YYYY-MM-DDTHH:MM:SSZ"
    if (trimmed.endsWith(' UTC')) {
      const isoCandidate = trimmed.slice(0, -4).replace(' ', 'T') + 'Z'
      const d = new Date(isoCandidate)
      if (!isNaN(d.getTime())) {
        return d.toISOString()
      }
    }

    const fallbackDate = new Date(trimmed)
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.toISOString()
    }
  }

  // Fallback to epoch 0 if completely unparseable
  return new Date(0).toISOString()
}
