# Snap Vault

A local-first, private web app for browsing your own exported Snapchat data — chats, snaps, calls, and memories — in one unified, searchable interface, instead of Snapchat's default export of dozens of isolated per-contact HTML pages.

> Working title. Rename freely in `package.json` once something better sticks.

## Why this exists

Snapchat's "Download My Data" export gives you two things:

1. A `json/` folder with the real, structured data (`chat_history.json`, `snap_history.json`, `talk_history.json`, `memories_history.json`, `feature_emails.json`).
2. An `html/` folder that renders a _subset_ of that same data into one static HTML page per contact, plus `snap_history.html` / `talk_history.html` — with no search, no cross-contact view, and no link to your actual memories.

Snap Vault skips the HTML entirely and reads the JSON + media directly, so you get one app with global search, sorting, and a browsing experience closer to Snapchat itself.

**Everything runs entirely in your browser.** No server, no upload, no network calls. Your export never leaves your machine.

## Features (v1)

- **Chat history viewer** — per-contact conversation view, plus a unified timeline across all contacts.
- **Memories gallery** — masonry/grid browsing of your saved photos & videos, with overlay (caption/sticker) compositing.
- **Snap & call history / stats** — counts, streak-style timelines, most-contacted, activity-over-time. Note: call stats are aggregate only — the export does not record who you called.
- **Global search** — full-text search across messages and contact names. Note: Snapchat only exports the text of _saved_ messages; most chat messages will have null content, so search coverage is limited by the export format.
- **Sort & filter** — by date range, contact, media type, event type.
- **Drag-and-drop ingest** — starting with the already-unzipped export folder; raw `.zip` support is a fast-follow (see [ARCHITECTURE.md](./ARCHITECTURE.md)).
- **Persistent local index** — parsed once, cached in IndexedDB, so reopening the app doesn't require re-dropping the folder.

## Tech stack

- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **Dexie** (IndexedDB wrapper) for the local persisted index
- **react-window** (or `@tanstack/react-virtual`) for virtualized lists/grids — the export can contain thousands of media files and a large chat corpus
- **MiniSearch** (or similar lightweight in-browser search lib) for full-text search over the parsed dataset

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data model, ingestion pipeline, and rationale.

## Getting started

### Prerequisites

- Node.js (v24.x recommended, see `.nvmrc`)
- pnpm (v10+ or v12+)
- Your own Snapchat data export, unzipped locally (Settings → My Data → Submit Request on snapchat.com)

### Setup

```bash
pnpm install
pnpm dev
```

Open the app in your browser, then drag your **unzipped Snapchat export folder** (the one containing `html/`, `json/`, `memories/`, `index.html`) onto the drop zone.

## Project structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown. At a glance:

```
src/
├── ingest/       # folder/zip drop handling, raw file reading
├── parsers/      # JSON → normalized Event model
├── db/           # Dexie schema, IndexedDB persistence
├── search/       # in-memory search index
├── models/       # shared TypeScript types
├── components/   # shared UI primitives
├── views/        # Chats, Memories, Stats, Search
└── app/          # routing, top-level layout
```

## Data privacy

This app never makes a network request with your data. There's no backend. If you fork or modify this, keep it that way — the entire value proposition is that your export stays on your machine.

## Known export limitations

These are limitations of what Snapchat includes in its data export, not limitations of this app:

- **Chat message text is mostly absent.** Snapchat only exports the text body of messages that were explicitly saved by a participant. The vast majority of messages will have `null` content — the message metadata (sender, timestamp, type) is present, but the text is not.
- **Call logs have no contact info.** `talk_history.json` records incoming/outgoing/completed calls with timestamps, duration, and type (audio/video), but no participant username. Per-contact call history is not possible from the export data.
- **Snap media is not included.** Ephemeral snaps are not part of the data export — only the metadata (who sent it, when, what type).
- **Memories have no filename link in the JSON.** The `Download Link` and `Media Download Url` fields in `memories_history.json` are empty. Matching JSON metadata to actual files in `memories/` requires a date-based heuristic — see [ARCHITECTURE.md](./ARCHITECTURE.md) for the open question and proposed strategies.

## Roadmap

- [x] Phase 1: folder-drop ingest, JSON parsing, unified data model, IndexedDB persistence
- [x] Phase 2: chat viewer + memories gallery + stats views
- [x] Phase 3: global search + filters
- [ ] Phase 4: raw `.zip` drop support (in-browser unzip)
- [x] Phase 5: polish pass — animation, empty states, keyboard navigation

## For coding agents

If you're an AI agent (Claude Code, Gemini CLI, etc.) working in this repo, read [AGENTS.md](./AGENTS.md) first.
