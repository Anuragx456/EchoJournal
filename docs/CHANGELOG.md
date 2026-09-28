# CHANGELOG — EchoJournal

## Phase 8 — Add tab + templates (2026-09-28)

Added:
- Add tab replaces the Record tab in the navbar (Talk/Write toggle): Talk keeps the Phase 7 flow (Recorder + auto-transcribe + speaking cues), Write is title + body with a Save button pushing straight to the detail screen
- 5 journal templates (lib/templates.ts): Free Flow, Gratitude, Daily Reflection, Brain Dump, Goals & Intentions — cards on the Add screen; prompts render as Talk cues and as Write-mode starter text
- Journal New Entry pill + empty-state card now route to /add

Tested:
- bun run typecheck / bun run lint / bunx expo export --platform android — clean
- JS-only change (no native deps) — reload the dev client, no rebuild needed

Decisions:
- See docs/DECISIONS.md Phase 8 (unified Add tab, templates-as-cues, 5 fixed, write-pushes-to-detail)

## Phase 7 — Auto-transcription (2026-09-27)

Added:
- `expo-video-audio-extractor@0.1.0` (audited 266-line Kotlin, MediaExtractor/MediaCodec, zero native deps) + one-line SDK 57 compat patch via `bun patch` (committed `patches/*.patch`)
- `lib/transcode.ts`: m4a clips → `document/transcoded/` 16 kHz mono WAV before whisper runs; `isWavUri()` exported from `lib/whisper.ts`
- Auto-transcribe on stop (Record tab): saved clip transcribes immediately when the model is present (progress → text snippet on the saved card); audio-only + reason when the model is missing
- Detail `TranscribeButton` + record-debug now handle m4a transparently (WAV gate stays in `whisper.ts` as defense in depth)
- Recorder `onSaved` reports `{id, uri, durationMs}` for the auto-flow

Tested:
- `bun run typecheck` / `bun run lint` / `bunx expo-doctor` — clean, 21/21
- `bunx expo export --platform android` — bundled OK
- Rebuilt dev client (`installDebug`) with the patched extractor — BUILD SUCCESSFUL, installed on device
- On-device speak test NOT run in this env (no UI automation) — user verifies: Record → speak → Stop → watch Transcribing % → text appears → Open entry

Decisions:
- See `docs/DECISIONS.md` Phase 7 (extractor over hand-rolled module, bun patch over fork, transcode-in-store, auto-on-stop, transcoded/ dir)

Known issues / next:
- No download checksum/resume (unchanged); transcode of non-16kHz-mono inputs unverified (we only ever feed our own preset)

### Phase 7 fix — duration capture (2026-09-27)

Fixed:
- False `empty-audio` ("Clip is shorter than 0.8 s") on real recordings: `Recorder` + `record-debug` read `durationMillis` AFTER `stop()`, but expo-audio resets it to 0 on stop — every clip reported 0 ms. Duration is now captured BEFORE `stop()` (max of `getStatus()` + live `recorderState`).
- Defense in depth: `transcribeAudioFile()` now measures the WAV's real length from file size (16 kHz mono 16-bit = 32 000 B/s) and only throws `empty-audio` when the file itself is short; the measured length is returned in the outcome.
- Successful transcriptions now write back the measured `durationMs` — self-heals the `duration_ms=0` rows saved by the buggy build; retrying those entries from the detail screen works without re-recording.

## Phase 6 — Polish & Model Management (2026-09-27)

