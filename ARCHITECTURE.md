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

**We treat `json/*.json` as the source of truth.** The `html/` folder is Snapchat's own (limited) renderer of a subset of this same data and is not parsed by this app.

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

**Important:** `Content` is `null` for the vast majority of messages, including `TEXT`-type ones. Snapchat does not export the text of ephemeral messages. Only messages explicitly saved by a participant may carry a non-null (but possibly empty string) `Content`. Full-text search over chat will therefore only cover the saved-message subset.

Scale observed in sample data: **346 contacts, ~21,800 messages**.

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

**Critical open question — memories join key:** Both `Download Link` and `Media Download Url` are empty strings for every entry in the observed export. The JSON contains **no UUID, no filename reference, and no resolvable link** to the corresponding file in `memories/`. The only matchable field is `Date` (to the `YYYY-MM-DD` prefix of each filename).

Date-count comparison between JSON entries and `memories/` files is close but not exact (439 unique dates in JSON vs. 436 in files), and on many dates the counts match 1-for-1. The viable join strategies are:

1. **Date + position ordering** — sort both JSON entries and files for a given date and pair them by index. Fragile if counts don't match.
2. **Date + media type** — narrow further by matching `"Video"` entries to `.mp4` files and `"Image"` entries to `.jpg` files for the same date. Still fragile for days with multiple same-type files.
3. **Files-drive, JSON is metadata-only** — enumerate `memories/` files as the primary source of truth, use JSON only to attach the `Location` field and nothing else. Safest for display; loses ordering guarantees.

**Do not implement a memories parser without first deciding which strategy to use and documenting it.** Flag this to the user if you hit it during implementation.

Scale: **1,421 JSON entries**, **~1,505 media files** (including `memories.html`).

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

- The normalized `AppEvent` table, indexed by `timestamp`, `type`, and `contact`.
- A small metadata table (export folder name, parse date, counts) so the UI can show "last imported" info and let the user re-import without guessing state.

Rationale: re-parsing ~21,000+ messages and ~1,400 memory entries on every page load would be slow. Parse once, persist, and only re-parse on explicit re-import.

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

## Open questions (post-schema-verification)

1. **Memories join strategy** — see the detailed options under `memories_history.json` above. Must be decided before the memories parser is written.
2. **`-overlay.png` files without a JSON entry (or vice versa)** — the linking logic must tolerate mismatches and degrade gracefully (skip/flag rather than crash).
3. **Group chat support** — `Conversation Title` is non-null for group chats. Determine whether `ChatsView` needs a separate group-chat list or folds them into the same contact list.
4. **`talk_history.json` empty categories** — `Outgoing Calls`, `Chat Sessions`, and `Game Sessions` are all empty in the observed export. Parsers should handle these gracefully even if they remain empty.
