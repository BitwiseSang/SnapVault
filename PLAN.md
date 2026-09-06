# SnapVault v1 — Project Plan

> From empty repo to a fully featured, beautiful Snapchat export browser.  
> Package manager: **pnpm** throughout. Replace every `npm` reference in docs/scripts accordingly.

---

## Overview

```
Phase 0 → Scaffold & tooling
Phase 1 → Data foundation (ingest + parsers + DB)
Phase 2 → Core UI shell + design system
Phase 3 → Chat viewer
Phase 4 → Memories gallery
Phase 5 → Stats view
Phase 6 → Global search & filters
Phase 7 → Polish, empty states & accessibility
Phase 8 → Memories Snap Map
```

Each phase builds on the last and is independently committable. Phases 3–6 can be parallelized once Phase 2 is done if multiple agents are working concurrently.

---

## Phase 0 — Scaffold & tooling

**Goal:** A running dev server with linting, formatting, and type-checking wired up. Zero feature code.

### Tasks

- [x] **0.1** Scaffold with Vite

  ```bash
  pnpm create vite@latest . -- --template react-ts
  ```

  Immediately replace the boilerplate content in `src/` with the directory structure from `ARCHITECTURE.md`. Delete placeholder files (`App.css`, `assets/react.svg`, etc.).

- [x] **0.2** Install core dependencies

  ```bash
  pnpm add dexie minisearch @tanstack/react-virtual react-router-dom
  pnpm add -D tailwindcss @tailwindcss/vite autoprefixer typescript eslint prettier eslint-plugin-react-hooks @typescript-eslint/eslint-plugin @typescript-eslint/parser
  ```

- [x] **0.3** Configure Tailwind CSS v4
      Use the Vite plugin approach (`@tailwindcss/vite`). Set up a custom design token palette in CSS variables (see Design System section below). Configure `darkMode: 'class'`.

- [x] **0.4** Configure TypeScript strict mode

  ```json
  // tsconfig.json
  { "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true } }
  ```

- [x] **0.5** ESLint + Prettier
      Single flat config (`eslint.config.js`). Enforce no `any`, import ordering, React hooks rules. Prettier for formatting (tabs vs spaces: spaces, 2-width).

- [x] **0.6** Update `README.md` setup instructions
      Replace `npm install` / `npm run dev` with `pnpm install` / `pnpm dev`.

- [x] **0.7** Create `pnpm-workspace.yaml` (single-package, but sets precedent for future monorepo if needed).

- [x] **0.8** Pin Node version in `.nvmrc` / `.node-version`.

- [x] **0.9** Commit: `chore: scaffold Vite + React + TS + Tailwind + tooling`

---

## Phase 1 — Data foundation

**Goal:** The full ingest → parse → store pipeline works end-to-end, verified against `sample_data/`. No UI yet beyond a dev-only debug panel.

### 1.1 — Shared models (`src/models/`)

- [x] Define `AppEvent`, `MessageEvent`, `SnapEvent`, `CallEvent`, `MemoryEvent` from `ARCHITECTURE.md` in `src/models/events.ts`.
- [x] Define `IngestSource` interface and `IngestedFile` type in `src/models/ingest.ts`.
- [x] No `any`. Use `unknown` for raw JSON shapes — parsers will narrow them.

### 1.2 — Ingest layer (`src/ingest/`)

- [x] **`FolderIngestSource`** — implements `IngestSource` using the **File System Access API** (`showDirectoryPicker`) as the primary strategy, with a **drag-and-drop `webkitGetAsEntry` fallback** for browsers that don't support FSA.
  - `listFiles()` returns a flat array of `{ path: string, file: File }` for all files under the dropped directory.
  - `readFile(path)` returns the `Blob` for a given path.
  - Must recursively enumerate `json/`, `memories/` subdirectories.
- [x] Write unit tests for `FolderIngestSource` using a mock file tree.

### 1.3 — Parsers (`src/parsers/`)

One file per source JSON. Each parser takes raw `unknown` JSON and returns normalized `AppEvent[]`. All parsers must:

