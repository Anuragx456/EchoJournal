import * as Linking from 'expo-linking';
import { useSQLiteContext } from 'expo-sqlite';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { formatDuration, formatEntryDate } from '@/lib/entries';
import {
  VOICE_RECORDING_OPTIONS,
  getMicPermission,
  meteringToLevel,
  requestMicPermission,
  type MicPermission,
} from '@/lib/audio';
import {
  WhisperError,
  modelDisplayName,
  modelFileUri,
  transcribeAudioFile,
  type TranscriptionOutcome,
} from '@/lib/whisper';
import { useEntriesStore } from '@/store/useEntriesStore';
import { useTranscriptionStore } from '@/store/useTranscriptionStore';

const MAX_BARS = 28;
// 16 kHz mono 16-bit pipeline fixture (2 s tone — validates model load +
// file→text plumbing on-device; NOT a speech-accuracy test).
const SAMPLE_WAV = require('../assets/sample-16k.wav') as number;

function PlaybackButton({ uri, label }: { uri: string; label: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <View className="mt-2 flex-row items-center gap-2">
      <Pressable
        className="rounded-full bg-[#2A2A30] px-4 py-2"
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            if (status.currentTime >= status.duration && status.duration > 0) {
              void player.seekTo(0);
            }
            player.play();
          }
        }}>
        <Text className="text-xs font-semibold text-white">
          {status.playing ? 'Pause' : 'Play'} {label}
        </Text>
      </Pressable>
      <Text className="text-[11px] text-neutral-500">
        {formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}
      </Text>
    </View>
  );
}

