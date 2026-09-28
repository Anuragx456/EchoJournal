import { Directory, File, Paths } from 'expo-file-system';
import type { TranscribeResult, WhisperContext } from 'whisper.rn';

export const WHISPER_MODEL_FILENAME = 'ggml-tiny.en-q5_1.bin';
export const WHISPER_MODEL_SIZE_MB = 30.7;
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin';

export type WhisperErrorCode =
  | 'native-unavailable'
  | 'model-missing'
  | 'model-load-failed'
  | 'unsupported-format'
  | 'empty-audio'
  | 'transcription-failed';

export class WhisperError extends Error {
  readonly code: WhisperErrorCode;

  constructor(code: WhisperErrorCode, message: string) {
    super(message);
    this.name = 'WhisperError';
    this.code = code;
  }
}

export interface TranscriptionOutcome {
  text: string;
  segments: TranscribeResult['segments'];
  language: string;
  /** Wall-clock ms spent in initWhisper (0 when the context was already warm). */
  modelLoadMs: number;
  /** Wall-clock ms spent in transcribe(). The benchmark to log on-device. */
  transcriptionMs: number;
  /** Effective clip length in ms (measured from the WAV when metadata lies). */
  audioMs: number;
}

export interface TranscribeParams {
  language?: string;
  /** Known clip length in ms — guards against transcribing empty taps. */
  audioMs?: number;
  onProgress?: (progress: number) => void;
}

let contextPromise: Promise<{ context: WhisperContext; modelLoadMs: number }> | null = null;

export function modelDisplayName(): string {
  return `tiny.en q5_1 (${WHISPER_MODEL_SIZE_MB} MB)`;
}

function modelFile(): File {
  return new File(Paths.document, 'models', WHISPER_MODEL_FILENAME);
}

/** Absolute file:// URI where the model must live (document dir survives updates). */
export function modelFileUri(): string {
  return modelFile().uri;
}

export function isModelPresent(): boolean {
  try {
    return modelFile().exists;
  } catch {
    return false;
  }
}

/** Ensure document/models/ exists (Phase 6 download flow writes the model there). */
export async function ensureModelDir(): Promise<void> {
  const dir = new Directory(Paths.document, 'models');
  if (!dir.exists) {
    dir.create();
  }
}

export function isWavUri(uri: string | number): boolean {
  // Bundled asset IDs (require()) are assumed to be WAV fixtures (see ARCHITECTURE.md).
  if (typeof uri === 'number') {
    return true;
  }
  return uri.split('?')[0].toLowerCase().endsWith('.wav');
}

function isWav(uri: string | number): boolean {
  return isWavUri(uri);
}

/** Clips below this are truly empty taps — not worth a whisper job. */
const MIN_TRANSCRIBABLE_MS = 800;

/**
 * Measure a WAV file's real length from its byte size (16 kHz mono 16-bit
 * PCM = 32 000 bytes/sec + 44-byte header). Returns null when the file
 * cannot be stat'ed. Used as ground truth when caller metadata is 0 —
 * expo-audio resets durationMillis after stop(), so post-stop reads lie.
 */
function measureWavMs(uri: string): number | null {
  try {
    const size = new File(uri).info().size;
    if (size === undefined || size <= 44) {
      return 0;
    }
    return Math.max(0, Math.round(((size - 44) / 32000) * 1000));
  } catch {
    return null;
  }
}

async function getContext(): Promise<{ context: WhisperContext; modelLoadMs: number }> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const startedAt = Date.now();
      let rn: typeof import('whisper.rn');
      try {
        rn = await import('whisper.rn');
      } catch {
        throw new WhisperError(
          'native-unavailable',
          'whisper.rn native module is not available — rebuild the dev client (bunx expo run:android). Expo Go is not supported.'
        );
      }
      const file = modelFile();
      if (!file.exists) {
        throw new WhisperError(
          'model-missing',
          `Model not found at ${file.uri}. Push ${WHISPER_MODEL_FILENAME} there (adb push) or wait for the Phase 6 download flow.`
        );
      }
      try {
        const context = await rn.initWhisper({ filePath: file.uri });
        return { context, modelLoadMs: Date.now() - startedAt };
      } catch (e) {
        throw new WhisperError(
          'model-load-failed',
          `Could not load model: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })().catch((e) => {
      // Let the next call retry instead of caching a rejection forever.
      contextPromise = null;
      throw e;
    });
  }
  return contextPromise;
}

export async function transcribeAudioFile(
  audioUri: string | number,
  params: TranscribeParams = {}
): Promise<TranscriptionOutcome> {
  if (!isWav(audioUri)) {
    throw new WhisperError(
      'unsupported-format',
      'Only 16 kHz mono WAV can be transcribed — convert compressed formats (m4a/AAC/MP3) first (store.transcribeEntry does this on-device via MediaCodec).'
    );
  }
  // Caller metadata may be 0 (expo-audio resets durationMillis after stop),
  // so measure the file before believing a "too short" verdict.
  const measured = typeof audioUri === 'string' ? measureWavMs(audioUri) : null;
  const effectiveMs = Math.max(params.audioMs ?? 0, measured ?? 0);
  if (effectiveMs < MIN_TRANSCRIBABLE_MS) {
    throw new WhisperError(
      'empty-audio',
      'Clip is shorter than 0.8 s — nothing to transcribe. Record a longer note.'
    );
  }
  return transcribeWithContext(audioUri, params, effectiveMs);
}

async function transcribeWithContext(
  audioUri: string | number,
  params: TranscribeParams,
  effectiveMs: number
): Promise<TranscriptionOutcome> {
  const { context, modelLoadMs } = await getContext();
  const startedAt = Date.now();
  try {
    const { promise } = context.transcribe(audioUri, {
      language: params.language ?? 'en',
      onProgress: params.onProgress,
    });
    const result = await promise;
    return {
      text: result.result.trim(),
      segments: result.segments,
      language: result.language,
      modelLoadMs,
      transcriptionMs: Date.now() - startedAt,
      audioMs: effectiveMs,
    };
  } catch (e) {
    if (e instanceof WhisperError) {
      throw e;
    }
    throw new WhisperError(
      'transcription-failed',
      `Transcription failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export async function releaseWhisper(): Promise<void> {
  if (!contextPromise) {
    return;
  }
  try {
    const { context } = await contextPromise;
    await context.release();
  } catch {
    // Releasing is best-effort; a failed context will be re-created on next use.
  } finally {
    contextPromise = null;
  }
}
