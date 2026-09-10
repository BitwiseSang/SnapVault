#!/usr/bin/env node

/**
 * SnapVault — Export Cleanup Utility
 *
 * Safely creates an optimized copy of a Snapchat export folder by:
 * - Pruning unused group-chat media files (media~, overlay~, thumbnail~).
 * - Pruning orphaned/unreferenced chat media files that have no matching message in chat_history.json.
 * - Excluding Snapchat's legacy offline HTML viewer (saving ~30 MB).
 * - Preserving 100% of memories, chat history, and core JSON metadata.
 * - Never modifying the source folder.
 *
 * Usage:
 *   node scripts/cleanup-export.mjs [options] <inputDir> <outputDir>
 *
 * Options:
 *   --dry-run           Scan and calculate savings without writing any files
 *   --link              Use hardlinks instead of copying (instant transfer, 0 duplicate disk space)
 *   --keep-html         Keep Snapchat's static html/ directory and index.html (default: excluded)
 *   --keep-orphans      Keep unreferenced media files in chat_media (only removes media~/overlay~/thumbnail~)
 *   --force, -f         Overwrite destination directory if it already exists
 *   --help, -h          Show this help message
 */

import fs from 'fs'
import path from 'path'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function printHelp() {
  console.log(`
SnapVault — Export Cleanup Utility

Usage:
  node scripts/cleanup-export.mjs [options] <input-folder> <output-folder>

Options:
  --dry-run           Preview file counts and space savings without copying anything
  --link              Use hardlinks instead of copying (instant, 0 extra disk space on same drive)
  --keep-html         Include Snapchat's legacy html/ viewer and index.html (excluded by default)
  --keep-orphans      Keep unreferenced chat media (only strips media~, overlay~, and thumbnail~)
  --force, -f         Overwrite destination directory if it already exists
  --help, -h          Show this help message

Example:
  node scripts/cleanup-export.mjs --dry-run ./sample_data ./sample_data_cleaned
  node scripts/cleanup-export.mjs --link ./sample_data ./sample_data_cleaned
`)
}

