export interface IngestedFile {
  path: string // Normalized relative path, e.g. "json/chat_history.json"
  file: File | Blob
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
}
