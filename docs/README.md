# EchoJournal — Offline Voice Journal App

EchoJournal lets users speak about their day and get it transcribed into text journal
entries — fully offline. Speech-to-text runs on-device via `whisper.rn`
(whisper.cpp bindings). No cloud calls for transcription.

- Framework: React Native + Expo SDK 57, custom dev client (whisper.rn needs native modules — Expo Go will NOT work)
- Package manager: Bun
- Language: TypeScript (strict)
- Navigation: expo-router (`/app` directory)
- State: zustand
- Storage: expo-sqlite for entries (`echojournal.db`, FTS5); AsyncStorage not used
- Audio: expo-audio, 16 kHz mono voice preset
- Transcription: whisper.rn 0.7.4, tiny.en q5_1 (30.7 MB, on-device) + expo-video-audio-extractor (m4a→WAV, MediaCodec); every recording auto-transcribes on stop when the model is present
- Styling: NativeWind v4 + Tailwind CSS v3
- Icons: @expo/vector-icons (Ionicons outline)
- Sharing: expo-sharing (journal export)
- Target: Android only (mid-range devices)

Full setup, architecture, decisions, and changelog live in `/docs`:

- `docs/README.md` — this file (setup, dev client, scripts)
- `docs/ARCHITECTURE.md` — folder structure, data flow, native-module notes
- `docs/DECISIONS.md` — tradeoff log (tiny vs base model, bundled vs downloaded, etc.)
- `docs/CHANGELOG.md` — per-phase entries

## Prerequisites

- Bun 1.3+, Node 22+, Android SDK / Android Studio for local builds
- Android device or emulator (mid-range target)
- No Xcode needed (Android-only)

## Quick start (dev client)

```bash
# install
bun install

# fetch the (gitignored) whisper model for local dev
bun run model:download

# start Metro for dev-client
bun run start
# scan QR with your dev build, or:
# bun run android   -> builds + runs dev client via expo run:android (needs Android SDK)

# lint / typecheck (run before declaring any phase done)
bun run lint
bun run typecheck
```

`bun run start` uses `expo start --dev-client`. Expo Go will NOT work because
whisper.rn needs native modules.

## Building a dev client (Android)

Local build (needs Android SDK):

```bash
bunx expo run:android
```

Cloud build via EAS (no local SDK needed):

```bash
bunx eas-cli@latest build --profile development --platform android
```

Install the resulting APK on your device, then `bun run start` and scan/connect.

First launch shows the Journal tab (calendar strip + today's hero). Add (talk or write
from 5 templates), Search and Settings tabs round out the nav; `/record-debug` and `/db-debug` stay mounted as
temporary Stack routes (linked from Settings).

## First launch (model)

Transcription needs `ggml-tiny.en-q5_1.bin` (30.7 MB) in the app's
`document/models/` directory. On a fresh install the Journal shows a dismissible
banner linking to Settings:

- Settings → Download model (WiFi-confirm dialog, live progress) — or push it
  manually: `adb push assets/models/ggml-tiny.en-q5_1.bin <document>/models/`
  (Settings prints the exact target path).
- Journaling (record/play/search) works fully without the model; only
  Transcribe needs it.

## Project structure

```
/app            expo-router screens (_layout.tsx, (tabs)/, entry/[id], modal, +not-found)
/components     CalendarStrip, Recorder, TranscribeButton (+ template leftovers)
/lib            entries + audio helpers (title/duration/date, voice preset, mic permission)
/store          useEntriesStore + useTranscriptionStore (status machine + benchmark log)
/db             expo-sqlite schema v1 + entriesRepo (CRUD + FTS5 search)
/assets/models  whisper ggml models — gitignored binaries (tiny.en q5_1, 30.7 MB)
/assets         sample-16k.wav pipeline fixture (committed, 64 KB)
/docs           README, ARCHITECTURE, CHANGELOG, DECISIONS
```

See `docs/ARCHITECTURE.md` for data flow and conventions.

## Scripts

| Script | Purpose |
|---|---|
| `bun run start` | Metro for dev-client |
| `bun run android` | `expo run:android` local dev-client build+run |
| `bun run lint` | `expo lint` |
| `bun run typecheck` | `tsc --noEmit` (strict) |
| `bun run format` | Prettier write |
| `bun run model:download` | Fetch tiny.en q5_1 model into assets/models (gitignored) |

## Whisper model (Phase 3)

Default: `ggml-tiny.en-q5_1.bin` — 30.7 MB, English-only, on-device.

| Option | Size | Note |
|---|---|---|
| tiny.en f16 | ~75 MB | 2.4x bigger, marginally better accuracy — not worth it on mid-range |
| **tiny.en q5_1 (chosen)** | **30.7 MB** | best size/accuracy for offline journaling |
| tiny.en q8_0 | ~78 MB | near-f16 quality, 2.5x the size of q5_1 — no |
| base.en q5 | ~110 MB | step up only if tiny accuracy disappoints (benchmark log decides) |

- Model is NEVER committed (`assets/models/*.bin` gitignored). Fetch with
  `bun run model:download`, then push to the device:
  `adb push assets/models/ggml-tiny.en-q5_1.bin <document>/models/`
  (the record-debug screen prints the exact target path).
- Runtime reads ONLY `document/models/` — Metro never statically requires the
  binary, so a missing local copy cannot break anyone else's bundle.
- Full download-on-first-launch UX (progress UI, WiFi prompt) lands in Phase 6.
- Input MUST be 16 kHz mono WAV — whisper.cpp cannot decode m4a/AAC. Recordings
  stay m4a until an on-device transcode step lands (see DECISIONS.md Phase 3).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red screen `native-unavailable` on Transcribe | Stale build without whisper.rn — rebuild: `bunx expo run:android` |
| `model-missing` on Transcribe | No model in `document/models/` — Settings → Download, or `adb push` |
| `unsupported-format` on Transcribe | m4a clip — whisper.rn decodes WAV only; transcode pending (DECISIONS.md Phase 3) |
| `expo-doctor` peer error after `bun add` | Native deps must come from `bunx expo install` (SDK-pinned); `zustand`/`buffer` are the pure-JS exceptions |
| Metro `Unable to resolve module buffer` | `bun add buffer` (whisper.rn → safe-buffer → buffer) |
| TS `Cannot find module 'whisper.rn'` | tsconfig `paths` shim (package exports lack `.`); runtime unaffected |
| Mic stays `denied` | System-level denial — Open Settings from the Recorder/Record denied card |

## Status

Phase 7 complete: every recording auto-transcribes to text on stop (m4a→WAV
on-device via MediaCodec, then whisper). Audio-only entries only when the model
is missing. See `docs/CHANGELOG.md` for per-phase history.
