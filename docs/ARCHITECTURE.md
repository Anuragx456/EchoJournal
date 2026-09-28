# ARCHITECTURE — EchoJournal

> Final state after Phase 7. All six spec phases complete + auto-transcription follow-up.

## 0. Stack (pinned at Phase 3)

- Expo SDK 57 (`expo ~57.0.25`), React 19.2.3, React Native 0.86.3
- expo-router `~57.0.23` — file-based routing, entry `expo-router/entry`
- expo-dev-client `~57.0.19` — custom dev client (required for whisper.rn native modules in Phase 3)
- expo-sqlite `~57.0.3` — on-device DB, FTS5 enabled via `expo-sqlite` config plugin (default `enableFTS: true`)
- expo-audio `~57.0.5` (+ expo-asset peer) — recording + playback, 16 kHz mono voice preset
- whisper.rn `0.7.4` (+ `buffer` polyfill) — on-device STT via whisper.cpp; WAV-only input
- expo-file-system `~57.0.7` — new `Paths`/`File`/`Directory` API for model file resolution (Phase 6 download reuses it)
- zustand `^5` — list state for entries + transcription status machine (takes `db` per action, no global DB singleton)
- expo-sharing `~57.0.22` — export .txt via the Android share sheet
- expo-video-audio-extractor `0.1.0` (patched, see below) — m4a→16 kHz mono WAV
  via MediaExtractor/MediaCodec, zero native deps; feeds whisper.rn
- NativeWind v4 (`nativewind ^4`, `tailwindcss ^3.4`) — Tailwind for RN
- TypeScript strict (`strict: true` in tsconfig, extends `expo/tsconfig.base`)
- Bun package manager (`bun.lock` committed; never commit `package-lock.json`)
- Icons: `@expo/vector-icons` (installed; template tabs still use `expo-symbols` until Phase 4 redesign)
- Target: Android only. No iOS-specific paths. `android.package: com.echojournal.app`.

## 1. Folder structure

