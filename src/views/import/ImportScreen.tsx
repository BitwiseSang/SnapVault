import { ChangeEvent, DragEvent, useEffect, useState, useRef } from 'react'
import { FolderUp, ShieldCheck, AlertCircle, Sparkles, FolderArchive } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  createIngestFromDataTransfer,
  createIngestFromDirectoryHandle,
  createIngestFromFiles,
} from '../../ingest/folder'
import { runImport, ImportProgress } from '../../db/import'
import { ProgressBar } from '../../components/ProgressBar'
import { Button } from '../../components/Button'
import { useApp } from '../../app/AppContext'

export function ImportScreen() {
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { refreshData } = useApp()

  useEffect(() => {
    document.title = 'Import Archive | SnapVault'
  }, [])

  const processIngest = async (sourcePromise: Promise<unknown> | unknown) => {
    setError(null)
    try {
      const source = await (sourcePromise as Promise<import('../../models/ingest').IngestSource>)
      await runImport(source, (p) => setProgress(p))
      await refreshData()
      navigate('/chats')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Failed to import folder')
      }
      setProgress(null)
    }
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      await processIngest(createIngestFromDataTransfer(e.dataTransfer.items))
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handlePickDirectory = async () => {
    if ('showDirectoryPicker' in window && typeof window.showDirectoryPicker === 'function') {
      try {
        const handle = await window.showDirectoryPicker()
        await processIngest(createIngestFromDirectoryHandle(handle))
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return
        }
        // Fallback to file input if Directory Picker fails due to security or context limitations
      }
    }
    // Universal fallback for Firefox, Safari, and browsers without Directory Picker API
    fileInputRef.current?.click()
  }

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processIngest(createIngestFromFiles(Array.from(files)))
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text-primary">
      <div className="max-w-xl w-full space-y-8">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-accent-fg font-black text-2xl shadow-sm tracking-tight">
            SV
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Welcome to SnapVault
          </h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Your private, offline browser for your exported Snapchat chats, snaps, calls, and
            memories.
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-border text-xs text-text-secondary font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>100% Local & Private. Data never leaves your machine.</span>
          </div>
        </div>

        {/* Drop zone container */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-5 ${
            isDragging
              ? 'border-accent bg-accent/5 scale-[1.01]'
              : 'border-border hover:border-text-secondary/50 bg-surface'
          }`}
        >
          {progress ? (
            <div className="w-full max-w-md space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto animate-pulse">
                <FolderArchive className="w-6 h-6 text-accent-fg" />
              </div>
              <div className="space-y-1 text-center">
                <h3 className="font-semibold text-text-primary text-base">
                  Importing Your Export...
                </h3>
                <p className="text-xs text-text-secondary">{progress.phase}</p>
              </div>
              <ProgressBar current={progress.current} total={progress.total} />
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center text-text-secondary shadow-sm">
                <FolderUp className="w-8 h-8 text-accent" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-text-primary tracking-tight">
                  Drop your Snapchat export folder here
                </h3>
                <p className="text-xs text-text-secondary max-w-xs mx-auto">
                  Drag the unzipped folder containing{' '}
                  <code className="text-text-primary">json/</code> and{' '}
                  <code className="text-text-primary">memories/</code> onto this zone.
                </p>
              </div>

              <div className="pt-2 w-full max-w-xs">
                <Button onClick={handlePickDirectory} className="w-full" variant="primary">
                  <FolderUp className="w-4 h-4" />
                  Select Folder
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  // @ts-expect-error webkitdirectory is standard for folder inputs
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 text-sm text-red-400 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Import failed</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Quick tip */}
        <div className="flex items-center justify-center gap-2 text-xs text-text-secondary text-center">
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>Need your data? Request it in Snapchat Settings → My Data → Submit Request.</span>
        </div>
      </div>
    </div>
  )
}
