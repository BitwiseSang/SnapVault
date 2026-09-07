# Architecture

## Goals

- Turn a Snapchat data export into one unified, browsable, searchable app.
- 100% client-side. No server, no network calls with user data, ever.
- Handle real-world scale gracefully: an export can contain hundreds of chat threads and thousands of memory files.
- Ingest the **unzipped folder first** (Phase 1); support raw `.zip` later behind the same interface.

## Non-goals

- No cloud sync, no multi-device, no account system.
- No attempt to replicate Snapchat's disappearing-message semantics — this is a static archive viewer.
- No editing/writing back into the export.

## Source data (as observed in the export)

```
<export-root>/
├── chat_media/
│   ├── <YYYY-MM-DD>_b~<opaque-id>.(jpg|mp4|png|gif|webp|mov) # media sent in chats matching Media IDs
│   ├── <YYYY-MM-DD>_media~<name>.(mp4|...)                   # group chat / snap camera media
│   ├── <YYYY-MM-DD>_overlay~<name>.(png|webp)                # optional sticker/caption layer
│   └── <YYYY-MM-DD>_thumbnail~<name>.jpg                     # video preview thumbnails
├── html/
│   ├── chat_history/subpage_<username>.html   # per-contact chat, Snapchat's own viewer — NOT our source of truth
│   ├── snap_history.html
│   └── talk_history.html
├── index.html                                  # export's own landing page
├── json/
│   ├── chat_history.json
│   ├── snap_history.json
│   ├── talk_history.json
│   ├── memories_history.json
│   └── feature_emails.json
└── memories/
    ├── memories.html
    ├── <YYYY-MM-DD>_<uuid>-main.(jpg|mp4)      # the actual photo/video
    └── <YYYY-MM-DD>_<uuid>-overlay.png         # optional sticker/caption layer for the same memory
```

**We treat `json/*.json` as the source of truth.** The `html/` folder is Snapchat's own (limited) renderer of a subset of this same data and is not parsed by this app. Media files in `memories/` and `chat_media/` provide the binary assets joined back to the JSON records.

### Verified schemas

All schemas below are confirmed against real sample data. Field names and structure are no longer hypothetical.

---

#### `chat_history.json`

Top-level object keyed by **contact username**. Each value is an array of message entries, newest-first.

```jsonc
{
  "<contact_username>": [
    {
      "From": "maxwells.ang", // string — sender's username
      "Media Type": "TEXT", // see media types below
      "Created": "2026-09-05 15:20:49 UTC",
      "Content": null, // string | null — text body; null for most messages (see note)
      "Conversation Title": null, // string | null — non-null for group chats
      "IsSender": true, // bool — true if the export owner sent this message
      "Created(microseconds)": 1788621649238,
      "IsSaved": false, // bool — whether the message was saved by a participant
      "Media IDs": "", // string — opaque ID when a saved media is attached; empty otherwise
    },
  ],
}
```

Observed `Media Type` values: `TEXT`, `MEDIA`, `NOTE`, `STICKER`, `LOCATION`, `SHARE`, `SHARESAVEDSTORY`, `STATUS`

**Important:**

- `Content` is `null` for the vast majority of messages, including `TEXT`-type ones. Snapchat does not export the text of ephemeral messages. Only messages explicitly saved by a participant may carry a non-null (but possibly empty string) `Content`. Full-text search over chat will therefore only cover the saved-message subset.
- `Created(microseconds)` is **actually in milliseconds** since epoch (JavaScript timestamp format). Dividing by 1,000 yields Unix timestamp seconds that match `Created` date strings exactly.
- `Media IDs` contains one or more opaque IDs (delimited by `" | "` if multiple) referencing files located in `chat_media/`.

Scale observed in sample data: **346 contacts, ~21,500 messages, 502 messages with Media IDs**.

---

#### `chat_media/`

Directory containing media sent and saved in chat conversations.

- **913 files** observed in sample data (`.jpg`, `.mp4`, `.png`, `.gif`, `.webp`, `.heif`, `.mov`).
- Naming format: `<YYYY-MM-DD>_<id-or-name>.<ext>`.
- Two categories of files:
  1. **Direct Media ID matches (`b~...` and hex-32)**: 763 files. The `<id-or-name>` matches the entry in `Media IDs` in `chat_history.json` directly. Verified: 578 of 607 Media IDs in JSON have exact file matches (~95% match rate). Unmatched 5% are unexported ephemeral media.
  2. **Group chat / Snap Camera media (`media~...`, `overlay~...`, `thumbnail~...`)**: 157 files. These do not have corresponding `Media IDs` in `chat_history.json` and are handled via date-based heuristics (e.g. "Shared media from this day" tray).

---

#### `snap_history.json`

Same keyed-by-contact structure as `chat_history.json`, but with a reduced field set — no `Content`, `IsSaved`, or `Media IDs`.

