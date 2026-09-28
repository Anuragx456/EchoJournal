import * as Linking from 'expo-linking';
import { useSQLiteContext } from 'expo-sqlite';
import {
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  VOICE_RECORDING_OPTIONS,
  getMicPermission,
  meteringToLevel,
  requestMicPermission,
  type MicPermission,
} from '@/lib/audio';
import { formatDuration, formatEntryDate } from '@/lib/entries';
import { useEntriesStore } from '@/store/useEntriesStore';

const MAX_BARS = 28;

interface SavedClip {
  id: number;
  uri: string;
  durationMs: number;
}

interface RecorderProps {
  onSaved: (clip: SavedClip) => void;
}

/**
 * Self-contained voice recorder: permission flow, record/stop, live duration
 * + metering waveform. On stop it persists the clip and creates a journal
 * entry, then reports the new entry id. The Record tab auto-transcribes the
 * saved clip when the whisper model is on-device.
 */
export default function Recorder({ onSaved }: RecorderProps) {
  const db = useSQLiteContext();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const create = useEntriesStore((s) => s.create);

  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setPermission(await getMicPermission());
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        // Best-effort on web; Recorder targets Android.
      }
    })();
  }, []);

  useEffect(() => {
    if (recorderState.isRecording) {
      // Intentional subscription of polled native metering into waveform history.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBars((prev) => [...prev.slice(-MAX_BARS + 1), meteringToLevel(recorderState.metering)]);
    }
  }, [recorderState.metering, recorderState.isRecording]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permission === 'granted') {
      return true;
    }
    const next = await requestMicPermission();
    setPermission(next);
    return next === 'granted';
  }, [permission]);

  const handleToggle = async () => {
    if (recorderState.isRecording) {
      setBusy(true);
      try {
        // Capture duration BEFORE stop(): expo-audio resets durationMillis
        // to 0 once stopped, so a post-stop read always reports an empty clip.
        const durationMs = Math.max(
          recorder.getStatus().durationMillis,
          recorderState.durationMillis
        );
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          setError('Recording stopped but no file was produced.');
          return;
        }
        const entry = await create(db, {
          title: `Voice note ${formatEntryDate(Date.now())}`,
          transcript: '',
          audioPath: uri,
          durationMs,
        });
        onSaved({ id: entry.id, uri, durationMs });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not stop recording.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setError(null);
    if (!(await ensurePermission())) {
      return;
    }
    setBusy(true);
    try {
      setBars([]);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
    } finally {
      setBusy(false);
    }
  };

  const isRecording = recorderState.isRecording;

  return (
    <View className="items-center rounded-card bg-card p-5">
      {permission === 'denied' && !isRecording ? (
        <View className="mb-4 w-full rounded-2xl bg-[#2A1D1D] p-4">
          <Text className="text-body font-bold text-paper">Microphone access denied</Text>
          <Text className="mt-1 text-caption text-mist">
            Allow the mic in system settings to record voice notes.
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              className="rounded-full bg-gold px-4 py-2"
              onPress={() => void Linking.openSettings()}>
              <Text className="text-caption font-bold text-ink">Open Settings</Text>
            </Pressable>
            <Pressable
              className="rounded-full bg-edge px-4 py-2"
              onPress={() => void ensurePermission()}>
              <Text className="text-caption font-bold text-paper">Ask again</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Text className="text-display text-paper tabular-nums">
        {formatDuration(recorderState.durationMillis)}
      </Text>
      <Text className="mt-1 text-caption text-faint">
        {isRecording ? 'Recording… tap stop to save' : '16 kHz mono • saved on stop'}
      </Text>

      <View className="mt-4 h-12 flex-row items-end justify-center gap-1">
        {bars.length === 0 ? (
          <View
            className={`h-2 w-2 rounded-full ${isRecording ? 'bg-ember' : 'bg-edge'}`}
          />
        ) : (
          bars.map((level, i) => (
            <View
              key={i}
              className="w-1.5 rounded-full bg-ember"
              style={{ height: 4 + level * 40 }}
            />
          ))
        )}
      </View>

      <Pressable
        disabled={busy}
        onPress={() => void handleToggle()}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        className={`mt-5 h-20 w-20 items-center justify-center rounded-full ${
          isRecording ? 'bg-ember' : 'bg-gold'
        } ${busy ? 'opacity-50' : ''}`}>
        <View
          className={isRecording ? 'h-6 w-6 rounded-sm bg-ink' : 'h-6 w-6 rounded-full bg-ink'}
        />
      </Pressable>

      {error ? <Text className="mt-3 text-caption text-ember">{error}</Text> : null}
    </View>
  );
}
