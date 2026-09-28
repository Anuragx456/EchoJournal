import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import { titleFromTranscript } from '@/lib/entries';
import {
  WHISPER_MODEL_FILENAME,
  WHISPER_MODEL_SIZE_MB,
  WHISPER_MODEL_URL,
  WhisperError,
  ensureModelDir,
  isModelPresent,
  isWavUri,
  modelDisplayName,
  releaseWhisper,
  transcribeAudioFile,
  type TranscriptionOutcome,
} from '@/lib/whisper';
import { transcodeToWav } from '@/lib/transcode';
import { updateEntry } from '@/db';

export type TranscriptionStatus =
  | 'idle'
  | 'checking-model'
  | 'model-missing'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error';

export type ModelDownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

export interface BenchmarkLog {
  entryId: number;
  audioMs: number;
  modelLoadMs: number;
  transcriptionMs: number;
  chars: number;
  at: number;
}

interface TranscriptionState {
  status: TranscriptionStatus;
  progress: number;
  modelReady: boolean | null;
  activeEntryId: number | null;
  outcome: TranscriptionOutcome | null;
  errorCode: string | null;
  errorMessage: string | null;
  log: BenchmarkLog[];
  downloadStatus: ModelDownloadStatus;
  downloadProgress: number;
  downloadError: string | null;
  checkModel: () => Promise<void>;
  transcribeEntry: (
    db: SQLiteDatabase,
    entryId: number,
    audioUri: string | number,
    audioMs: number
  ) => Promise<void>;
  startModelDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
  reset: () => void;
}

function modelDestFile(): File {
  return new File(new Directory(Paths.document, 'models'), WHISPER_MODEL_FILENAME);
}

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  status: 'idle',
  progress: 0,
  modelReady: null,
  activeEntryId: null,
  outcome: null,
  errorCode: null,
  errorMessage: null,
  log: [],
  downloadStatus: 'idle',
  downloadProgress: 0,
  downloadError: null,

  checkModel: async () => {
    set({ status: 'checking-model', errorCode: null, errorMessage: null });
    const present = isModelPresent();
    set({ modelReady: present, status: present ? 'idle' : 'model-missing' });
  },

  transcribeEntry: async (db, entryId, audioUri, audioMs) => {
    const { status } = get();
    if (status === 'loading-model' || status === 'transcribing') {
      return;
    }
    set({
      status: 'loading-model',
      progress: 0,
      activeEntryId: entryId,
      outcome: null,
      errorCode: null,
      errorMessage: null,
    });
    try {
      const present = isModelPresent();
      set({ modelReady: present });
      if (!present) {
        set({ status: 'model-missing' });
        return;
      }
      set({ status: 'transcribing' });
      // Compressed clips (m4a from expo-audio) decode to 16 kHz mono WAV
      // on-device first — whisper.rn never sees compressed audio.
      let inputUri = audioUri;
      if (typeof audioUri === 'string' && !isWavUri(audioUri)) {
        try {
          inputUri = await transcodeToWav(audioUri, `entry-${entryId}`);
        } catch (e) {
          throw new WhisperError(
            'transcription-failed',
            `Could not convert clip to WAV: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
      const outcome = await transcribeAudioFile(inputUri, {
        language: 'en',
        audioMs,
        onProgress: (progress) => set({ progress }),
      });
      const text = outcome.text.length > 0 ? outcome.text : '(no speech detected)';
      await updateEntry(db, entryId, {
        transcript: text,
        title: titleFromTranscript(text),
        // Self-heal: early Phase 7 builds saved duration_ms=0 (post-stop read).
        durationMs: outcome.audioMs,
      });
      // Benchmark log for on-device runs (spec: transcription time logged).
      console.log(
        `[whisper] entry=${entryId} audioMs=${audioMs} ` +
          `modelLoadMs=${outcome.modelLoadMs} transcriptionMs=${outcome.transcriptionMs} ` +
          `chars=${text.length} model=${modelDisplayName()}`
      );
      set((state) => ({
        status: 'done',
        progress: 100,
        outcome,
        log: [
          {
            entryId,
            audioMs,
            modelLoadMs: outcome.modelLoadMs,
            transcriptionMs: outcome.transcriptionMs,
            chars: text.length,
            at: Date.now(),
          },
          ...state.log,
        ].slice(0, 20),
      }));
    } catch (e) {
      if (e instanceof WhisperError) {
        set({
          status: e.code === 'model-missing' ? 'model-missing' : 'error',
          errorCode: e.code,
          errorMessage: e.message,
        });
      } else {
        set({
          status: 'error',
          errorCode: 'transcription-failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    }
  },

  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      activeEntryId: null,
      outcome: null,
      errorCode: null,
      errorMessage: null,
    }),

  startModelDownload: async () => {
    const { downloadStatus } = get();
    if (downloadStatus === 'downloading') {
      return;
    }
    set({ downloadStatus: 'downloading', downloadProgress: 0, downloadError: null });
    try {
      await ensureModelDir();
      const dest = modelDestFile();
      if (dest.exists) {
        set({ downloadStatus: 'done', downloadProgress: 100 });
        await get().checkModel();
        return;
      }
      const task = File.createDownloadTask(WHISPER_MODEL_URL, dest, {
        onProgress: ({ bytesWritten, totalBytes }) =>
          set({
            downloadProgress:
              totalBytes > 0 ? Math.min(99, Math.round((bytesWritten / totalBytes) * 100)) : 0,
          }),
      });
      await task.downloadAsync();
      await get().checkModel();
      set({ downloadStatus: 'done', downloadProgress: 100 });
    } catch (e) {
      set({
        downloadStatus: 'error',
        downloadError: `Download failed (${WHISPER_MODEL_SIZE_MB} MB needed): ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },

  deleteModel: async () => {
    try {
      modelDestFile().delete();
    } catch {
      // Missing file is fine — the goal state is "no model".
    }
    await releaseWhisper();
    await get().checkModel();
    set({ downloadStatus: 'idle', downloadProgress: 0, downloadError: null });
  },
}));