```jsonc
{
  "<contact_username>": [
    {
      "From": "allankipsan2024",
      "Media Type": "IMAGE", // IMAGE | VIDEO only
      "Created": "2026-09-05 15:22:15 UTC",
      "Conversation Title": null,
      "IsSender": false,
      "Created(microseconds)": 1788621735710,
    },
  ],
}
```

Snap media content is **not** included in the export — only metadata. This is confirmed.

---

#### `talk_history.json`

**Not keyed by contact.** Top-level object with four fixed keys. No per-contact info is present anywhere in this file.

```jsonc
{
  "Outgoing Calls": [], // may be empty
  "Incoming Calls": [
    {
      "Date & Time": "2026-08-21 14:05:41 UTC",
      "Type": "VIDEO", // VIDEO | AUDIO
      "People in Chat": 2,
      "Result": "Call Received", // "Call Received" | "Call Failed" | "Call Succeeded"
      "City": "eldoret",
      "Country": "KE",
      "Length (sec)": 58,
      "Network": "WIFI", // "WIFI" | "UNREACHABLE"
    },
  ],
  "Completed Calls": [
    {
      // Same shape as Incoming/Outgoing but no "Result" field
      "Date & Time": "2026-08-19 06:29:10 UTC",
      "Type": "VIDEO",
      "People in Chat": 2,
      "City": "eldoret",
      "Country": "KE",
      "Length (sec)": 7,
      "Network": "WIFI",
    },
  ],
  "Chat Sessions": [], // empty in observed data
  "Game Sessions": [], // empty in observed data
}
```

**Design implication:** Because call entries have no contact/participant field, `CallEvent` in the unified model cannot carry a `contact`. Stats views must be aggregate (total calls, duration, type breakdown) rather than per-contact.

---

#### `memories_history.json`

Top-level object with a single key `"Saved Media"`, containing an array of entries.

```jsonc
{
  "Saved Media": [
    {
      "Date": "2026-09-02 15:27:36 UTC",
      "Media Type": "Video", // "Video" | "Image" (title-cased, unlike other files)
      "Location": "Latitude, Longitude: 0.5560059, 35.24502",
      "Download Link": "", // ALWAYS empty string in this export
      "Media Download Url": "", // ALWAYS empty string in this export
    },
  ],
}
```

**Memories join strategy (verified against real data):** Both `Download Link` and `Media Download Url` are empty strings for every entry in the observed export, and filenames contain random UUIDs (`YYYY-MM-DD_<uuid>-main.ext`). However, file modification times (`File.lastModified` / filesystem `mtime`) preserved during archive extraction match the seconds in the JSON timestamps minute-for-minute and second-for-second across the entire dataset. Sorting files chronologically by `lastModified` yields a **100.0% accurate alignment** with the chronological ordering in `memories_history.json`.

The implemented join strategy is:

1. **Files-drive**: Enumerate files in `memories/` as the primary source of truth.
2. **Date + Chronological ordering (`lastModified`)**: For each date prefix (`YYYY-MM-DD`), sort main files chronologically by `lastModified` (falling back to filename order if missing or identical) and sort JSON candidates chronologically.
3. **Media type matching**: Pair each file with the earliest available candidate matching its media type (`Video` $\leftrightarrow$ `.mp4`, `Image` $\leftrightarrow$ `.jpg`), or the earliest unused candidate if types differ.
4. **Overlay linking**: Sibling `-overlay.png` files are joined by base prefix (`YYYY-MM-DD_<uuid>`).

Scale: **1,421 JSON entries**, **~1,505 media files** (1,416 main media files + overlays + `memories.html`).

---

#### `feature_emails.json`

```json
{ "Email Used to Join": [] }
```

Empty in this export. Out of scope for v1.

---

## Pipeline

```
Drop (folder or zip)
   → File enumeration (webkitGetAsEntry / File System Access API, or zip listing)
   → JSON parsing → normalize into unified Event[] model
   → Media linking (join memories/ files to JSON entries — see join strategy note above)
   → Persist normalized data + a manifest of media file handles/paths into IndexedDB (Dexie)
   → Build in-memory search index (MiniSearch) over text fields
   → UI reads from the Dexie-backed store + search index, never re-parses raw JSON after first load
```

### Ingest abstraction

Define a single `IngestSource` interface with two implementations so the rest of the pipeline never needs to know whether the data came from a folder or a zip:

```ts
interface IngestSource {
  listFiles(): Promise<IngestedFile[]>
  readFile(path: string): Promise<Blob>
}
```

- `FolderIngestSource` — Phase 1, built on drag-and-drop directory entries (`webkitGetAsEntry`) or the File System Access API.
- `ZipIngestSource` — Phase 4, built on an in-browser zip library, implementing the same interface.

Everything downstream of ingest (parsing, normalization, storage) is written once against `IngestSource` and needs no changes when zip support is added.

