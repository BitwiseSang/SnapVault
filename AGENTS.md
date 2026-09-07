# AGENTS.md

Instructions for any AI coding agent (Claude Code, Gemini CLI, or otherwise) working in this repository.

## Working style — read this first

This repo is worked on using an investigate-before-implement pattern. Concretely:

- **Investigate before writing code.** Before implementing a parser, component, or feature, trace through the actual data/call chain involved and confirm your understanding against real artifacts (real JSON files, real component props) — not against what `ARCHITECTURE.md` _assumes_ they look like.
- **Separate auditing from fixing.** If you're diagnosing a bug or an ambiguous schema, do that as its own pass — report what you found — before jumping into a fix. Don't interleave "investigating" and "patching" in the same breath; it hides mistakes.
- **Flag ambiguity instead of guessing.** If a JSON field could mean two things, if a file might be optional, or if a design decision in `ARCHITECTURE.md` doesn't hold up against the real data — stop and surface it explicitly (in your response, or in a `NOTES.md` at the repo root) rather than silently picking an interpretation and moving on.

## Schema status — already verified

The schemas in `ARCHITECTURE.md` have been verified against real sample data. The field names, types, and structure documented there are confirmed — do not treat them as hypothetical. The key findings that differ from the original assumptions are:

- **`chat_history.json` and `snap_history.json`** are both keyed by contact username at the top level. Field names use Pascal case with spaces (`"Media Type"`, `"IsSender"`, `"Created(microseconds)"`, etc.).
- **`Content` is `null` for most messages**, including `TEXT`-type ones. Snapchat does not export ephemeral message text. Do not assume text is present.
- **`talk_history.json` has no contact/participant field.** It is structured as `{ "Outgoing Calls": [], "Incoming Calls": [...], "Completed Calls": [...], "Chat Sessions": [], "Game Sessions": [] }`. There is no way to know who you called from this data.
- **`memories_history.json` has no UUID or filename reference.** Both `"Download Link"` and `"Media Download Url"` are empty strings. The JSON cannot be reliably joined to `memories/` files by any key — only by date heuristics. **Do not implement a memories parser without first deciding on and documenting a join strategy** (see `ARCHITECTURE.md` for options) and getting sign-off from the project owner.
- **`feature_emails.json`** is `{ "Email Used to Join": [] }` — empty. Out of scope for v1.

If you're adding a new parser or feature that touches a schema, verify the relevant portion of `ARCHITECTURE.md` still matches before writing code. If it doesn't, flag the discrepancy before patching.

## First task when touching parsers

Before writing or modifying any parser: re-read the verified schema section in `ARCHITECTURE.md` for the relevant file and cross-check a few real entries in `sample_data/json/` if available. Do not rely on memory or assumptions.

If sample data is present in `sample_data/`, use it for cross-checking only — **do not commit it to git** (see the git hygiene section below).

## Code conventions

- TypeScript, strict mode. No `any` — if a shape is genuinely unknown, model it as `unknown` and narrow it, or define an explicit `Unverified<T>` wrapper rather than silently typing it away.
- Functional React components, hooks-based. No class components.
- Colocate types with the feature that owns them (`src/parsers/chat.ts` owns its own message types); put only truly shared types in `src/models/`.
- Match the folder structure in `ARCHITECTURE.md` (`ingest/`, `parsers/`, `db/`, `search/`, `models/`, `components/`, `views/`, `app/`). If a change doesn't fit that structure, that's worth flagging rather than working around.

## Hard constraints — do not violate

- **No network calls involving user data.** This app's entire value proposition is that the export never leaves the machine. Don't add analytics, telemetry, or any fetch/XHR that sends parsed data anywhere, even for "just error logging."
- **Don't invent a Snapchat API.** There is no live API involved anywhere in this project — it is a static, offline export browser. If a task seems to imply calling out to Snapchat, that's a sign of a misunderstanding — stop and flag it.
- **Don't build zip ingest until Phase 1 (folder ingest) is solid**, and when you do, implement it behind the existing `IngestSource` interface rather than special-casing it elsewhere in the app.

## Git hygiene — critical

**The `sample_data/` directory must never be committed to git.** It contains a real Snapchat data export with private personal data. It is listed in `.gitignore` and must stay there. Before staging any files, confirm `sample_data/` is not included. If you find it unignored for any reason, fix `.gitignore` immediately and do not stage or push the directory.

This also applies to any other directory that looks like a Snapchat export (containing `json/chat_history.json`, `memories/`, etc.) — treat such directories as private data and keep them out of version control.

## CI and Pre-Commit Verification — critical

Before creating any commit, you **MUST** run all CI checks defined in `.github/workflows/ci.yml` locally and ensure they all exit with code 0:

1. `pnpm format:check` — Prettier formatting check
2. `pnpm lint` — ESLint rules and React hooks verification
3. `pnpm typecheck` — Strict TypeScript compilation (`tsc -b`)
4. `pnpm test:run` — Vitest unit and component test suite
5. `pnpm build` — Vite production bundle compilation

Do not commit code if any of these checks fail or produce errors.

## Git commit conventions — critical

- All commits must strictly follow the **Conventional Commits** specification (e.g. `feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`, `chore(...)`, `test(...)`, `ci(...)`).
- **Commit Title Limit**: The commit title (subject line) must be **no more than 50 characters** long.
- **Commit Body Required**: Every commit must include both a title and an explanatory body separated by a blank line.
- Both the title and body must adhere to the Conventional Commits specification, describing the motivation, implementation details, and impact of the changes.

## Testing expectations

- Parsers (`src/parsers/`) are the highest-risk, highest-value place for unit tests — they're the layer most likely to break silently against real-world schema quirks (missing fields, unexpected nulls, orphaned overlay files). Prioritize tests here over UI component tests.
- A malformed or partially-missing export (e.g. a memory entry with no matching file, or vice versa) should degrade gracefully — skip/flag the item, don't crash the whole import.
- Pay special attention to the memories join: whatever strategy is chosen, the parser must handle the case where the JSON entry count and the file count for a given date don't match.

## Reporting back

When you finish a task, summarize:

- What you verified against real data vs. what's still assumed.
- Any ambiguity you flagged instead of resolving unilaterally.
- Anything in `ARCHITECTURE.md` that turned out to be wrong or incomplete, so it can be corrected.