- Type-narrow with runtime checks (not `as` casts) — throw a descriptive error if the shape is wrong.
- Degrade gracefully on individual malformed entries (skip + log, don't throw).
- Timestamp conversion: `"YYYY-MM-DD HH:MM:SS UTC"` → ISO 8601 string.

- [x] **`src/parsers/chat.ts`** — `parseChat(raw: unknown): MessageEvent[]`
  - Iterates contact keys, iterates messages per contact.
  - Derives `direction` from `IsSender`.
  - Generates a stable `id` from `Created(microseconds)` + contact + `From`.

- [x] **`src/parsers/snap.ts`** — `parseSnaps(raw: unknown): SnapEvent[]`
  - Same keyed-by-contact structure. Reduced field set — no `Content`, `IsSaved`, `Media IDs`.

- [x] **`src/parsers/call.ts`** — `parseCalls(raw: unknown): CallEvent[]`
  - Iterates all four categories (`Outgoing Calls`, `Incoming Calls`, `Completed Calls`, `Chat Sessions`).
  - Handles empty arrays gracefully.
  - No `contact` field on the resulting event.

- [x] **`src/parsers/memory.ts`** — `parseMemories(raw: unknown, memoryFiles: IngestedFile[]): MemoryEvent[]`
  - **Join strategy (decided): files-drive, JSON is metadata-only.** Enumerate `memories/` files as the primary source of truth. For each `-main.*` file, attempt to find a matching JSON entry by `YYYY-MM-DD` date prefix + media type (`"Video"` ↔ `.mp4`, `"Image"` ↔ `.jpg`) + within-day ordinal index. If a file has no matching JSON entry, include it in results with no `location` metadata. If a JSON entry has no matching file, skip it and log a warning. Never fail the import due to mismatches.
  - Pairs each `-main.*` file with its `-overlay.png` sibling (same UUID prefix) when present.
  - Returns `MemoryEvent[]` with `mediaFile`, optional `overlayFile`, `mediaKind`, `location`.

- [x] **Parser unit tests** for all four parsers — happy path, missing fields, null content, mismatched memory counts.

### 1.4 — Database layer (`src/db/`)

- [x] **`src/db/schema.ts`** — Dexie schema v1:
  ```ts
  // events table: ++id, type, timestamp, contact
  // meta table: key, value (for import metadata)
  ```
- [x] **`src/db/db.ts`** — singleton Dexie instance. Export typed hooks: `useEvents()`, `useMeta()`.
- [x] **`src/db/import.ts`** — `runImport(source: IngestSource): Promise<ImportResult>`
  - Reads all four JSON files via `source.readFile(...)`.
  - Runs all four parsers.
  - Bulk-inserts into Dexie in a single transaction per table.
  - Writes metadata (import date, counts per type).
  - Returns `{ messageCount, snapCount, callCount, memoryCount, warnings: string[] }`.

### 1.5 — Search index (`src/search/`)

- [x] **`src/search/index.ts`** — builds a MiniSearch index at startup from all `MessageEvent` records where `content !== null`, plus all contact names.
  - Fields: `contact`, `content` (weighted higher), `mediaType`.
  - Store reference: index lives in module-level memory (not IndexedDB), rebuilt on each app load from Dexie data.
- [x] Export a `useSearch(query: string)` hook that returns debounced results.

### 1.6 — Dev-only import debug panel

- [x] A minimal `<ImportDebug />` component (visible only in `import.meta.env.DEV`) that:
  - Shows a folder picker button.
  - Runs `runImport()`.
  - Displays counts and any warnings.
  - Useful for verifying the pipeline before any real UI is built.

- [x] Commit: `feat(data): ingest pipeline, parsers, Dexie schema, search index`

---

## Phase 2 — UI shell & design system

**Goal:** App routing, layout, navigation, and a component library that all subsequent views will use. First thing that looks like a real product.

### 2.1 — Design system

SnapVault should feel like a **modern, premium personal-data app** — clean, dark-by-default, with Snapchat's energy but none of its visual clutter. Reference: Linear, Raycast, Apple Photos (dark mode).

**Color palette (CSS custom properties):**

| Token                    | Light     | Dark      | Purpose                                          |
| ------------------------ | --------- | --------- | ------------------------------------------------ |
| `--color-bg`             | `#f9f9f9` | `#0f0f0f` | Page background                                  |
| `--color-surface`        | `#ffffff` | `#1a1a1a` | Cards, panels                                    |
| `--color-surface-raised` | `#f0f0f0` | `#252525` | Hover states, sidebar items                      |
| `--color-border`         | `#e4e4e7` | `#2e2e2e` | Dividers                                         |
| `--color-text-primary`   | `#09090b` | `#fafafa` | Body text                                        |
| `--color-text-secondary` | `#71717a` | `#a1a1aa` | Timestamps, metadata                             |
| `--color-accent`         | `#FFFC00` | `#FFFC00` | Snapchat yellow — used sparingly as a key accent |
| `--color-accent-fg`      | `#09090b` | `#09090b` | Text on accent backgrounds                       |
| `--color-sent`           | `#FFFC00` | `#FFFC00` | Sent message bubble                              |
| `--color-received`       | `#e4e4e7` | `#2e2e2e` | Received message bubble                          |

**Typography:**

- Font: **Inter** (variable, via `@fontsource/inter`) as the system font stack fallback.
- Scale: `text-xs` (11px) → `text-sm` (13px) → `text-base` (15px) → `text-lg` (17px) → `text-2xl/3xl` for headings.
- Letter-spacing: `-0.02em` on headings; normal on body.

**Motion:**

- Reduced-motion aware (`prefers-reduced-motion`). When motion is OK: `transition-all duration-150 ease-out` on interactive elements; `animate-fade-in` on view transitions.
- No gratuitous animation — every motion must serve a purpose (direction, state change, hierarchy).

**Spacing:** 4px base unit. Tailwind's default scale is fine.

**Radius:** `rounded-xl` (12px) for cards/panels; `rounded-full` for pills/avatars; `rounded-lg` for buttons.

**Shadows:** Subtle. `shadow-sm` in light mode; no shadows in dark mode (use border instead).

### 2.2 — Shared component library (`src/components/`)

- [x] **`Avatar`** — generates a deterministic color + initials avatar from a username string. No external images.
- [x] **`Badge`** — pill label for media types, contact counts.
- [x] **`Button`** — `variant: primary | ghost | destructive`, sizes `sm | md | lg`.
- [x] **`IconButton`** — square button with a single icon child.
- [x] **`Spinner`** / **`ProgressBar`** — for ingest loading states.
- [x] **`EmptyState`** — centered icon + heading + body + optional CTA. Used everywhere data is absent.
- [x] **`Tooltip`** — accessible, keyboard-triggerable, follows the cursor.
- [x] **`Dialog`** / **`Sheet`** — accessible modal and slide-in panel (for lightbox, settings).
- [x] **`VirtualList`** — thin wrapper around `@tanstack/react-virtual` for vertical lists.
- [x] **`VirtualGrid`** — thin wrapper for masonry/grid layout (memories gallery).

### 2.3 — App shell (`src/app/`)

- [x] **Routing** — `react-router-dom` v6. Routes: `/` (import screen), `/chats`, `/chats/:contact`, `/memories`, `/stats`, `/search`.
- [x] **`<AppProvider>`** — context that holds: Dexie db instance, import status (`idle | importing | ready | error`), MiniSearch index reference.
- [x] **`<ImportScreen>`** — shown when no data is indexed yet.
  - Large, centered drop zone with dashed border and a folder icon.
  - "Drop your Snapchat export folder here" + a secondary "or click to browse" button (triggers FSA `showDirectoryPicker`).
  - On drop: animated progress bar with "Parsing X of Y files…" live count.
  - On success: auto-navigates to `/chats`.
  - On error: inline error with retry button and specific failure message.
- [x] **`<MainLayout>`** — persistent after first import.
  - Left sidebar (240px, collapsible to icon-rail on narrow viewports).
  - Main content area (flex-1, scrollable).
  - Sidebar nav items: Chats, Memories, Stats, + Search trigger at bottom.
  - At top of sidebar: small "SnapVault" wordmark + a re-import button (icon only, with tooltip "Re-import data").
- [x] **Dark/light mode toggle** — stored in `localStorage`, respects `prefers-color-scheme` as initial default.

- [x] Commit: `feat(ui): app shell, design system, shared components`

---

## Phase 3 — Chats view

**Goal:** Browse per-contact conversations and a unified all-contacts timeline.

### 3.1 — Contact list (`src/views/chats/ContactList.tsx`)

- [x] Sorted by most recent message by default; toggle to sort A→Z.
- [x] Shows: `<Avatar>` + display name (username) + last message timestamp + message count badge.
- [x] Virtualized with `<VirtualList>` — supports 346+ contacts without jank.
- [x] Inline search/filter: typing filters the list in real time (client-side, no round-trip).
- [x] Selected contact highlighted with accent-left-border.
- [x] **Empty state:** "No conversations found" with a search-clear CTA if filtering.

### 3.2 — Conversation pane (`src/views/chats/ConversationPane.tsx`)

- [x] Two-panel layout: `ContactList` left, `ConversationPane` right (responsive: stacks on small viewports).
- [x] Header: avatar + username + message count + first/last message date range.
- [x] Message list, **newest at bottom**, virtualized with `<VirtualList>`.
- [x] **`<MessageBubble>`** — right-aligned (sent, yellow), left-aligned (received, neutral).
  - Content: if `content` is non-null, show it. If null, show a ghosted label by media type (e.g. `📷 Photo`, `📍 Location`, `🎵 Note`, `🎉 Sticker`).
  - Timestamp: shown on hover (absolute), grouped by day with a date separator pill.
  - `IsSaved` indicator: a small bookmark icon on the bubble.
  - Media type icon: subtle, in the top-right corner of the bubble.
- [x] **Group chat support:** when `Conversation Title` is non-null, show the group name in the header instead of a username, and show the sender name above each received bubble.
- [x] **Unified timeline tab:** an "All conversations" entry at the top of the contact list that merges all messages across contacts into a single time-sorted stream.
- [x] Sort controls: newest-first / oldest-first toggle.
- [x] Filter controls: filter by media type (multiselect pill bar).

- [x] Commit: `feat(views): chats view — contact list + conversation pane`

---

## Phase 4 — Memories gallery

**Goal:** A beautiful, fast, browsable grid of all saved photos and videos.

> Join strategy: **files-drive, JSON metadata-only** (decided). See memory parser notes in Phase 1.

### 4.1 — Media grid (`src/views/memories/MediaGrid.tsx`)

- [x] **Masonry layout** — JS-calculated positions (variable-height cards arranged in columns). Compute column assignments and `top`/`left` positions after measuring each card's natural image aspect ratio; re-compute on window resize via a `ResizeObserver`. Default 3 columns; responsive breakpoints: 1 col (mobile), 2 col (tablet), 3–4 col (desktop). Virtualized: only render cards whose calculated bounding box intersects the scroll viewport.
- [x] **`<MemoryCard>`** — thumbnail (lazy-loaded `<img>`/`<video poster>`), overlay compositing (if `-overlay.png` is present, render it on top of the main media using CSS absolute positioning), date chip at bottom.
- [x] Click a card → opens `<MediaLightbox>`.
- [x] **`<MediaLightbox>`** — full-screen modal.
  - Image: full-res render with overlay composited.
  - Video: `<video controls autoPlay>` with overlay.
  - Left/right keyboard navigation (←/→ arrows) between media in the current filtered set.
  - Escape to close.
  - Bottom info strip: date, location (if non-zero lat/lng), media type.

### 4.2 — Filter bar

- [x] Filter by: media type (Photo / Video), date range (year picker → month picker).
- [x] Sort: newest-first / oldest-first.
- [x] "X memories" count updates live as filters change.

### 4.3 — Performance safeguards

- [x] Thumbnails lazy-loaded via `loading="lazy"` + `IntersectionObserver`.
- [x] Videos: show `<video>` element only when card enters viewport; use `poster` attribute (first frame) until then.
- [x] Never render all 1,400+ cards at once.

- [x] Commit: `feat(views): memories gallery — masonry grid + lightbox`

---

## Phase 5 — Stats view

**Goal:** Visual summary of activity. No per-contact call data (export limitation), but rich per-contact message and snap stats.

### Layout

Two-column on wide viewports, single-column on mobile. Cards with subtle borders, section headings.

### 5.1 — Top-level stats cards

- [x] Total messages sent / received (all time).
- [x] Total snaps sent / received.
- [x] Total memories saved.
- [x] Total call time (seconds → formatted as `Xh Ym`).
- [x] Active since (earliest event date).

### 5.2 — Activity-over-time chart

- [x] Monthly bar chart of message count. X-axis: months. Y-axis: message count.
- [x] **Hand-rolled SVG** (decided — no charting lib dependency). Build a `<BarChart>` and `<DonutChart>` primitive in `src/components/charts/` using raw `<svg>` elements and Tailwind for color tokens. Keeps the bundle lean and gives full visual control.
- [x] Toggle between: Messages / Snaps / Memories / Calls.

### 5.3 — Most-contacted (messages + snaps combined)

- [x] Top 10 contacts ranked by total interactions.
- [x] Horizontal bar chart or ranked list with avatars, counts, and a "sent vs. received" split bar.
- [x] Clicking a contact navigates to their conversation.

### 5.4 — Snap stats

- [x] Most-snapped contacts (separate from messages).
- [x] IMAGE vs VIDEO breakdown (donut chart or pill bar).

### 5.5 — Call stats (aggregate only)

- [x] Total incoming / completed / outgoing counts.
- [x] VIDEO vs AUDIO breakdown.
- [x] Average call duration.
- [x] Call activity over time (monthly bar, same chart component as 5.2).
- [x] Footnote: "Call logs don't include contact names — this is a limitation of the Snapchat export."

- [x] Commit: `feat(views): stats view — activity charts, most-contacted, call summary`

---

## Phase 6 — Global search & filters

**Goal:** Find anything across all data with a single keypress.

### 6.1 — Search overlay (`src/views/search/SearchOverlay.tsx`)

- [x] **Trigger:** `Cmd/Ctrl + K` globally, or clicking the search icon in the sidebar.
- [x] Full-screen modal overlay with a centered search input.
- [x] Input auto-focuses on open. Escape closes.
- [x] Results appear below the input, grouped by type: **Contacts**, **Messages**, **Memories** (by date).
- [x] Each result row shows: type icon, headline, secondary info (contact name for messages, date for memories).
- [x] Keyboard navigation: ↑/↓ to move through results, Enter to navigate.
- [x] No results state: "No results for '{query}'" with a suggestion to try a different term.

### 6.2 — Search engine

- [x] MiniSearch index built in Phase 1. Debounced query (150ms) from the input.
- [x] Contact name search: fuzzy match against all contact usernames.
- [x] Message content search: only saved messages have text — results are shown with the `content` snippet highlighted.
- [x] Memory search: by date string (e.g. "2024-02" returns all memories from Feb 2024).

### 6.3 — Filter integration

- [x] The filter bar in Chats and Memories views both use a shared `<FilterBar>` component.
- [x] Filters: date range (start/end date pickers), media type (multiselect), direction (sent/received) for Chats.
- [x] Filters are URL-searchparam-serialized so they survive navigation (e.g. `/chats?contact=alice&type=MEDIA`).
- [x] "Clear filters" resets all params and re-runs the unfiltered query.

- [x] Commit: `feat(search): global search overlay + filter integration`

---

## Phase 7 — Polish, empty states & accessibility

**Goal:** Every edge case is handled gracefully. The app feels finished.

### 7.1 — Empty states

Every view needs a thoughtful empty state — not a blank white page.

| View              | Condition                   | Empty state                                      |
| ----------------- | --------------------------- | ------------------------------------------------ |
| Import screen     | First visit                 | Animated drop zone with instructional copy       |
| Contact list      | No contacts found           | "No conversations match your search"             |
| Conversation pane | No messages in thread       | "No messages to show" with media type hint       |
| Memories gallery  | No memories after filtering | "No memories match these filters" + clear button |
| Stats             | No data yet                 | "Import your Snapchat export to see your stats"  |
| Search            | No results                  | "Nothing found for '{query}'"                    |
| Search            | Query too short             | "Type at least 2 characters to search"           |

### 7.2 — Error boundaries

- [x] A top-level `<ErrorBoundary>` catches React render crashes and shows a friendly "Something went wrong" screen with a reload button.
- [x] Per-parser warnings surface in a dismissible banner on the main layout (e.g. "Some memories couldn't be matched to files — X items skipped").

### 7.3 — Responsive layout

- [x] **Desktop (≥1024px):** Two-panel chats, three-column memories grid, full sidebar.
- [x] **Tablet (768–1023px):** Single-panel chats (back button to return to contact list), two-column memories, collapsible sidebar.
- [x] **Mobile (< 768px):** Stacked everything, bottom nav bar replaces sidebar, single-column memories.

### 7.4 — Accessibility

- [x] All interactive elements keyboard-navigable with visible focus rings.
- [x] ARIA labels on icon buttons, dialog roles on modals.
- [x] Color contrast: all text meets WCAG AA (4.5:1 minimum).
- [x] `prefers-reduced-motion`: all transitions disabled if user prefers.
- [x] Screen reader: landmark roles (`<nav>`, `<main>`, `<aside>`), live regions for async import progress.

### 7.5 — Performance audit

- [ ] Lighthouse score targets: **Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95**.
- [x] Bundle analysis with `rollup-plugin-visualizer` — ensure no accidental large transitive deps.
- [x] Verify memories grid: scroll through 1,400+ items without dropped frames.

### 7.6 — Final docs & README update

- [x] Update `README.md` setup instructions to reference `pnpm`.
- [ ] Add a screenshot or GIF to the README once the UI is stable.

- [x] Commit: `feat(polish): empty states, error boundaries, responsive layout, a11y`

---

## Phase 8 — Memories Snap Map

**Goal:** An interactive global Snap Map visualizing geotagged memories, allowing users to explore their memories geographically while maintaining strict offline privacy guarantees.

### Context & Data Findings

- In Snapchat exports, ephemeral chat snaps omit GPS coordinates, but saved memories (`memories_history.json`) frequently retain full GPS latitude and longitude metadata.
- In sample export data: ~40% (567 of 1,421) memories contain non-zero GPS coordinates (`"Location": "Latitude, Longitude: 0.5560059, 35.24502"`).
- Memories with unrecorded locations use `"Latitude, Longitude: 0.0, 0.0"` or empty strings.

### Hard Privacy Guarantees (`AGENTS.md`)

- **Zero user data leaves the machine:** No coordinates, dates, or media files are ever sent across the network.
- Map requests are strictly limited to public raster tile downloads (CartoDB Dark Matter or OpenStreetMap).
- Clustering, marker positioning, coordinate filtering, and media rendering execute 100% client-side in the browser.
- Full offline resilience: renders a coordinate grid and markers with an offline indicator if no internet connection is present.

### 8.1 — Geodata & Coordinate Utilities (`src/utils/geo.ts`)

- [x] **`parseCoordinates(locationStr)`**: Parses `"Latitude, Longitude: lat, lng"`, checks coordinate boundaries (`[-90, 90]` lat, `[-180, 180]` lng), and filters out Snapchat's unset default `(0.0, 0.0)`.
- [x] **`clusterGeoMemories(memories, zoom)`**: Client-side grid clustering engine grouping neighboring memories based on dynamic map zoom level.
- [x] **`formatCoordinates(lat, lng)`**: Converts raw decimal degrees to formatted compass coordinates (e.g. `0.5560° N, 35.2450° E`).
- [x] **Unit tests (`tests/utils/geo.test.ts`)**: 100% test coverage for parsing, boundary validation, invalid formats, and clustering behavior across zoom levels.

### 8.2 — Database & Hook Integration (`src/db/db.ts`)

- [x] **`getGeoMemories()`**: IndexedDB query helper that fetches all `MemoryEvent` records from Dexie, parses coordinates, and returns strongly-typed `GeoMemoryEvent[]` with non-null coordinates.

### 8.3 — Map UI & Components (`src/views/map/`)

- [x] **`<MapView>` (`src/views/map/MapView.tsx`)**:
  - Full-bleed interactive Leaflet map matching SnapVault's `#0f0f0f` dark mode palette.
  - Custom HTML markers (`L.divIcon`) with Snapchat yellow pins for individual memories and circular count badges for clusters.
  - Interactive cluster expansion and zoom-to-cluster on click.
  - Top filter bar: Type selector (`All` | `Photos` | `Videos`) and Year dropdown.
  - Quick action toolbar: `Fit All` bounds, basemap layer toggle (Dark Matter vs OpenStreetMap), and bottom memory tray toggle.
  - Smooth integration with `<MediaLightbox>` for full-screen inspection of images and videos with overlays.
  - Friendly empty state when no memories have valid location metadata.
- [x] **`<MapMemoryCard>` (`src/views/map/MapMemoryCard.tsx`)**:
  - Compact memory card for marker popups and the bottom memory tray.
  - Supports image previews and HTML5 video first-frame rendering via Blob Object URLs.
  - Displays formatted date, time, media type badge, and geographic coordinates.

### 8.4 — Routing & Navigation

- [x] Added `/map` route to `src/App.tsx`.
- [x] Added `Map` navigation item with `MapPin` icon and live geotagged count badge to desktop sidebar and mobile bottom nav in `src/app/MainLayout.tsx`.

### 8.5 — Bug Fixes & Refinements

- [x] **Map Container Sizing Fix**: Resolved blank map rendering by properly importing Leaflet stylesheet (`leaflet/dist/leaflet.css`), handling React container mount lifecycle, and triggering `map.invalidateSize()`.
- [x] **Video Thumbnail Decoding**: Fixed video cards in the memory tray displaying fallback text instead of video frames by creating Blob URLs, setting `preload="metadata"`, and rendering HTML5 video posters.
- [x] **CARTO API Key Integration**:
  - Configured `VITE_CARTO_API_KEY` and `CARTO_API_KEY` in `vite.config.ts` via `envPrefix: ['VITE_', 'CARTO_']`.
  - Added TypeScript typings in `src/vite-env.d.ts`.
  - Created `.env.example` template and `.env`.
  - Automatically appends API key to CartoDB basemap requests with automatic fallback to OpenStreetMap.

- [x] Commit: `feat(map): add memories location map view with leaflet`
- [x] Commit: `fix(map): resolve map container mounting and video tray thumbnail decoding`
- [x] Commit: `feat(map): support CARTO API key via environment variables`

---

## Dependency list (final)

```bash
# Runtime
pnpm add dexie minisearch @tanstack/react-virtual react-router-dom @fontsource/inter leaflet

# Dev
pnpm add -D tailwindcss @tailwindcss/vite typescript eslint prettier \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-react-hooks rollup-plugin-visualizer \
  vitest @testing-library/react @testing-library/user-event jsdom \
  @types/leaflet
```

> **Note:** No charting library. Charts are hand-rolled SVG components (`src/components/charts/`).

---

## Testing strategy

- **Unit tests (Vitest):** All parsers, the search index builder, the memories join logic, the Dexie import function (with an in-memory Dexie mock), geodata coordinate parser and clustering algorithms (`tests/utils/geo.test.ts`).
- **Component tests:** `<ImportScreen>` drop zone, `<MessageBubble>` content/null handling, `<MemoryCard>` overlay compositing, `<MapView>` Leaflet controls, cluster cards, and filter toggles (`tests/views/map/map.test.tsx`).
- **No E2E in v1** — the app is purely local and has no network layer to test against; unit + component coverage is sufficient.

Run tests with:

```bash
pnpm test          # watch mode
pnpm test:run      # CI single-run
```

---

## Commit cadence summary

| Commit                                                                       | Contents |
| ---------------------------------------------------------------------------- | -------- |
| `chore: scaffold Vite + React + TS + Tailwind + tooling`                     | Phase 0  |
| `feat(data): ingest pipeline, parsers, Dexie schema, search index`           | Phase 1  |
| `feat(ui): app shell, design system, shared components`                      | Phase 2  |
| `feat(views): chats view — contact list + conversation pane`                 | Phase 3  |
| `feat(views): memories gallery — masonry grid + lightbox`                    | Phase 4  |
| `feat(views): stats view — activity charts, most-contacted, call summary`    | Phase 5  |
| `feat(search): global search overlay + filter integration`                   | Phase 6  |
| `feat(polish): empty states, error bounds, responsive layout, a11y`          | Phase 7  |
| `feat(map): add memories location map view with leaflet`                     | Phase 8  |
| `fix(map): resolve map container mounting and video tray thumbnail decoding` | Phase 8  |
| `feat(map): support CARTO API key via environment variables`                 | Phase 8  |

---

## Design decisions — all resolved ✅

| #   | Decision                          | Choice                                                                                                                   |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Memories join strategy**        | Files-drive; JSON is metadata-only. Files are primary source of truth.                                                   |
| 2   | **Group chat display**            | Folded into the contact list (keyed by `Conversation Title` when non-null).                                              |
| 3   | **Charting approach**             | Hand-rolled SVG — `<BarChart>` and `<DonutChart>` in `src/components/charts/`.                                           |
| 4   | **Masonry layout**                | JS-calculated positions (`top`/`left`) with `ResizeObserver`; viewport-intersect virtualization.                         |
| 5   | **Map rendering & tile provider** | Leaflet with CARTO Dark Matter basemap (authenticated via `VITE_CARTO_API_KEY`), falling back to standard OpenStreetMap. |
| 6   | **Map clustering strategy**       | Pure client-side dynamic grid clustering (`clusterGeoMemories`) adapting to zoom level (zero external geocoding calls).  |
| 7   | **Video thumbnails in map tray**  | HTML5 `<video>` elements with Blob object URLs and `preload="metadata"` for local frame extraction.                      |
