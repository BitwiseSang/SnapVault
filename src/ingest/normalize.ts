/**
 * Normalizes relative paths within a Snapchat data export.
 * If a dropped directory adds a top-level wrapper folder (e.g. "my_export/json/chat_history.json"),
 * strips the wrapper so paths reliably begin with "json/", "memories/", "html/", or "index.html".
 */
export function normalizeExportPath(rawPath: string): string {
  // Replace backslashes with forward slashes and trim leading slashes
  let path = rawPath.replace(/\\/g, '/').replace(/^\/+/, '')

  const knownRoots = ['json/', 'memories/', 'chat_media/', 'html/', 'index.html']
  for (const root of knownRoots) {
    const idx = path.indexOf(root)
    if (idx !== -1) {
      return path.slice(idx)
    }
  }

  return path
}