Added:
- In-app model download (`store/useTranscriptionStore.ts`): `startModelDownload()` via expo-file-system `File.createDownloadTask` (HF tiny.en q5_1 URL → `document/models/`) with live progress, `deleteModel()` (`File.delete()` + `releaseWhisper()` + recheck)
- Settings management: model card (status/size/path, Download with WiFi-confirm Alert + progress bar, Delete with confirm), Journal data card (entry count, Export as text, Clear all data with confirm), Debug links
- Export (`lib/export.ts`): `buildExportText()` (pure) + `writeExportFile()` (`document/exports/*.txt` via `WritableStream` + `Buffer`) → Android share sheet via `expo-sharing ~57.0.22`
- Clear-all-data: deletes each entry's audio `File` first (per-file try/catch), then `clearAllEntries()` + `refresh()`
- First-launch flow: Journal checks `modelReady` on focus → dismissible gold banner → Settings when missing; journaling never blocked
- Loading skeletons (`components/Skeleton.tsx`, static blocks): journal (strip/hero/list placeholders) + detail (back/title/body placeholders)
- Performance notes in `ARCHITECTURE.md`: native-thread STT via JSI, async-only capped SQLite, zustand selectors, static skeletons

Tested:
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bunx expo-doctor` — 21/21 passed (added `expo-sharing` native dep)
- `bunx expo export --platform android` — Metro bundled OK, proves Settings/download/export bundle
- On-device NOT run in this env (no Android SDK) — on a dev build: fresh install → Journal banner → Settings → Download (progress → ready) → Record → Open entry → Transcribe (WAV) → Export → share sheet → Clear all → empty journal

Decisions:
- See `docs/DECISIONS.md` Phase 6 (non-blocking banner, in-app download, share sheet, files-first wipe, static skeletons, Buffer over TextEncoder)

Known issues / next (post-spec backlog):
- m4a → WAV on-device transcode still pending — the single highest-risk item; Record/detail never promise STT for m4a
- No download checksum/resume — partial downloads recover via Delete model + retry
- `record-debug`/`db-debug` still mounted (temporary); template `constants/Colors.ts` + modal/EditScreenInfo unused by new screens — delete in a cleanup pass
- iOS paths never built (Android-only per spec)

## Phase 5 — Search (2026-09-27)

Added:
- Live search (`app/(tabs)/search.tsx`): 300 ms debounced as-you-type querying via `store.search()` (Phase 1 repo unchanged), 2-char minimum, clear (×) button, stale-query request-id guard
- `lib/search.ts`: `tokenizeForHighlight()`, `escapeRegExp()`, `snippetForTokens()` (~140-char window around first token hit + ellipsis flags)
- `lib/useDebouncedValue.ts`: generic debounce hook
- `components/HighlightedText.tsx`: case-insensitive token highlights as nested gold-pill `<Text>` spans
- Result rows show highlighted title + highlighted transcript snippet + date/duration → detail push

Tested:
- `bun run typecheck` — clean
- `bun run lint` — clean (no set-state-in-effect issues: state updates live in event handlers + promise continuations only)
- `bunx expo-doctor` — 21/21 passed (no native changes)
- `bunx expo export --platform android` — Metro bundled OK, proves search bundle
- On-device NOT run in this env (no Android SDK) — on a dev build: Search → type 2+ letters → results appear as you type with gold highlights → tap row → detail

Decisions:
- See `docs/DECISIONS.md` Phase 5 (300 ms debounce, 2-char minimum, snippet window, regex-split highlights, request-id guard, derived Searching hint)

Known issues / next:
- Snippet shows the first token hit only (not all hits); ranking is repo `bm25` order — fine for journal scale
- Settings model download/clear/export still land in Phase 6

## Phase 4 — Journal UI (2026-09-27)

Added:
- Design tokens (`tailwind.config.js` extend): ink/card/edge/paper/mist/faint/gold/grape/ember/moss, radii card/sheet, type display/title/body/caption/micro — documented in `ARCHITECTURE.md` §6
- `lib/dates.ts`: dayKey/monthDayKey/startOfDay/addDays, dowLetter/dayNumber, dayLabel (Today/Yesterday/locale), groupEntriesByDay()
- Components: `CalendarStrip` (60 past/14 future, scrolls to selection, gold selected/today, grape entry dots; `todayMs` prop keeps render pure), `Recorder` (permission flow + record/stop + duration + 28-bar metering; stop persists clip + creates entry), `TranscribeButton` (WAV transcribe w/ progress; m4a renders an honest note)
- Tabs (Ionicons outline, gold active): Journal (strip + pills [New Entry/Today/On this day] + today's grape hero or mic empty state + selected-day list → detail), Record (Recorder + saved card → Open entry), Search (minimal FTS5 input + results; polish → Phase 5), Settings (model status/count/debug links; management → Phase 6)
- Detail route `app/entry/[id].tsx` (Stack push): dirty-gated Save, delete + back, clip player, TranscribeButton with onDone reload; missing id → not-found card
- Removed `app/(tabs)/two.tsx` + expo-symbols tab bar; typed routes keep every `router.push` compile-checked

Tested:
- `bun run typecheck` — clean (proves typed-route targets exist)
- `bun run lint` — clean (one `todayMs` snapshot pattern for react-hooks/purity; set-state-in-effect in focus callback not flagged)
- `bunx expo-doctor` — 21/21 passed (no new native deps)
- `bunx expo export --platform android` — Metro bundled OK (4.4 MB hbc), proves tabs + detail route bundle
- On-device nav NOT run in this env (no Android SDK) — on a dev build: Journal → tap dotted day → open entry → edit + Save → Record → stop → Open entry → Search word → Settings

Decisions:
- See `docs/DECISIONS.md` Phase 4 (vector-icons, single Journal screen, Stack detail, Recorder component, transcribe-on-detail, minimal search/settings, todayMs snapshot)

Known issues / next:
- No debounce/highlight in Search yet (Phase 5); no model download/clear/export in Settings yet (Phase 6)
- `record-debug`/`db-debug` still mounted as Stack routes (temporary; Settings links to them)
- Template `constants/Colors.ts` unused — delete in a later cleanup
- m4a transcode still pending — Record tab and detail screen never promise STT for m4a

## Phase 3 — Whisper.rn Integration (2026-09-27)

Added:
- whisper.rn `0.7.4` (`bunx expo install`) + `buffer` polyfill (`bun add buffer` — whisper.rn needs `require('buffer')`) + expo-file-system `~57.0.7` (new `Paths`/`File` API); no config plugins, autolinked via prebuild
- Model: `ggml-tiny.en-q5_1.bin` (30.7 MB, gitignored) via `bun run model:download`; runtime path `document/models/` (`modelFileUri()`); only the 64 KB `assets/sample-16k.wav` tone fixture is `require()`d
- Pipeline (`lib/whisper.ts`): lazy `initWhisper` singleton, `transcribeAudioFile()` (WAV gate, <0.8 s guard, `language: 'en'`, `onProgress`) → `{text, segments, modelLoadMs, transcriptionMs}`; typed `WhisperError` (`native-unavailable`/`model-missing`/`model-load-failed`/`unsupported-format`/`empty-audio`/`transcription-failed`)
- Store (`store/useTranscriptionStore.ts`): status machine + progress + outcome + benchmark log (last 20, also `console.log`); success rewrites entry transcript + title (FTS re-indexes free)
- record-debug: Whisper model card (present/missing + `adb push` hint), per-clip Transcribe (WAV only; m4a shows conversion note), sample-WAV smoke test, result panel with timings, benchmark log header
- Metro `assetExts.push('bin','wav')`; `tsconfig paths` shim for whisper.rn missing `exports "."` (types-only; Metro uses main/react-native at runtime); `assets.d.ts` for `*.wav`

Tested:
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bunx expo-doctor` — 21/21 passed
- `bunx expo export --platform android` — Metro bundled OK (4.0 MB hbc; sample WAV hashed asset included), proves whisper.rn JS + fixture bundle (native linking proven only by a dev build)
- On-device STT NOT run in this env (no Android SDK) — on a dev build (`bunx expo run:android`, `adb push assets/models/ggml-tiny.en-q5_1.bin <document/models/>`, then `bun run start`): open `/record-debug` → Recheck model → Transcribe sample WAV → see timings → (WAV journal clips transcribe; m4a clips correctly gated)