### Unified data model

Field names below reflect the **verified** raw JSON shapes. Parsers must map these to the normalized model.

```ts
type EventType = 'message' | 'snap' | 'call' | 'memory'

interface BaseEvent {
  id: string
  type: EventType
  timestamp: string // ISO 8601, converted from "YYYY-MM-DD HH:MM:SS UTC"
  contact?: string // username — present for message/snap; absent for call/memory
}

interface MessageEvent extends BaseEvent {
  type: 'message'
  direction: 'sent' | 'received' // derived from IsSender
  mediaType: string // raw "Media Type" value: TEXT | MEDIA | NOTE | STICKER | etc.
  content: string | null // raw "Content" — null for most messages
  isSaved: boolean
  mediaIds: string // raw "Media IDs" — empty string when absent
  chatMediaFiles?: string[] // paths to chat_media/* files matched via mediaIds
  conversationTitle: string | null
}

interface SnapEvent extends BaseEvent {
  type: 'snap'
  direction: 'sent' | 'received'
  mediaType: 'IMAGE' | 'VIDEO'
  conversationTitle: string | null
}

interface CallEvent extends BaseEvent {
  type: 'call'
  // NOTE: no contact field — talk_history.json contains no participant info
  callType: 'VIDEO' | 'AUDIO'
  callCategory: 'Incoming Calls' | 'Outgoing Calls' | 'Completed Calls'
  result?: string // "Call Received" | "Call Failed" | "Call Succeeded" — absent on Completed Calls
  lengthSec: number
  network: string
  city: string
  country: string
}

interface MemoryEvent extends BaseEvent {
  type: 'memory'
  // NOTE: contact is always absent — memories are not associated with a contact
  mediaFile: string // path/handle to the -main file (jpg or mp4)
  overlayFile?: string // path/handle to the -overlay file, if present
  mediaKind: 'Image' | 'Video' // title-cased to match raw JSON value
  location: string // raw "Location" string, e.g. "Latitude, Longitude: 0.0, 0.0"
}

type AppEvent = MessageEvent | SnapEvent | CallEvent | MemoryEvent
```

### Storage layer

Dexie (IndexedDB) holds:

- The normalized `AppEvent` table (`events`), indexed by `timestamp`, `type`, and `contact`.
- A metadata table (`meta`) storing import info (`last_import`).
- A media table (`mediaFiles`) storing media Blobs and mime types (`path`, `blob`, `mimeType`) for `memories/` and `chat_media/`.

Rationale: re-parsing ~21,000+ messages, ~1,400 memory entries, and ~900 chat media files on every page load would be slow. Parse once, persist, and only re-parse on explicit re-import.

### Search

Given the dataset is personal-scale (thousands, not millions, of events), a full dataset fits comfortably in memory. Build a MiniSearch (or equivalent) index over message `content` (where non-null) and contact names at load time from the Dexie-backed data — no need for anything heavier.

Note: because `content` is null for the vast majority of messages, search hit rate over chat will be low. This is a known limitation of the export format, not a bug.

### Performance

- Virtualize the chat message list, the contact list, and the memories grid (`react-window` / `@tanstack/react-virtual`) — do not render 1,400+ media thumbnails at once.
- Lazy-load thumbnails (e.g. `IntersectionObserver`-gated `<img>` loading).
- Show explicit ingest progress (X of Y files parsed) — first import on a large export may take a few seconds and the user should see that it's working, not that it's frozen.

## UI composition (sketch)

```
App
├── ImportScreen        # drop zone, shown when no data is indexed yet
└── MainLayout
    ├── Sidebar          # Chats | Memories | Stats, + global search entry point
    ├── ChatsView
    │   ├── ContactList
    │   └── ConversationPane
    ├── MemoriesView
    │   └── MediaGrid (virtualized)
    ├── StatsView        # aggregate call/snap/message counts — no per-contact call breakdown
    └── SearchOverlay    # global, keyboard-triggerable
```

## Design decisions & resolutions

1. **Memories join strategy** — RESOLVED. Files-driven chronological pairing using file `lastModified` timestamps against sorted JSON candidates.
2. **`-overlay.png` files** — RESOLVED. Linked via matching base prefix (`YYYY-MM-DD_<uuid>`); missing overlays degrade gracefully.
3. **Group chat support** — RESOLVED. Folded into the unified contact list, keyed by `Conversation Title` when present.
4. **`talk_history.json` empty categories** — RESOLVED. Handled gracefully by parser without crashing.
5. **Chat media join strategy** — RESOLVED. Direct exact matching of `chat_history.json` `Media IDs` (`b~...` and hex-32) to `chat_media/<YYYY-MM-DD>_<id>.<ext>`. Unlinked group chat Snaps (`media~...` / `overlay~...`) handled via date-based heuristics.
