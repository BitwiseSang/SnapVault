import { IngestedFile, IngestSource } from '../models/ingest'
import { normalizeExportPath } from './normalize'

export class FolderIngestSource implements IngestSource {
  private fileMap: Map<string, IngestedFile>

  constructor(files: IngestedFile[]) {
    this.fileMap = new Map()
    for (const f of files) {
      const normalized = normalizeExportPath(f.path)
      const lastModified =
        f.lastModified ??
        ('lastModified' in f.file && typeof f.file.lastModified === 'number'
          ? f.file.lastModified
          : undefined)
      this.fileMap.set(normalized, {
        path: normalized,
        file: f.file,
        lastModified,
      })
    }
  }

  async listFiles(): Promise<IngestedFile[]> {
    return Array.from(this.fileMap.values())
  }

  async readFile(path: string): Promise<Blob> {
    const normalized = normalizeExportPath(path)
    const entry = this.fileMap.get(normalized)
    if (!entry) {
      throw new Error(`File not found in ingest source: ${path} (normalized: ${normalized})`)
    }
    return entry.file
  }

  async readJson<T = unknown>(path: string): Promise<T> {
    const blob = await this.readFile(path)
    const text = await blob.text()
    return JSON.parse(text) as T
  }
}

/**
 * Creates an IngestSource from an array of HTML File objects (e.g. from <input webkitdirectory>).
 */
export function createIngestFromFiles(files: File[]): IngestSource {
  const ingested: IngestedFile[] = files.map((file) => ({
    path: normalizeExportPath(file.webkitRelativePath || file.name),
    file,
    lastModified: typeof file.lastModified === 'number' ? file.lastModified : undefined,
  }))
  return new FolderIngestSource(ingested)
}

/**
 * Recursively traverses a FileSystemDirectoryHandle (File System Access API).
 */
export async function createIngestFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  basePath = '',
): Promise<IngestSource> {
  const files: IngestedFile[] = []

  async function walk(dirHandle: FileSystemDirectoryHandle, currentPath: string): Promise<void> {
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle
        const file = await fileHandle.getFile()
        files.push({
          path: normalizeExportPath(entryPath),
          file,
          lastModified: typeof file.lastModified === 'number' ? file.lastModified : undefined,
        })
      } else if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, entryPath)
      }
    }
  }

  await walk(handle, basePath)
  return new FolderIngestSource(files)
}

interface WebKitEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void
  createReader(): {
    readEntries(
      successCallback: (entries: WebKitEntry[]) => void,
      errorCallback?: (error: DOMException) => void,
    ): void
  }
}

interface FileSystemAccessItem extends DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}

/**
 * Traverses drag-and-drop DataTransferItemList using webkitGetAsEntry.
 */
export async function createIngestFromDataTransfer(
  items: DataTransferItemList,
): Promise<IngestSource> {
  const files: IngestedFile[] = []

  async function traverseEntry(entry: WebKitEntry, currentPath = ''): Promise<void> {
    const itemPath = currentPath ? `${currentPath}/${entry.name}` : entry.name

    if (entry.isFile) {
      await new Promise<void>((resolve, reject) => {
        entry.file(
          (file) => {
            files.push({
              path: normalizeExportPath(itemPath),
              file,
              lastModified: typeof file.lastModified === 'number' ? file.lastModified : undefined,
            })
            resolve()
          },
          (err) => reject(err),
        )
      })
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      const entries = await new Promise<WebKitEntry[]>((resolve, reject) => {
        const result: WebKitEntry[] = []
        function readBatch(): void {
          dirReader.readEntries(
            (batch) => {
              if (batch.length === 0) {
                resolve(result)
              } else {
                result.push(...batch)
                readBatch()
              }
            },
            (err) => reject(err),
          )
        }
        readBatch()
      })

      for (const child of entries) {
        await traverseEntry(child, itemPath)
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue

    const fsaItem = item as FileSystemAccessItem
    if (typeof fsaItem.getAsFileSystemHandle === 'function') {
      try {
        const handle = await fsaItem.getAsFileSystemHandle()
        if (handle && handle.kind === 'directory') {
          return createIngestFromDirectoryHandle(handle as FileSystemDirectoryHandle)
        }
      } catch {
        // Fallback to webkitGetAsEntry
      }
    }

    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry() as unknown as WebKitEntry | null
      if (entry) {
        await traverseEntry(entry)
      }
    } else {
      const file = item.getAsFile()
      if (file) {
        files.push({
          path: normalizeExportPath(file.name),
          file,
          lastModified: typeof file.lastModified === 'number' ? file.lastModified : undefined,
        })
      }
    }
  }

  return new FolderIngestSource(files)
}