```
/app
  _layout.tsx          root: SQLiteProvider (echojournal.db, onInit migrate) + Stack
                       (tabs) + entry/[id] + db-debug + record-debug + modal,
                       imports ../global.css, dark #0D0D0F
  (tabs)/
    _layout.tsx        bottom tabs (Ionicons, Android-safe): Journal / Add /
                       Search / Settings — gold active tint, dark bar
    index.tsx          Journal home: calendar strip + quick pills + today's hero
                       + selected-day list (or "On this day" past-years filter)
    add.tsx            Add tab: 5 template cards + Talk/Write toggle; Talk = Recorder
                       + saved-entry card (auto-transcribe) with template speaking
                       cues, Write = title + body (template starter) -> entry detail
    search.tsx         live FTS5 search: 300 ms debounce, 2-char minimum, snippets +
                       gold highlights, stale-query guard; rows push to detail
    settings.tsx       model management (download w/ progress, delete), journal
                       export (.txt + share sheet), clear-all-data (with audio
                       cleanup), debug links
  entry/[id].tsx       detail/edit: title + transcript TextInputs (dirty-gated Save),
                       delete, voice-clip player, TranscribeButton
  db-debug.tsx         CRUD debug screen (Stack, NOT a tab): add dummy, edit, delete,
                       clear, FTS5 search box, FlatList — proves Phase 1 on-device
  record-debug.tsx     recording + transcription debug screen (Stack, NOT a tab):
                       (Phase 7: per-clip Transcribe now auto-converts m4a)
                       mic permission flow, record/stop mic button, metering waveform,
                       playback + saved clips list, Whisper model card, per-clip
                       Transcribe (WAV only), sample-WAV smoke test, benchmark log
                       — proves Phase 2–3 on-device (real Record tab lands Phase 4)
  modal.tsx            template modal (kept)
  +not-found.tsx       template 404 (kept)
/components
  CalendarStrip.tsx    horizontal day strip (60 past / 14 future, scrolls to selection):
                       today pill, selected gold fill, grape dot for entry days
  Recorder.tsx         permission flow + record/stop + duration + 28-bar metering;
                       stop persists clip + creates entry, reports entry id
  TranscribeButton.tsx entry-scoped transcribe (m4a auto-converts first — every
                       clip with audio is transcribable)
  HighlightedText.tsx  query-token highlights (gold pill) for search result rows
  Skeleton.tsx         static loading placeholder blocks (journal + detail)
  + template Themed/EditScreenInfo/useColorScheme (unused by new screens)
/constants/Colors.ts   template tint colors (UNUSED — tokens live in tailwind.config.js)
/lib
  entries.ts           titleFromTranscript(), formatDuration(), formatEntryDate() — pure helpers
  audio.ts             VOICE_RECORDING_OPTIONS (16 kHz mono m4a, document dir, metering),
                       get/requestMicPermission(), meteringToLevel()
  whisper.ts           WHISPER_MODEL_* constants, WhisperError taxonomy, lazy initWhisper
                       singleton, transcribeAudioFile() with modelLoadMs/transcriptionMs
                       timing; WAV-only gate + <0.8 s empty-audio guard
  dates.ts             dayKey/monthDayKey/startOfDay/addDays + dowLetter/dayNumber,
                       dayLabel (Today/Yesterday/locale), groupEntriesByDay()
  search.ts            tokenizeForHighlight(), escapeRegExp(), snippetForTokens()
                       (~140-char window around first token hit, ellipsis flags)
  useDebouncedValue.ts generic debounce hook (search uses 300 ms)
  templates.ts         TEMPLATES (5: Free Flow / Gratitude / Daily Reflection /
                       Brain Dump / Goals) + starterFor() Write-mode prefill
  export.ts            buildExportText() (pure) + writeExportFile() to
                       document/exports/ via WritableStream + Buffer (no TextEncoder
                       dependency); clear-all-data helper lives in Settings
  transcode.ts         transcodeToWav() — m4a/AAC clips -> document/transcoded/
                       16 kHz mono WAV via extractAudio (channels 1, rate 16000)
/store
  useEntriesStore.ts   zustand: entries, totalCount, loading, error;
                       refresh/create/update/remove/search — each takes db: SQLiteDatabase
  useTranscriptionStore.ts  zustand status machine (idle/checking-model/model-missing/
                       loading-model/transcribing/done/error), progress, outcome,
                       benchmark log (last 20); transcribeEntry() writes transcript
                       back via updateEntry()
/db
  client.ts            DATABASE_NAME='echojournal.db', DATABASE_VERSION=1,
                       migrateDbIfNeeded() — PRAGMA user_version, WAL + FK, v1 schema
  types.ts             Entry / NewEntry / EntryPatch / EntryRow + rowToEntry()
  entriesRepo.ts       create/get/list/range/update/delete/count/clear/search — no SQL elsewhere
  index.ts             public re-exports
/assets
  /images, /fonts      template assets
  /models              ggml-tiny.en-q5_1.bin (30.7 MB, gitignored — fetch via
                       `bun run model:download`); pushed to document/models/ on-device
  sample-16k.wav       2 s 16 kHz mono pipeline fixture (tone, 64 KB, committed)
/docs                  README, ARCHITECTURE, CHANGELOG, DECISIONS
global.css             @tailwind base/components/utilities — NativeWind entry
tailwind.config.js     content: ./app + ./components, preset: nativewind/preset;
                       full token set — see §6 Design tokens
babel.config.js        presets: ['babel-preset-expo', 'nativewind/babel']
metro.config.js        withNativeWind(config, { input: './global.css' }) +
                       assetExts.push('bin', 'wav') for model/sample requires
tsconfig paths         "whisper.rn" → ./node_modules/whisper.rn/lib/typescript/index
                       (package exports map lacks ".", types only — Metro uses
                       main/react-native fields at runtime)
nativewind-env.d.ts    /// <reference types="nativewind/types" />
css.d.ts               declare module '*.css' (lets TS import global.css)
assets.d.ts            declare module '*.wav' (lets TS require sample fixture)
eslint.config.js       flat config, extends eslint-config-expo/flat
.prettierrc            singleQuote, printWidth 100
```

Non-route code must stay OUTSIDE `/app` (components, hooks, utils in `/components`, `/lib`, `/store`, `/db`).

## 2. Data layer (Phase 1 — implemented)

Schema v1 (`db/client.ts`, `PRAGMA user_version = 1`):

```sql
entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  audio_path TEXT,              -- NULL until Phase 2 recording lands
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,  -- unix ms, indexed DESC
  updated_at INTEGER NOT NULL   -- unix ms, bumped on every update
);
CREATE INDEX idx_entries_created_at ON entries (created_at DESC);

entries_fts VIRTUAL TABLE USING fts5(
  title, transcript, content='entries', content_rowid='id'
);
-- triggers entries_ai / entries_ad / entries_au keep FTS in sync
```

