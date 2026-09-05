import { ChangeEvent, useState, useTransition } from 'react'
import { createIngestFromDirectoryHandle, createIngestFromFiles } from '../ingest/folder'
import { runImport, ImportProgress } from '../db/import'
import { ImportResult } from '../models/ingest'
import { clearDatabase, getLatestImportMeta } from '../db/db'
import { buildSearchIndex, useSearch } from '../search'
import { db } from '../db/schema'

export function ImportDebug() {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [, startTransition] = useTransition()
  const { results: searchResults, isSearching } = useSearch(searchQuery)

  const handleDirectoryPicker = async () => {
    setError(null)
    setResult(null)
    try {
      if ('showDirectoryPicker' in window && typeof window.showDirectoryPicker === 'function') {
        const handle = await window.showDirectoryPicker()
        const source = await createIngestFromDirectoryHandle(handle)
        const res = await runImport(source, (p) => setProgress(p))
        setResult(res)
        setProgress(null)

        // Build search index from imported events
        const allEvents = await db.events.toArray()
        buildSearchIndex(allEvents)
      } else {
        setError('Directory picker API not available in this browser. Use the file input below.')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
      }
      setProgress(null)
    }
  }

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError(null)
    setResult(null)
    try {
      const source = createIngestFromFiles(Array.from(files))
      const res = await runImport(source, (p) => setProgress(p))
      setResult(res)
      setProgress(null)

      const allEvents = await db.events.toArray()
      buildSearchIndex(allEvents)
    } catch (err) {
      setError((err as Error).message)
      setProgress(null)
    }
  }

  const handleClear = async () => {
    await clearDatabase()
    setResult(null)
    setError(null)
  }

  const handleCheckMeta = async () => {
    const meta = await getLatestImportMeta()
    if (meta) {
      setResult(meta)
    } else {
      setError('No previous import found in database')
    }
  }

  return (
    <div className="w-full max-w-2xl bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-text-secondary bg-surface-raised px-2 py-0.5 rounded">
            Dev Tools
          </span>
          <h2 className="text-lg font-bold mt-1 text-text-primary">Data Ingest & Diagnostics</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheckMeta}
            className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-surface-raised transition text-text-secondary hover:text-text-primary cursor-pointer"
          >
            Check Status
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition cursor-pointer"
          >
            Clear DB
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDirectoryPicker}
          disabled={!!progress}
          className="flex-1 bg-accent text-accent-fg font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2"
        >
          📂 Select Export Folder (FSA)
        </button>

        <label className="flex-1 border border-border bg-surface-raised hover:border-text-secondary transition px-4 py-2.5 rounded-lg text-sm text-center font-medium text-text-primary cursor-pointer flex items-center justify-center gap-2">
          📁 Choose Folder (Fallback)
          <input
            type="file"
            // @ts-expect-error webkitdirectory is standard for folder inputs
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </label>
      </div>

      {/* Progress state */}
      {progress && (
        <div className="bg-surface-raised p-4 rounded-lg space-y-2 border border-border">
          <div className="flex justify-between text-xs text-text-secondary font-medium">
            <span>{progress.phase}</span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Import summary */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-raised p-3 rounded-lg border border-border">
              <span className="text-xs text-text-secondary">Messages</span>
              <p className="text-xl font-bold text-text-primary">
                {result.messageCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-raised p-3 rounded-lg border border-border">
              <span className="text-xs text-text-secondary">Snaps</span>
              <p className="text-xl font-bold text-text-primary">
                {result.snapCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-raised p-3 rounded-lg border border-border">
              <span className="text-xs text-text-secondary">Calls</span>
              <p className="text-xl font-bold text-text-primary">
                {result.callCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-raised p-3 rounded-lg border border-border">
              <span className="text-xs text-text-secondary">Memories</span>
              <p className="text-xl font-bold text-text-primary">
                {result.memoryCount.toLocaleString()}
              </p>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg text-xs space-y-1 text-yellow-300">
              <strong>Warnings ({result.warnings.length}):</strong>
              <ul className="list-disc pl-4 max-h-32 overflow-y-auto space-y-0.5">
                {result.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {result.warnings.length > 5 && (
                  <li>...and {result.warnings.length - 5} more warnings</li>
                )}
              </ul>
            </div>
          )}

          {/* Test search input */}
          <div className="pt-2 border-t border-border space-y-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Test Search Index
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value
                startTransition(() => {
                  setSearchQuery(val)
                })
              }}
              placeholder="Search contact, message text, or memory location..."
              className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
            />

            {isSearching && <span className="text-xs text-text-secondary">Searching...</span>}

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded bg-surface border border-border text-xs flex justify-between items-center"
                  >
                    <div>
                      <span className="font-semibold text-text-primary mr-2">[{item.type}]</span>
                      <span className="text-text-primary">{item.title}: </span>
                      <span className="text-text-secondary">{item.snippet}</span>
                    </div>
                    <span className="text-[10px] text-text-secondary shrink-0 ml-2">
                      {item.timestamp?.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
