import { CallEvent } from '../models/events'
import { parseSnapchatDate } from './date'

interface RawCallEntry {
  'Date & Time'?: unknown
  Type?: unknown
  'People in Chat'?: unknown
  Result?: unknown
  City?: unknown
  Country?: unknown
  'Length (sec)'?: unknown
  Network?: unknown
}

export interface ParseCallResult {
  events: CallEvent[]
  warnings: string[]
}

const CALL_CATEGORIES = ['Incoming Calls', 'Outgoing Calls', 'Completed Calls'] as const

type CallCategory = (typeof CALL_CATEGORIES)[number]

export function parseCalls(raw: unknown): ParseCallResult {
  const events: CallEvent[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      events: [],
      warnings: ['talk_history.json root is not an object'],
    }
  }

  const record = raw as Record<string, unknown>

  for (const category of CALL_CATEGORIES) {
    const list = record[category]
    if (!list) continue

    if (!Array.isArray(list)) {
      warnings.push(`Category "${category}" in talk_history.json is not an array`)
      continue
    }

    list.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') {
        warnings.push(`Malformed call record in ${category} at index ${index}`)
        return
      }

      const call = item as RawCallEntry
      const timestamp = parseSnapchatDate(call['Date & Time'])
      const rawType = typeof call.Type === 'string' ? call.Type.toUpperCase() : 'AUDIO'
      const callType: 'VIDEO' | 'AUDIO' = rawType === 'VIDEO' ? 'VIDEO' : 'AUDIO'
      const result = typeof call.Result === 'string' ? call.Result : undefined
      const lengthSec =
        typeof call['Length (sec)'] === 'number' && !isNaN(call['Length (sec)'])
          ? call['Length (sec)']
          : 0
      const network = typeof call.Network === 'string' ? call.Network : 'UNKNOWN'
      const city = typeof call.City === 'string' ? call.City : ''
      const country = typeof call.Country === 'string' ? call.Country : ''

      const id = `call_${category.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${index}`

      events.push({
        id,
        type: 'call',
        timestamp,
        callType,
        callCategory: category as CallCategory,
        result,
        lengthSec,
        network,
        city,
        country,
      })
    })
  }

  return { events, warnings }
}