Repo API (`db/entriesRepo.ts` — all take `db: SQLiteDatabase`, all params bound):

| Function | SQL | Notes |
|---|---|---|
| `createEntry(db, {title, transcript, audioPath?, durationMs?, createdAt?})` | `INSERT` + `SELECT` by `lastInsertRowId` | `created_at` defaults to now, `updated_at` always now |
| `getEntryById(db, id)` | `SELECT … WHERE id = ?` | returns `Entry \| null` |
| `listEntries(db, limit=100, offset=0)` | `ORDER BY created_at DESC LIMIT ? OFFSET ?` | default cap keeps mid-range lists cheap |
| `listEntriesByRange(db, startMs, endMsExclusive)` | `WHERE created_at >= ? AND created_at < ?` | reserved for Phase 4 calendar strip |
| `updateEntry(db, id, patch)` | read-merge-`UPDATE` + bump `updated_at` | returns updated `Entry \| null` |
| `deleteEntry(db, id)` | `DELETE WHERE id = ?` | returns `changes > 0` |
| `countEntries(db)` | `SELECT COUNT(*)` | empty-state + debug header |
| `clearAllEntries(db)` | `DELETE FROM entries` | debug + Phase 6 “clear all data” |
| `searchEntries(db, query)` | `entries_fts MATCH ? ORDER BY bm25(entries_fts) LIMIT 50` | tokens sanitized (`"t"*` prefix), LIKE fallback on syntax error |

Store (`store/useEntriesStore.ts`): `entries`, `totalCount`, `loading`, `error`,
`refresh/create/update/remove/search`. Components call e.g.
`const db = useSQLiteContext(); refresh(db)` — never import `expo-sqlite` SQL directly.

Data flow (audio + transcription wired; m4a auto-converts — Phase 7):

```
record-debug (useAudioRecorder 16 kHz mono -> document/*.m4a)
  -> stop auto-creates entry (audio_path + duration_ms, placeholder transcript)
  -> useEntriesStore -> entriesRepo -> expo-sqlite
  -> clips list (useAudioPlayer per uri) — survives restarts
  -> Transcribe (any format): useTranscriptionStore.transcribeEntry()
       -> m4a? lib/transcode transcodeToWav() (MediaCodec -> document/transcoded/)
       -> lib/whisper transcribeAudioFile() (initWhisper lazy singleton, WAV-only gate)
       -> whisper.rn transcribe() w/ onProgress -> {text, segments, timings}
       -> updateEntry() replaces placeholder + regenerates title
          (FTS triggers re-index automatically)
```

- No raw SQL in components — enforced: only `entriesRepo.ts` contains SQL strings.
- Entry data ONLY in SQLite (`echojournal.db`). AsyncStorage not used (flags only, later).
- STT never leaves the device; `transcribeAudioFile` throws typed `WhisperError`s
  (`native-unavailable` / `model-missing` / `model-load-failed` /
  `unsupported-format` / `empty-audio` / `transcription-failed`) surfaced by the
  transcription status machine — no silent failures.

Journal UI flow (Phase 4):

```
Journal tab (useFocusEffect refresh) -> entries -> markedDays (dots)
  -> select day -> day-filtered list -> entry/[id] push route
Add tab Talk (Recorder onSaved) -> saved card -> Open entry -> detail;
Add tab Write (template starter -> edit -> Save) -> detail directly
Detail: dirty-gated Save (updateEntry + refresh) / Delete (deleteEntry + back) /
  ClipPlayer (useAudioPlayer) / TranscribeButton (WAV only -> onDone reload)
```

- New screens are dark-only and use tokens (`bg-ink`, `bg-card`, `text-paper`…),
  never `StyleSheet` colors or `useColorScheme`.
- `Date.now()` never runs during render (react-hooks/purity): Journal owns a
  `todayMs` state snapshot refreshed on focus; `CalendarStrip` takes it as a prop.
- Typed routes (`experiments.typedRoutes`) make `router.push('/entry/${id}')`
  compile-checked — typecheck proves every push target exists.

Search UI flow (Phase 5):

