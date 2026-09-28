import { AudioModule, RecordingPresets, type RecordingOptions } from 'expo-audio';

export type MicPermission = 'undetermined' | 'granted' | 'denied';

/**
 * Voice-optimized preset for journaling: 16 kHz mono AAC.
 * Smaller files + faster on-device transcription than HIGH_QUALITY
 * (44.1 kHz stereo), still fully intelligible for playback.
 * See docs/DECISIONS.md Phase 2.
 */
export const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
  },
  // Persist outside the cache dir so recordings survive restarts
  // and OS storage pressure. Whisper (Phase 3) reads the same file.
  directory: 'document',
  isMeteringEnabled: true,
};

export async function getMicPermission(): Promise<MicPermission> {
  const { status } = await AudioModule.getRecordingPermissionsAsync();
  return status;
}

export async function requestMicPermission(): Promise<MicPermission> {
  const { status } = await AudioModule.requestRecordingPermissionsAsync();
  return status;
}

/** Normalize a dB metering value (~-160..0) to 0..1 for waveform bars. */
export function meteringToLevel(metering: number | undefined): number {
  if (metering === undefined || !Number.isFinite(metering)) {
    return 0;
  }
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}