export default function RecordDebugScreen() {
  const db = useSQLiteContext();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const { entries, loading, error, refresh, create } = useEntriesStore();
  const {
    status: txStatus,
    progress: txProgress,
    modelReady,
    activeEntryId,
    outcome: txOutcome,
    errorCode: txErrorCode,
    errorMessage: txErrorMessage,
    log: txLog,
    checkModel,
    transcribeEntry,
    reset: resetTx,
  } = useTranscriptionStore();

  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>([]);
  const [lastSaved, setLastSaved] = useState<{ id: number; uri: string } | null>(null);
  const [sampleState, setSampleState] = useState<
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; outcome: TranscriptionOutcome }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  useEffect(() => {
    void refresh(db);
    void checkModel();
    void (async () => {
      try {
        setPermission(await getMicPermission());
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        // Audio mode is best-effort on web; recording screen targets Android.
      }
    })();
  }, [db, refresh, checkModel]);

  useEffect(() => {
    if (recorderState.isRecording) {
      // Syncing external recorder metering (polled by useAudioRecorderState) into
      // waveform history — intentional subscription to native state.
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

  const handleStart = async () => {
    setActionError(null);
    if (!(await ensurePermission())) {
      return;
    }
    setBusy(true);
    try {
      setBars([]);
      setLastSaved(null);
      resetTx();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not start recording');
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setActionError(null);
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
        setActionError('Recording stopped but no file URI was produced');
        return;
      }
      const entry = await create(db, {
        title: `Voice note ${formatEntryDate(Date.now())}`,
        transcript: '(recorded — tap Transcribe below)',
        audioPath: uri,
        durationMs,
      });
      setLastSaved({ id: entry.id, uri });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not stop recording');
    } finally {
      setBusy(false);
    }
  };

  const handleSample = async () => {
    setSampleState({ kind: 'working' });
    try {
      const outcome = await transcribeAudioFile(SAMPLE_WAV, { language: 'en', audioMs: 2000 });
      console.log(
        `[whisper] sample transcriptionMs=${outcome.transcriptionMs} ` +
          `modelLoadMs=${outcome.modelLoadMs} chars=${outcome.text.length}`
      );
      setSampleState({ kind: 'done', outcome });
    } catch (e) {
      setSampleState({
        kind: 'error',
        message: e instanceof WhisperError ? `[${e.code}] ${e.message}` : String(e),
      });
    }
  };

  const audioEntries = entries.filter((e) => e.audioPath);
  const isRecording = recorderState.isRecording;
  const txBusy = txStatus === 'loading-model' || txStatus === 'transcribing';

  return (
    <View className="flex-1 bg-[#0D0D0F] px-4 pt-12">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-white">Record + Transcribe — Phase 3</Text>
        <Link href="/" asChild>
          <Pressable className="rounded-full bg-[#2A2A30] px-4 py-2">
            <Text className="text-xs font-semibold text-white">Home</Text>
          </Pressable>
        </Link>
      </View>

      <Text className="mt-1 text-xs text-neutral-400">
        Mic: {permission}
        {loading ? ' • loading entries…' : ` • ${audioEntries.length} clips saved`}
      </Text>
      {error ? <Text className="mt-1 text-xs text-red-400">DB error: {error}</Text> : null}
      {actionError ? (
        <Text className="mt-1 text-xs text-red-400">Audio error: {actionError}</Text>
      ) : null}

      {permission === 'denied' && !isRecording ? (
        <View className="mt-4 rounded-2xl bg-[#2A1D1D] p-4">
          <Text className="text-sm font-semibold text-white">Microphone access denied</Text>
          <Text className="mt-1 text-xs text-neutral-300">
            EchoJournal needs the mic to record voice notes. Allow it in system settings, then come
            back and try again.
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              className="rounded-full bg-[#4C6FFF] px-4 py-2"
              onPress={() => void Linking.openSettings()}>
              <Text className="text-xs font-semibold text-white">Open Settings</Text>
            </Pressable>
            <Pressable
              className="rounded-full bg-[#2A2A30] px-4 py-2"
              onPress={() => void ensurePermission()}>
              <Text className="text-xs font-semibold text-white">Ask again</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="mt-3 rounded-2xl bg-[#17171A] p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-white">
            Whisper model: {modelDisplayName()}
          </Text>
          <Pressable
            className="rounded-full bg-[#2A2A30] px-3 py-1.5"
            onPress={() => void checkModel()}>
            <Text className="text-[11px] font-semibold text-white">Recheck</Text>
          </Pressable>
        </View>
        <Text className="mt-1 text-[11px] text-neutral-400">
          {modelReady === null || txStatus === 'checking-model'
            ? 'Checking document/models/…'
            : modelReady
              ? 'Model file present — ready to transcribe.'
              : 'Model file MISSING — transcription will report model-missing.'}
        </Text>
        {!modelReady && txStatus !== 'checking-model' ? (
          <Text className="mt-1 text-[11px] text-amber-300">
            Push the model with: adb push assets/models/ggml-tiny.en-q5_1.bin {modelFileUri()}
          </Text>
        ) : null}
        <View className="mt-3 flex-row gap-2">
          <Pressable
            disabled={sampleState.kind === 'working'}
            className={`rounded-full bg-[#2A2A30] px-4 py-2 ${sampleState.kind === 'working' ? 'opacity-50' : ''}`}
            onPress={() => void handleSample()}>
            <Text className="text-xs font-semibold text-white">
              {sampleState.kind === 'working' ? 'Transcribing…' : 'Transcribe sample WAV'}
            </Text>
          </Pressable>
        </View>
        {sampleState.kind === 'done' ? (
          <Text className="mt-2 text-[11px] text-green-300">
            Sample → “{sampleState.outcome.text || '(empty)'}” • load{' '}
            {sampleState.outcome.modelLoadMs} ms • transcribe{' '}
            {sampleState.outcome.transcriptionMs} ms
          </Text>
        ) : null}
        {sampleState.kind === 'error' ? (
          <Text className="mt-2 text-[11px] text-red-400">Sample failed: {sampleState.message}</Text>
        ) : null}
      </View>

      <View className="mt-4 items-center rounded-2xl bg-[#17171A] p-5">
        <Text className="text-4xl font-bold text-white tabular-nums">
          {formatDuration(recorderState.durationMillis)}
        </Text>
        <Text className="mt-1 text-xs text-neutral-400">
          {isRecording ? 'Recording… tap stop to save' : 'Idle — 16 kHz mono, saved to documents'}
        </Text>

        <View className="mt-4 h-12 flex-row items-end justify-center gap-1">
          {bars.length === 0 ? (
            <View
              className={`h-2 w-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-neutral-600'}`}
            />
          ) : (
            bars.map((level, i) => (
              <View
                key={i}
                className="w-1.5 rounded-full bg-red-400"
                style={{ height: 4 + level * 40 }}
              />
            ))
          )}
        </View>

        <Pressable
          disabled={busy}
          onPress={() => void (isRecording ? handleStop() : handleStart())}
          className={`mt-5 h-20 w-20 items-center justify-center rounded-full ${
            isRecording ? 'bg-red-500' : 'bg-[#4C6FFF]'
          } ${busy ? 'opacity-50' : ''}`}>
          <View
            className={
              isRecording ? 'h-6 w-6 rounded-sm bg-white' : 'h-6 w-6 rounded-full bg-white'
            }
          />
        </Pressable>
        <Text className="mt-2 text-xs text-neutral-400">
          {isRecording ? 'Stop & save entry' : 'Tap to record'}
        </Text>
      </View>

      {lastSaved ? (
        <View className="mt-3 rounded-2xl bg-[#1A2A1A] p-4">
          <Text className="text-xs text-green-300">
            Saved clip as entry #{lastSaved.id} — persists across restarts.
          </Text>
          <PlaybackButton uri={lastSaved.uri} label="saved clip" />
        </View>
      ) : null}

      {txStatus !== 'idle' ? (
        <View className="mt-3 rounded-2xl bg-[#1A1A2E] p-4">
          <Text className="text-xs font-bold text-white">
            Transcription: {txStatus}
            {activeEntryId ? ` (entry #${activeEntryId})` : ''}
            {txBusy ? ` — ${txProgress}%` : ''}
          </Text>
          {txBusy ? (
            <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2A2A30]">
              <View className="h-full bg-[#4C6FFF]" style={{ width: `${txProgress}%` }} />
            </View>
          ) : null}
          {txStatus === 'done' && txOutcome ? (
            <Text className="mt-2 text-xs text-neutral-200">
              “{txOutcome.text}” • {txOutcome.segments.length} segments • lang{' '}
              {txOutcome.language} • load {txOutcome.modelLoadMs} ms • transcribe{' '}
              {txOutcome.transcriptionMs} ms
            </Text>
          ) : null}
          {txErrorCode ? (
            <Text className="mt-2 text-xs text-red-400">
              [{txErrorCode}] {txErrorMessage}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="mb-2 mt-4 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-white">Saved clips</Text>
        {txLog.length > 0 ? (
          <Text className="text-[11px] text-neutral-500">
            Last: {txLog[0].transcriptionMs} ms for {(txLog[0].audioMs / 1000).toFixed(1)} s audio
          </Text>
        ) : null}
      </View>
      <FlatList
        data={audioEntries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text className="text-xs text-neutral-500">
            No recordings yet. Record above — stopping saves the file and a DB entry.
          </Text>
        }
        renderItem={({ item }) => {
          const active = txBusy && activeEntryId === item.id;
          return (
            <View className="mb-3 rounded-2xl bg-[#17171A] p-4">
              <Text className="text-sm font-bold text-white">
                #{item.id} — {item.title}
              </Text>
              <Text className="mt-1 text-xs text-neutral-300" numberOfLines={4}>
                {item.transcript}
              </Text>
              <Text className="mt-1 text-[11px] text-neutral-500">
                {formatDuration(item.durationMs)} • {formatEntryDate(item.createdAt)}
              </Text>
              {item.audioPath ? (
                <PlaybackButton uri={item.audioPath} label={`#${item.id}`} />
              ) : null}
              <View className="mt-2">
                {item.audioPath ? (
                  <Pressable
                    disabled={txBusy}
                    className={`self-start rounded-full bg-[#4C6FFF] px-4 py-2 ${active || txBusy ? 'opacity-50' : ''}`}
                    onPress={() =>
                      item.audioPath
                        ? void transcribeEntry(db, item.id, item.audioPath, item.durationMs)
                        : null
                    }>
                    <Text className="text-xs font-semibold text-white">
                      {active
                        ? `Transcribing… ${txProgress}%`
                        : 'Transcribe to text (m4a auto-converts)'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="text-[11px] text-neutral-500">
                    No audio clip on this entry.
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