```
Search tab input -> useDebouncedValue(300 ms) -> store.search() -> entriesRepo.searchEntries()
  -> rows + tokenizeForHighlight(debounced) -> snippetForTokens() (~140-char window)
  -> HighlightedText (gold pill per token hit) -> push entry/[id]
```

- 2-char minimum + request-id stale guard: shrinks/clears invalidate in-flight
  queries in the change handler (no setState-in-effect lint fights); the effect
  only fires network-free local FTS (LIMIT 50, ms-scale), so no busy flag needed —
  the derived `query !== debounced` drives the Searching… hint.

First-launch + model management flow (Phase 6):

```
Journal focus -> checkModel() -> modelReady === false -> dismissible banner -> Settings
Settings Download (WiFi-confirm Alert) -> File.createDownloadTask(HF URL -> document/models/)
  w/ progress bar -> done -> checkModel() -> ready  |  Delete model -> File.delete() + releaseWhisper()
Settings Export -> listEntries(500) -> buildExportText() -> document/exports/*.txt -> share sheet
Settings Clear all -> Alert confirm -> delete each audio File -> clearAllEntries() -> refresh
```

- Non-blocking by design: journaling (record/play/search) works fully without the
  model; only Transcribe needs it. No dead-end gates on first launch.
- Download runs on the native transfer task (progress via `onProgress`); if the
  app is killed mid-download, a partial file may remain and look "present" —
  Delete model + retry is the documented recovery (no checksum gate yet).

Performance notes (Phase 6 pass):

- STT never blocks the JS thread: whisper.cpp runs on native threads, results
  cross via JSI; `onProgress` (0–100) is the only JS traffic during a job.
- SQLite is async-only throughout; lists are capped (`listEntries` default 100,
  export/clear cap 500/1000) for mid-range memory.
- Zustand selectors (`useStore((s) => s.x)`) in every screen — progress ticks
  re-render only the transcribing control, not whole screens.
- Static `Skeleton` blocks (no animation loop) for journal/detail loading —
  zero-cost placeholders instead of spinners.

## 3. Key decisions (summary — rationale in DECISIONS.md)

- Custom dev client from day 0, even though Phase 0 boots without native modules — avoids Expo Go dead-end when whisper.rn lands.
- NativeWind v4 (stable) over v5 (pre-release) — v5 needs Tailwind v4 + react-native-css; v4 + Tailwind v3 is proven on SDK 57.
- Tabs template as starting point (router + TS + safe-area already wired), stripped to blank home — faster than blank + manual router setup.
- Android-only: `userInterfaceStyle: dark`, package `com.echojournal.app` (New Architecture is default-on in SDK 57 — no `newArchEnabled` flag; `expo-doctor` rejects it).
- SQLite + FTS5 over WatermelonDB/Realm (Phase 1) — zero native complexity beyond expo-sqlite, FTS5 built in.
- Model choice: tiny.en q5_1 over base.en / q8 (Phase 3) — see DECISIONS.md.
- Single Journal screen (strip + pills + hero + day list) over separate Home/List screens — reference packs everything on one scroll; day filter + dots cover browsing until Phase 5 search polish.
- Detail as Stack push route (`entry/[id]`) over modal — editable form with back nav; dirty-gated Save avoids accidental writes.

## 6. Design tokens (Phase 4 — reference-adapted dark system)

Reference is a dark card-based insights app (charcoal bg, gold active tab,
purple banner). Adapted to journaling — tokens in `tailwind.config.js`:

| Token | Value | Usage |
|---|---|---|
| `ink` | `#0D0D0F` | app background, tab bar |
| `card` | `#17171A` | cards, inputs, pills (inactive) |
| `edge` | `#26262B` | hairlines, tab bar top border |
| `paper` | `#F5F3EE` | primary text |
| `mist` | `#A7A7AE` | secondary text |
| `faint` | `#6E6E76` | tertiary / placeholders |
| `gold` | `#E8A33D` | active tab, primary buttons, selected day, "today" |
| `grape` | `#7C5CFF` | hero card, entry-day dots, transcribe button |
| `ember` | `#E5484D` | recording, destructive |
| `moss` | `#3FA46F` | success confirmations |

- Radii: `card` 20 px, `sheet` 24 px; pills via `rounded-full`.
- Type: `display` 28/800, `title` 20/700, `body` 14/400, `caption` 12/500, `micro` 11/500.
- Dark-only: no light theme, no `useColorScheme` branching in new screens
  (template `constants/Colors.ts` is unused — delete in a later cleanup).