Decisions:
- See `docs/DECISIONS.md` Phase 3 (0.7.4 stable, tiny.en q5_1, document/models over bundling, WAV gate + parked MediaCodec transcode, lazy import + error codes, tone fixture, entry rewrite)

Known issues / next:
- No on-device transcode yet — m4a recordings play back but cannot transcribe; highest-risk follow-up (MediaCodec helper or revisit recording format), must be resolved before Phase 4 Record tab promises transcription
- Native `.so` linking (whisper.cpp) unproven until first `expo run:android` build — if autolink fails, capture the fix in ARCHITECTURE.md Phase 3 notes
- Real transcription UI (Record tab) + Search over transcripts land in Phase 4–5; model download UX in Phase 6

## Phase 2 — Audio Recording (2026-09-27)

Added:
- expo-audio `~57.0.5` (+ expo-asset `~57.0.18` peer) via `bunx expo install`; plugins in `app.json` with explicit mic message, background playback/recording OFF
- Voice preset (`lib/audio.ts`): 16 kHz mono m4a 32 kbps, `directory: 'document'`, `isMeteringEnabled: true`; `get/requestMicPermission()`, `meteringToLevel()`
- Debug screen (`app/record-debug.tsx`, Stack not tab): mic permission flow (undetermined → ask, denied → Open Settings + Ask-again), record/stop mic button with live duration + 28-bar metering waveform, stop auto-creates an entry (`audio_path` + `duration_ms`, placeholder transcript), playback of saved clip + saved-clips list (`useAudioPlayer` per uri)
- Home links to `/record-debug`; `db-debug` cross-links to Record
- Docs: audio flow + Phase 2 native-module notes in `ARCHITECTURE.md`, Phase 2 rows in `DECISIONS.md`

