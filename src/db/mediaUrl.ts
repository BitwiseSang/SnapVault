import { useEffect, useState } from 'react'
import { getMediaBlob } from './db'

const urlCache = new Map<string, string>()

export async function getCachedMediaUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path)
  if (cached) return cached

  const blob = await getMediaBlob(path)
  if (!blob) return null

  const url = URL.createObjectURL(blob)
  urlCache.set(path, url)
  return url
}

export function useMediaUrl(path?: string): { url: string | null; isLoading: boolean } {
  const [url, setUrl] = useState<string | null>(() => (path ? (urlCache.get(path) ?? null) : null))
  const [isLoading, setIsLoading] = useState<boolean>(() => (path ? !urlCache.has(path) : false))

  useEffect(() => {
    if (!path) {
      return
    }

    if (urlCache.has(path)) {
      return
    }

    let isMounted = true

    getCachedMediaUrl(path)
      .then((createdUrl) => {
        if (isMounted) {
          setUrl(createdUrl)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error(`Failed to load media blob for ${path}:`, err)
        if (isMounted) {
          setUrl(null)
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [path])

  const effectiveUrl = path ? (urlCache.get(path) ?? url) : null
  const effectiveLoading = path ? !effectiveUrl && isLoading : false

  return { url: effectiveUrl, isLoading: effectiveLoading }
}
