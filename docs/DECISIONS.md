# DECISIONS — EchoJournal tradeoff log

One-line rationale each. Updated every phase.

## Phase 0

- Custom dev client from day 0 — whisper.rn needs native modules, Expo Go is a dead-end; pay the build cost early.
- NativeWind v4 (stable) over v5 (pre-release) — v5 needs Tailwind v4 + react-native-css; v4 + Tailwind v3 is proven on SDK 57.
- Tabs template over blank — router + TS + safe-area already wired; strip to blank home, faster than manual router setup.
- Bun over npm/yarn — required by spec; `bun.lock` committed, `bunx expo install` resolves SDK-compatible versions.
- Android-only (`com.echojournal.app`, dark UI) — mid-range Android is the target; no iOS paths built. New Architecture is default-on in SDK 57, no flag needed.
- expo-sqlite + FTS5 planned (Phase 1) over WatermelonDB/Realm — zero extra native complexity, FTS5 built in for search.
- Whisper model deferred to Phase 3; current plan tiny.en q5 — best speed/size for mid-range offline STT; base.en only if accuracy proves insufficient (benchmark in Phase 3).
- Bundled vs downloaded model deferred to Phase 3/6 — bundling bloats APK; download needs one-time WiFi prompt + progress UI.

## Phase 1

- `SQLiteProvider` + `useSQLiteContext` over manual `openDatabaseAsync` singleton — official SDK 57 pattern, migrations via `onInit`, no prop-drilling.
- `PRAGMA user_version` migrations over drizzle/knex — single-table v1 needs no ORM; keeps native complexity at zero.
- Timestamps as INTEGER ms (not ISO strings) — integer sort/index is faster on mid-range Android, no timezone parsing.
- FTS5 external-content table + triggers over manual LIKE — prefix search ranked by bm25 now, LIKE fallback only if MATCH syntax fails.
- Thin `entriesRepo` (db passed in) over hook-coupled queries — no raw SQL in components, repo unit-testable without React.
- Zustand store holds list state, takes `db` per action — hooks can't live in store file; passing db keeps store testable and avoids a global singleton.
- Debug route `app/db-debug.tsx` (Stack, not tab) — proves CRUD on-device without polluting the Phase 4 tab bar.

## Phase 2

- expo-audio over expo-av — expo-audio is the stable SDK 57 API (expo-av legacy); hooks + presets + metering built in.
- Custom 16 kHz mono preset over HIGH_QUALITY (44.1 kHz stereo) — ~4x smaller files, faster whisper STT, still intelligible; LOW_QUALITY (3gp/AMR) rejected as too lossy for transcription.
- Record straight to `document/` directory over cache + move — cache can be purged by the OS; document persists across restarts with zero move logic.
- Metering waveform (`isMeteringEnabled`, 100 ms poll, 28 bars) over static pulsing dot — real amplitude feedback for ~free, cheap view-only bars.
- Stop auto-saves a DB entry (placeholder transcript) over manual save step — proves audio→entry wiring now; Phase 3 replaces the placeholder with transcription.
- Debug route `app/record-debug.tsx` (Stack, not tab) — same rationale as db-debug; real Record tab lands Phase 4.

## Phase 3

- whisper.rn 0.7.4 (stable) over 0.8.0-rc — release candidates risk native build breaks on RN 0.86; 0.7.x peers are RN-agnostic.
- tiny.en q5_1 (30.7 MB) over tiny.en f16 (75 MB) / q8 (~80 MB) / base.en q5 (~110 MB) — q5_1 keeps mid-range RAM + APK budget safe; English-only model (no multilingual params); step up to base.en only if journal accuracy disappoints (benchmark log in record-debug will tell).
- Runtime model path `document/models/` over bundled `require()` — a gitignored binary must never be a static Metro dependency (missing file = broken bundle for everyone); repo copy is only a fetch cache. Download-on-first-launch UI lands Phase 6.
- WAV-only gate in code over attempting m4a — whisper.cpp cannot decode AAC; Android MediaRecorder cannot emit WAV, and ffmpeg-kit (the usual transcoder) is deprecated + ~25 MB of native libs. Recordings stay m4a (small, playable) until a MediaCodec-based transcode step is built + tested on-device — the highest-risk item, parked honestly instead of shipped blind.
- Lazy `await import('whisper.rn')` + typed `WhisperError` codes over top-level import + raw throws — missing native module (stale build/Expo Go) becomes a readable `native-unavailable` card, not a red screen; every failure mode has a code the UI can render.
- 2 s tone fixture (`assets/sample-16k.wav`, 64 KB, committed) over no fixture — proves model-load + file→text plumbing + timing on-device without needing speech; documented as plumbing-only, not an accuracy test.
- Transcribe success rewrites the entry (transcript + regenerated title) over a sidecar result — FTS triggers re-index automatically, so Phase 5 search works on transcripts for free.

## Phase 4