Tested:
- `bun run typecheck` — clean
- `bun run lint` — clean (one `set-state-in-effect` disable for metering history sync — same rationale as template pattern)
- `bunx expo-doctor` — 21/21 passed (needed `expo-asset` peer for expo-audio)
- `bunx expo export --platform android` — Metro bundled OK (3.9 MB hbc), proves recorder + player hooks bundle
- On-device record/playback NOT run in this env (no Android SDK) — open `/record-debug` on a dev build (`bunx expo run:android`, then `bun run start`): Allow mic → Tap record → speak → Stop → entry saved → Play clip → kill + relaunch → clip still plays

Decisions:
- See `docs/DECISIONS.md` Phase 2 (expo-audio over expo-av, 16 kHz mono preset, document dir, metering waveform, stop-auto-saves, Stack debug route)

Known issues / next:
- No transcription yet (Phase 3); audio entries carry `'(audio only — transcription lands in Phase 3)'` placeholder
- Deleting an entry orphans its `.m4a` file (no FileSystem cleanup yet) — full cleanup lands with Settings “clear all data” (Phase 6)
- Real Record tab + Journal UI land in Phase 4; `record-debug`/`db-debug` are temporary

## Phase 1 — Data Layer (2026-09-27)

Added:
- expo-sqlite `~57.0.3` (`bunx expo install expo-sqlite`; auto-added `expo-sqlite` plugin to `app.json`, default `enableFTS: true`) + zustand `^5.0.15` (`bun add zustand`, pure JS)
- SQLite schema v1 (`db/client.ts`): `entries(id, title, transcript, audio_path, duration_ms, created_at, updated_at)`, `PRAGMA user_version = 1`, WAL + FK, `idx_entries_created_at`; FTS5 `entries_fts` + `entries_ai/ad/au` triggers
- Repo layer (`db/entriesRepo.ts`, `db/types.ts`, `db/index.ts`): create/get/list/range/update/delete/count/clear/search — all take `db: SQLiteDatabase`, all params bound, no SQL in components
- `searchEntries()`: FTS5 `MATCH` (`"token"*` prefix, `bm25` rank, LIMIT 50) with LIKE fallback on syntax error
- Pure helpers (`lib/entries.ts`): `titleFromTranscript()`, `formatDuration()`, `formatEntryDate()`
- Zustand store (`store/useEntriesStore.ts`): entries/totalCount/loading/error + refresh/create/update/remove/search (db passed per action)
- Root `SQLiteProvider` (`echojournal.db`, `onInit={migrateDbIfNeeded}`) in `app/_layout.tsx`
- Debug screen (`app/db-debug.tsx`, Stack not tab): add dummy, edit title, delete, clear all, FTS5 search box, FlatList; linked from Home via `Link href="/db-debug"`
- Docs: schema + repo API in `ARCHITECTURE.md`, Phase 1 rows in `DECISIONS.md`

