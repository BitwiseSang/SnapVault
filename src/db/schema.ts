import Dexie, { type EntityTable } from 'dexie'
import { AppEvent } from '../models/events'
import { ImportMetaRecord } from '../models/ingest'

export interface StoredMediaFile {
  path: string
  blob: Blob
  mimeType: string
}

export class SnapVaultDatabase extends Dexie {
  events!: EntityTable<AppEvent, 'id'>
  meta!: EntityTable<ImportMetaRecord, 'id'>
  mediaFiles!: EntityTable<StoredMediaFile, 'path'>

  constructor() {
    super('SnapVaultDB')
    this.version(1).stores({
      events: 'id, type, timestamp, contact, [type+timestamp], [type+contact]',
      meta: 'id',
      mediaFiles: 'path',
    })
  }
}

export const db = new SnapVaultDatabase()