- @expo/vector-icons (Ionicons outline) over expo-symbols for tabs — symbols are iOS-centric; vector-icons render on Android with zero native risk (already a dep).
- One Journal screen (strip + pills + hero + day list) over separate Home + List screens — reference packs discovery on one scroll; less nav chrome, fewer routes to maintain.
- Detail as Stack push (`entry/[id]`) over modal or tab — editable form wants back-navigation + focus reload; dirty-gated Save prevents accidental overwrites.
- `Recorder` extracted as a component (Record tab) while `record-debug` stays as-is — debug screen is temporary pipeline proof; the shared lib/store hooks keep behavior identical without a risky refactor mid-phase.
- Transcribe affordance lives on the detail screen, Record tab never promises STT — m4a clips still can't transcribe (Phase 3 gate); the detail screen states this next to the clip instead of failing post-tap.
- Search + Settings ship minimal-but-real now, polish later — tabs must exist for nav to feel complete; both reuse final repo/store APIs, so Phase 5 (debounce/highlights) and Phase 6 (download/clear/export) only touch UI.
- `todayMs` focus snapshot over `Date.now()` in render — satisfies react-hooks/purity and survives midnight crossings on revisit.

## Phase 5

- 300 ms debounce over search-on-every-keystroke — local FTS5 is ms-scale, but 300 ms still collapses fast typing into one query per pause; shorter feels instant, longer feels laggy.
- 2-char minimum over single-char prefix search — one letter matches nearly every row (noise + wasted renders); two chars is the smallest meaningful prefix.
- Snippet window (~140 chars around first token hit) over full transcript — rows stay scannable; ellipsis flags show truncation honestly.
- Gold-pill highlights via regex split over a WebView or substring math — nested `<Text>` spans are the idiomatic RN approach, zero deps, case-insensitive with escaped tokens.
- Request-id stale guard over AbortController-style cancellation — expo-sqlite has no cancellable queries; a monotonically increasing id in the change handler invalidates in-flight promises cheaply.
- Derived `query !== debounced` "Searching…" hint over a busy flag — avoids sync setState-in-effect lint fights; local queries resolve in ms so a spinner would flicker anyway.

## Phase 6

- Non-blocking first-launch banner over a blocking model gate — journaling works fully without the model; only Transcribe needs it, so a dead-end gate would punish first impressions for zero gain.
- In-app download (expo-file-system `createDownloadTask` → `document/models/`) over `adb push`-only — push stays documented for devs, but real users need the WiFi-confirm + progress UI path.
- expo-sharing share sheet over a bare "saved to exports/" note — a file the user can't get off the device isn't an export; one curated dep, zero custom native code.
- Clear-all deletes audio files first, then rows — entry deletion alone orphans `.m4a` files (known since Phase 2); per-file try/catch keeps one corrupt file from blocking the wipe.
- Static `Skeleton` blocks over animated shimmer — no animation loop, no extra dep, zero mid-range cost; structure alone kills layout jump.
- `Buffer` (already a dep) over `TextEncoder` for export writes — Hermes `TextEncoder` availability is uncertain; `Buffer.from(text, 'utf8')` into the file `WritableStream` is proven in this bundle.

## Phase 7 — Auto-transcription (m4a transcode)

- `expo-video-audio-extractor` (MediaExtractor/MediaCodec, zero native deps) over hand-rolled native module — 266-line audited Kotlin does exactly our decode; writing our own module buys nothing but maintenance.
- `bun patch` (committed `patches/*.patch` + `patchedDependencies`) over forking — the lib's only SDK 57 breakage is one `Promise.reject` overload; a one-line patch beats a fork.
- Transcode-then-transcribe inside `store.transcribeEntry()` over exposing formats to UI — every screen (Record auto-flow, detail button, debug) gets m4a support with zero UI branches; `lib/whisper.ts` stays WAV-pure as defense in depth.
- Auto-transcribe on stop (when the model is present) over manual Transcribe taps — the requested behavior: every entry ends up with text, not just audio; model-missing still saves audio-only with a visible reason.
- `document/transcoded/` output over cache — transcodes are re-transcribable without redoing the decode; OS can't purge them mid-flow.

## Phase 8 — Add tab + templates

- One Add tab (Talk/Write toggle) over a Record-only tab — voice and written entries are the same action ("new entry"); a mic-only tab hid the faster path for short notes and made templates homeless.
- Templates as content cues (speaking bullets / Write starter text) over a schema field — no DB migration, no FTS impact; the words land in the transcript either way, so search works on them for free.
- 5 fixed templates over user-customizable ones — covers the journaling canon (free, gratitude, reflection, dump, goals); custom templates need storage + UI and can wait for real demand.
- Written entries push straight to detail over a saved card — nothing to transcribe, so no intermediate state; the detail screen is the confirmation.

## Later (placeholders)

- Phase 4: @expo/vector-icons over expo-symbols for tab bar — Android-safe, matches spec. ✓ DONE (Ionicons outline, `two.tsx` + SymbolView removed from tabs)