- Tab icons: Ionicons outline set (`book/mic/search/settings`) — Android-safe;
  template `expo-symbols` `SymbolView` removed from tab bar with `two.tsx`.

## 4. Native-module notes (capture precisely — do not rely on memory)

Phase 0:
- `bunx expo install expo-dev-client` resolved `expo-dev-client@~57.0.19` via Bun. No app.json plugin needed.
- `bunx expo install nativewind@^4 tailwindcss@^3.4 react-native-reanimated react-native-safe-area-context` — reanimated/safe-area already SDK-pinned, no version fight.
- `bunx expo install @expo/vector-icons` — resolved `@15.1.1`, SDK 57 compatible.
- Metro: must wrap with `withNativeWind`; otherwise `className` silently does nothing. Verified config in `metro.config.js`.
- Babel: both `babel-preset-expo` AND `nativewind/babel` required; order as listed.
- `global.css` must be imported in root `_layout.tsx` (`import '../global.css'`) — without this, Tailwind classes are no-ops.
- TS: `css.d.ts` needed for `import '../global.css'` to typecheck.

Phase 1:
- `bunx expo install expo-sqlite` resolved `expo-sqlite@~57.0.3` and auto-added `"expo-sqlite"` to `app.json` plugins (default `enableFTS: true` — no custom flags needed for FTS5).
- `bun add zustand` (pure JS, no `expo install` needed) resolved `zustand@^5.0.15`.
- Pattern is `SQLiteProvider databaseName onInit` + `useSQLiteContext()` — do NOT use a manual `openDatabaseAsync` singleton; provider guarantees `migrateDbIfNeeded` runs before queries.
- `PRAGMA journal_mode = WAL` in migration; FTS5 virtual table + 3 triggers must be created in the same `execAsync` as the base table (fresh installs) — `user_version` gates future migrations.
- Async API only (`runAsync`/`getAllAsync`/…) — sync variants block the JS thread on mid-range Android.

Phase 2:
- `bunx expo install expo-audio` resolved `expo-audio@~57.0.5` (+ `expo-asset@~57.0.18` peer — `expo-doctor` fails without it) and auto-added both plugins to `app.json`. Audio plugin configured with explicit mic message, background playback/recording OFF.
- `RECORD_AUDIO` permission is declared by the expo-audio plugin (Android) — no manual manifest edits. Runtime flow is `getRecordingPermissionsAsync()` (check) → `requestRecordingPermissionsAsync()` (ask) → denied UI with `Linking.openSettings()` + Ask-again.
- `useAudioRecorder(VOICE_RECORDING_OPTIONS)` + `prepareToRecordAsync()` → `record()` → `stop()` (uri on `recorder.uri`, duration via `recorder.getStatus().durationMillis`). Must `prepareToRecordAsync()` before EVERY record — recorder is one-shot per take.
- Duration MUST be read BEFORE `stop()`: expo-audio resets `durationMillis` to 0 on stop, so a post-stop read reports every clip as 0 ms (caused false `empty-audio` rejections in early Phase 7). Pattern: `Math.max(getStatus().durationMillis, recorderState.durationMillis)` pre-stop. As backstop, `transcribeAudioFile()` measures the WAV file size (32 000 B/s) and only throws `empty-audio` when the file itself is short.
- Voice preset = HIGH_QUALITY base overridden to 16 kHz / mono / 32 kbps m4a + `directory: 'document'` + `isMeteringEnabled: true`. Cache dir is OS-purgeable; document persists.
- Metering: `useAudioRecorderState(recorder, 100)` exposes `metering` (dB) → `meteringToLevel()` → 28-bar history. Player side: `useAudioPlayer(uri)` + `useAudioPlayerStatus(player)` (seconds — multiply by 1000 for `formatDuration`).
- `setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true })` on mount; wrap in try/catch (best-effort on web).

