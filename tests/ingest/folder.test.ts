import { describe, expect, it } from 'vitest'
import { FolderIngestSource, createIngestFromFiles } from '../../src/ingest/folder'
import { normalizeExportPath } from '../../src/ingest/normalize'

describe('normalizeExportPath', () => {
  it('strips top-level wrapper directory prefix for json', () => {
    expect(normalizeExportPath('export_123/json/chat_history.json')).toBe('json/chat_history.json')
  })

  it('strips top-level wrapper directory prefix for memories', () => {
    expect(normalizeExportPath('archive/memories/2026-09-02_xyz-main.jpg')).toBe(
      'memories/2026-09-02_xyz-main.jpg',
    )
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeExportPath('export\\json\\chat_history.json')).toBe('json/chat_history.json')
  })

  it('keeps already normalized paths intact', () => {
    expect(normalizeExportPath('json/chat_history.json')).toBe('json/chat_history.json')
    expect(normalizeExportPath('index.html')).toBe('index.html')
  })
})

describe('FolderIngestSource', () => {
  it('lists files and reads content correctly', async () => {
    const mockJson = JSON.stringify({ hello: 'world' })
    const file = new File([mockJson], 'chat_history.json', {
      type: 'application/json',
    })

    const source = new FolderIngestSource([{ path: 'export/json/chat_history.json', file }])

    const files = await source.listFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('json/chat_history.json')

    const parsed = await source.readJson<{ hello: string }>('json/chat_history.json')
    expect(parsed.hello).toBe('world')
  })

  it('throws descriptive error if file not found', async () => {
    const source = new FolderIngestSource([])
    await expect(source.readFile('json/missing.json')).rejects.toThrow(
      'File not found in ingest source: json/missing.json',
    )
  })

  it('works with createIngestFromFiles', async () => {
    const file = new File(['test'], 'snap_history.json')
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'my_export/json/snap_history.json',
    })

    const source = createIngestFromFiles([file])
    const files = await source.listFiles()
    expect(files[0]?.path).toBe('json/snap_history.json')
  })
})