async function main() {
  const args = process.argv.slice(2)

  let dryRun = false
  let useHardlinks = false
  let keepHtml = false
  let keepOrphans = false
  let force = false
  const positionalArgs = []

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--link') {
      useHardlinks = true
    } else if (arg === '--keep-html') {
      keepHtml = true
    } else if (arg === '--keep-orphans') {
      keepOrphans = true
    } else if (arg === '--force' || arg === '-f') {
      force = true
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      printHelp()
      process.exit(1)
    } else {
      positionalArgs.push(arg)
    }
  }

  if (positionalArgs.length < 2) {
    console.error('Error: Please specify both <input-folder> and <output-folder>.')
    printHelp()
    process.exit(1)
  }

  const inputDir = path.resolve(positionalArgs[0])
  const outputDir = path.resolve(positionalArgs[1])

  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Source directory does not exist: ${inputDir}`)
    process.exit(1)
  }

  if (inputDir === outputDir) {
    console.error('Error: Source and destination directories must be different.')
    process.exit(1)
  }

  // Validate that source looks like a Snapchat export
  const hasJson = fs.existsSync(path.join(inputDir, 'json'))
  const hasChatMedia = fs.existsSync(path.join(inputDir, 'chat_media'))
  const hasMemories = fs.existsSync(path.join(inputDir, 'memories'))

  if (!hasJson && !hasChatMedia && !hasMemories) {
    console.error(`Error: ${inputDir} does not look like a Snapchat export folder.`)
    console.error('Expected to find at least one of: json/, chat_media/, memories/')
    process.exit(1)
  }

  if (!dryRun) {
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir)
      if (files.length > 0 && !force) {
        console.error(`Error: Destination directory "${outputDir}" is not empty.`)
        console.error('Use --force to overwrite existing files, or specify an empty/new directory.')
        process.exit(1)
      }
    }
  }

  console.log('\n======================================================')
  console.log('         SnapVault — Export Cleanup Utility           ')
  console.log('======================================================')
  console.log(`Source:      ${inputDir}`)
  console.log(`Destination: ${outputDir}`)
  console.log(
    `Mode:        ${dryRun ? 'DRY RUN (preview only)' : useHardlinks ? 'HARDLINK (instant)' : 'COPY'}`,
  )
  console.log(`HTML Viewer: ${keepHtml ? 'Preserve' : 'Exclude (saves ~30 MB)'}`)
  console.log(`Orphans:     ${keepOrphans ? 'Preserve' : 'Exclude unreferenced chat media'}`)
  console.log('------------------------------------------------------\n')

  // 1. Index referenced Media IDs from json/chat_history.json
  const referencedMediaIds = new Set()
  const chatHistoryPath = path.join(inputDir, 'json', 'chat_history.json')

  if (fs.existsSync(chatHistoryPath)) {
    try {
      const chatJson = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8'))
      for (const messages of Object.values(chatJson)) {
        if (Array.isArray(messages)) {
          for (const msg of messages) {
            const mediaIds = msg?.['Media IDs']
            if (typeof mediaIds === 'string' && mediaIds.trim()) {
              const ids = mediaIds
                .split(' | ')
                .map((s) => s.trim())
                .filter(Boolean)
              for (const id of ids) {
                referencedMediaIds.add(id)
              }
            }
          }
        }
      }
      console.log(
        `✓ Indexed ${referencedMediaIds.size} referenced Media IDs from chat_history.json`,
      )
    } catch (err) {
      console.warn(`! Warning: Could not parse chat_history.json: ${err.message}`)
    }
  } else {
    console.warn('! Notice: json/chat_history.json not found in source folder.')
  }

  // 2. Classify all files in source export
  const filesToCopy = []
  const filesSkipped = []

  let totalSourceBytes = 0
  let totalCleanedBytes = 0

  function scanDirectory(dir, relPath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relative = path.join(relPath, entry.name)

      if (entry.isDirectory()) {
        scanDirectory(fullPath, relative)
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath)
        totalSourceBytes += stat.size

        if (
          !keepHtml &&
          ((entry.name === 'index.html' && relPath === '') ||
            relative.startsWith('html/') ||
            relative.startsWith('html\\'))
        ) {
          filesSkipped.push({ path: relative, size: stat.size, reason: 'Static HTML viewer' })
          continue
        }

        if (relative.startsWith('chat_media/')) {
          const filename = entry.name

          // Check for group chat attachment patterns
          const isGroupChatAttachment =
            filename.includes('media~') ||
            filename.includes('overlay~') ||
            filename.includes('thumbnail~')

          if (isGroupChatAttachment) {
            filesSkipped.push({
              path: relative,
              size: stat.size,
              reason: 'Unlinked group chat media (media~/overlay~/thumbnail~)',
            })
            continue
          }

          // Check if file has a date prefix + media ID
          const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/)
          if (match) {
            const rest = match[2]
            const cleanId = rest.replace(/\.(jpe?g|mp4|png|gif|webp|heif|mov)$/i, '')
            const isReferenced = referencedMediaIds.has(cleanId)

            if (!isReferenced && !keepOrphans) {
              filesSkipped.push({
                path: relative,
                size: stat.size,
                reason: 'Orphaned chat media (not in chat_history.json)',
              })
              continue
            }
          } else if (!keepOrphans) {
            filesSkipped.push({
              path: relative,
              size: stat.size,
              reason: 'Unreferenced chat media format',
            })
            continue
          }
        }

        // File is kept!
        filesToCopy.push({ source: fullPath, relative, size: stat.size })
        totalCleanedBytes += stat.size
      }
    }
  }

  console.log('Scanning source directory...')
  scanDirectory(inputDir)

  // Group statistics
  const stats = {
    jsonCount: 0,
    jsonBytes: 0,
    memoriesCount: 0,
    memoriesBytes: 0,
    chatMediaKeptCount: 0,
    chatMediaKeptBytes: 0,
    groupChatPrunedCount: 0,
    groupChatPrunedBytes: 0,
    orphanedPrunedCount: 0,
    orphanedPrunedBytes: 0,
    htmlPrunedCount: 0,
    htmlPrunedBytes: 0,
    otherKeptCount: 0,
    otherKeptBytes: 0,
  }

  for (const item of filesToCopy) {
    if (item.relative.startsWith('json/')) {
      stats.jsonCount++
      stats.jsonBytes += item.size
    } else if (item.relative.startsWith('memories/')) {
      stats.memoriesCount++
      stats.memoriesBytes += item.size
    } else if (item.relative.startsWith('chat_media/')) {
      stats.chatMediaKeptCount++
      stats.chatMediaKeptBytes += item.size
    } else {
      stats.otherKeptCount++
      stats.otherKeptBytes += item.size
    }
  }

  for (const item of filesSkipped) {
    if (item.reason.includes('group chat')) {
      stats.groupChatPrunedCount++
      stats.groupChatPrunedBytes += item.size
    } else if (item.reason.includes('Orphaned') || item.reason.includes('Unreferenced')) {
      stats.orphanedPrunedCount++
      stats.orphanedPrunedBytes += item.size
    } else if (item.reason.includes('HTML')) {
      stats.htmlPrunedCount++
      stats.htmlPrunedBytes += item.size
    }
  }

  const totalPrunedBytes = totalSourceBytes - totalCleanedBytes
  const percentSaved =
    totalSourceBytes > 0 ? ((totalPrunedBytes / totalSourceBytes) * 100).toFixed(1) : '0'

  console.log('\n=================== Summary Breakdown ===================')
  console.log(
    `📁 JSON Data:         ${stats.jsonCount} files (${formatBytes(stats.jsonBytes)}) — 100% kept`,
  )
  console.log(
    `📸 Memories:          ${stats.memoriesCount} files (${formatBytes(stats.memoriesBytes)}) — 100% kept`,
  )
  console.log(
    `💬 Chat Media Kept:   ${stats.chatMediaKeptCount} files (${formatBytes(stats.chatMediaKeptBytes)}) — linked to messages`,
  )
  console.log('---------------------------------------------------------')
  console.log(
    `🗑️  Group Media Pruned: ${stats.groupChatPrunedCount} files (${formatBytes(stats.groupChatPrunedBytes)})`,
  )
  console.log(
    `🗑️  Orphaned Pruned:   ${stats.orphanedPrunedCount} files (${formatBytes(stats.orphanedPrunedBytes)})`,
  )
  if (!keepHtml) {
    console.log(
      `🗑️  Static HTML Pruned: ${stats.htmlPrunedCount} files (${formatBytes(stats.htmlPrunedBytes)})`,
    )
  }
  console.log('=========================================================')
  console.log(
    `Original Export Size: ${formatBytes(totalSourceBytes)} (${filesToCopy.length + filesSkipped.length} files)`,
  )
  console.log(
    `Cleaned Export Size:  ${formatBytes(totalCleanedBytes)} (${filesToCopy.length} files)`,
  )
  console.log(`Space Saved:          ${formatBytes(totalPrunedBytes)} (${percentSaved}% reduction)`)
  console.log('=========================================================\n')

  if (dryRun) {
    console.log('ℹ️ Dry run completed. No files were written.')
    console.log('Run without --dry-run to create the cleaned export folder.')
    return
  }

  // 3. Write files to outputDir
  console.log(`Writing cleaned export to "${outputDir}"...`)
  fs.mkdirSync(outputDir, { recursive: true })

  let copiedCount = 0
  for (const file of filesToCopy) {
    const destPath = path.join(outputDir, file.relative)
    const destDir = path.dirname(destPath)
    fs.mkdirSync(destDir, { recursive: true })

    if (useHardlinks) {
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
        fs.linkSync(file.source, destPath)
      } catch {
        // Fallback to copy if hardlink fails (e.g. across mount points)
        fs.copyFileSync(file.source, destPath)
      }
    } else {
      fs.copyFileSync(file.source, destPath)
    }

    copiedCount++
    if (copiedCount % 200 === 0 || copiedCount === filesToCopy.length) {
      process.stdout.write(`\rProgress: ${copiedCount}/${filesToCopy.length} files processed...`)
    }
  }

  console.log('\n\n✅ Done! Cleaned export is ready.')
  console.log(`Clean folder: ${outputDir}`)
  console.log('The source directory was not modified.')
}

main().catch((err) => {
  console.error('Fatal error during cleanup:', err)
  process.exit(1)
})