Phase 3 (whisper.rn — read this before touching STT):
- `bunx expo install whisper.rn` resolved `whisper.rn@0.7.4` (peers: react + react-native only — no version fight with RN 0.86). No config plugin; autolinking via prebuild/CNG (`bunx expo run:android` regenerates native projects). Expo Go NEVER works (native whisper.cpp).
- whisper.rn `package.json` "exports" has NO "." entry. Metro still bundles the root specifier via file-based fallback (`react-native` field → `src/index.ts`) but prints a WARN — harmless, do NOT "fix" by deep imports. TS, however, hard-fails; fix is types-only: `tsconfig paths` maps `"whisper.rn"` → `./node_modules/whisper.rn/lib/typescript/index`. Metro ignores tsconfig paths, so runtime is unaffected.
- `bun add buffer` (pure JS, like zustand — NOT via expo install): whisper.rn `src/index.ts` imports `safe-buffer` → `require('buffer')`; without the npm `buffer` package Metro export fails with "Unable to resolve module buffer". Verified failure → fix → export green.
- `bunx expo install expo-file-system` resolved `~57.0.7`. SDK 57 root-imported legacy helpers are deprecated stubs that THROW at runtime — must use the new API: `Paths.document` + `new File(dir, ...)` + `file.exists`/`.uri`/`.delete()`, `new Directory(...).create()`. Phase 6 download reuses `File.downloadFileAsync` / `createDownloadTask`.
- Model placement: runtime path is ALWAYS `document/models/ggml-tiny.en-q5_1.bin` (`modelFileUri()`); the repo copy in `assets/models/` is gitignored and only a local fetch cache (`bun run model:download`, 30.7 MB). No static `require()` of the model — a missing gitignored binary would break Metro for everyone. Only the 64 KB `sample-16k.wav` fixture is `require()`d (hence `assetExts.push('bin','wav')` + `assets.d.ts`).
- API shape (0.7.4): `initWhisper({filePath})` → ctx; `ctx.transcribe(path|assetId, {language, onProgress})` → `{stop, promise: TranscribeResult{result, language, segments[{text,t0,t1}], isAborted}}`; `ctx.release()`. `transcribeData()` (PCM ArrayBuffer) reserved for a future realtime path.
- WAV-ONLY: whisper.cpp decodes WAV (any rate/channels — resampled in native); m4a/AAC/MP3 throw. `transcribeAudioFile()` pre-gates extensions (`unsupported-format`) so users never burn minutes on a doomed job; `<0.8 s` clips short-circuit (`empty-audio`).
- Import whisper.rn LAZILY (`await import('whisper.rn')` inside `getContext()`) so a missing native module surfaces as `native-unavailable` instead of a red-screen at startup. Context is a lazy singleton; `releaseWhisper()` for Phase 6 model switching.

Phase 7 (on-device transcode — read this before touching audio formats):
- `bunx expo install expo-video-audio-extractor` resolved `0.1.0` (single maintainer, last tested on SDK 53 — audited before trusting: 266-line Kotlin, Expo Modules API, zero native deps, MIT). No config plugin; autolinked via prebuild. `extractAudio({video: m4aUri, output, format: 'wav', channels: 1, sampleRate: 16000})` → 16 kHz mono WAV. It does NOT resample/downmix (writes decoder bytes, labels header) — correct for our 16 kHz mono recordings, do NOT feed it other formats without verifying.
- SDK 57 breakage (exactly one line): `promise.reject("EXTRACT_ERROR", t)` no longer matches `expo-modules-core` (`reject(code, message, cause?)`). Fixed via `bun patch`: edit `node_modules/.../ExpoVideoAudioExtractorModule.kt:38` → `promise.reject("EXTRACT_ERROR", t.message, t)`, then `bun patch --commit` → committed `patches/expo-video-audio-extractor@0.1.0.patch` + `patchedDependencies` in package.json (auto-applied on every `bun install`). Re-run prebuild after patching — then re-apply the manual `reactNativeArchitectures=arm64-v8a` (prebuild resets gradle.properties to 4 ABIs).
- `lib/transcode.ts` is the only file that touches the extractor (output `document/transcoded/`, `file://` normalization); store calls it before whisper when `!isWavUri()`. Transcode failures surface as `transcription-failed` with a "Could not convert" prefix.

## 5. Conventions

- TypeScript strict; prefer clear naming over comments; inline comments only where logic isn't self-evident.
- All user-visible strings in components (no hard-coded strings in repos/stores).
- `bunx expo install <pkg>` for every Expo / native package (resolves SDK-compatible versions). Never `bun add` for those (`zustand`, `buffer` are the exceptions — pure JS).
- Before declaring any phase done: `bun run lint` + `bun run typecheck` clean, `bunx expo-doctor` if native deps changed.
- `assets/models/*.bin` gitignored — never commit model binaries.