Tested:
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bunx expo-doctor` — 21/21 passed (native deps changed)
- `bunx expo export --platform android` — Metro bundled OK (3.8 MB hbc), proves provider + debug route bundle
- On-device CRUD NOT run in this env (no Android SDK) — open `/db-debug` on a dev build (`bunx expo run:android`, then `bun run start`): Add dummy → appears in list → Edit title → Search "sunshine" → Delete → Clear all

Decisions:
- See `docs/DECISIONS.md` Phase 1 (provider+hook, user_version migrations, INTEGER ms timestamps, FTS5+triggers, thin repo, zustand-takes-db, Stack debug route)

Known issues / next:
- No audio/transcription yet (Phase 2–3); `audio_path` NULL and `durationMs` 0 in dummies
- `listEntriesByRange` unused until Phase 4 calendar strip; `searchEntries` repo-ready but full Search UI lands Phase 5
- Debug screen is temporary — real Journal list/detail UI lands Phase 4

## Phase 0 — Project Setup & Docs Scaffold (2026-09-27)

Added:
- Expo SDK 57 + TypeScript (strict) scaffold via tabs template, converted to Bun (`bun.lock`, `bun install` clean)
- expo-dev-client `~57.0.19` (custom dev client ready; Expo Go will NOT work for whisper.rn later)
- expo-router file-based routing (`/app`); root Stack + (tabs) Home/Placeholder
- NativeWind v4 + Tailwind v3: `tailwind.config.js`, `babel.config.js`, `metro.config.js` (withNativeWind), `global.css`, `nativewind-env.d.ts`, `css.d.ts`
- `@expo/vector-icons@15.1.1` installed (tab redesign to vector-icons lands Phase 4)
- Folder structure: `/app`, `/components`, `/lib`, `/store`, `/db`, `/assets/models`, `/docs` (+ `.gitkeep` placeholders)
- `app.json`: EchoJournal, slug echojournal, `userInterfaceStyle: dark`, Android package `com.echojournal.app`
- Blank home screen (`app/(tabs)/index.tsx`): dark `#0D0D0F`, NativeWind, “Phase 0 — blank home”
- ESLint (flat, `eslint-config-expo`) + Prettier + `bun run lint/typecheck/format` scripts
- Docs: `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` (this file)

Tested:
- `bun install` clean (577 → 954 pkgs after devDeps/icons)
- `bun run typecheck` (`tsc --noEmit`) — clean
- `bun run lint` (`expo lint`) — clean after fixing 3 template errors (unescaped quotes, setState-in-effect)
- `bunx expo-doctor` — 21/21 checks passed (after removing `newArchEnabled`, pinning `@types/react ~19.2.2`, `eslint ^9`)
- `bunx expo export --platform android` — Metro bundled OK (1600 modules, 3.7 MB hbc), proves blank home boots

Decisions:
- See `docs/DECISIONS.md` Phase 0 (dev client early, NativeWind v4, tabs template, Bun, Android-only, sqlite+FTS5 plan, tiny.en q5 plan)

Known issues / next:
- No data/audio/transcription layers yet (Phase 1–3)
- Tabs still use `expo-symbols`; full Journal/Record/Search/Settings nav + dark design system land in Phase 4
- `assets/models/` empty; model binaries gitignored (Phase 3)
- Dev-client APK not built in this env (no Android SDK) — run `bunx expo run:android` locally or EAS cloud build to verify on device
