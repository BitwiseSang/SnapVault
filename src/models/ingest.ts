export interface IngestedFile {
  path: string // Normalized relative path, e.g. "json/chat_history.json"
  file: File | Blob
  lastModified?: number // Timestamp in milliseconds from File.lastModified if available
}

export interface IngestSource {
  listFiles(): Promise<IngestedFile[]>
  readFile(path: string): Promise<Blob>
  readJson<T = unknown>(path: string): Promise<T>
}

export interface ImportResult {
  messageCount: number
  snapCount: number
  callCount: number
  memoryCount: number
  warnings: string[]
  folderName?: string
  importedAt: string // ISO timestamp
  /** True if memory file timestamps were reliably preserved from ZIP extraction. */
  timestampsPreserved: boolean
}

export interface ImportMetaRecord {
  id: string // e.g. "last_import"
  folderName?: string
  importedAt: string
  messageCount: number
  snapCount: number
  callCount: number
  memoryCount: number
  warnings: string[]
  /** True if memory file timestamps were reliably preserved from ZIP extraction.
   *  Optional because older DB records predate this field; treat absence as true. */
  timestampsPreserved?: boolean
}
