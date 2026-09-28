import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, Text, View } from 'react-native';

import { useTranscriptionStore } from '@/store/useTranscriptionStore';

interface TranscribeButtonProps {
  entryId: number;
  audioUri: string;
  audioMs: number;
  onDone: () => void;
}

/**
 * Entry-scoped transcription control. m4a clips auto-convert to 16 kHz mono
 * WAV on-device (MediaCodec, no ffmpeg) before whisper.rn runs — every clip
 * with audio is transcribable.
 */
export default function TranscribeButton({ entryId, audioUri, audioMs, onDone }: TranscribeButtonProps) {
  const db = useSQLiteContext();
  const status = useTranscriptionStore((s) => s.status);
  const progress = useTranscriptionStore((s) => s.progress);
  const activeEntryId = useTranscriptionStore((s) => s.activeEntryId);
  const errorCode = useTranscriptionStore((s) => s.errorCode);
  const errorMessage = useTranscriptionStore((s) => s.errorMessage);
  const transcribeEntry = useTranscriptionStore((s) => s.transcribeEntry);

  const busy = status === 'loading-model' || status === 'transcribing';
  const mine = activeEntryId === entryId;
  const failed = mine && (status === 'error' || status === 'model-missing');

  return (
    <View>
      <Pressable
        disabled={busy}
        onPress={() =>
          void transcribeEntry(db, entryId, audioUri, audioMs).then(() => {
            if (useTranscriptionStore.getState().status === 'done') {
              onDone();
            }
          })
        }
        className={`self-start rounded-full bg-grape px-5 py-2.5 ${busy ? 'opacity-50' : ''}`}>
        <Text className="text-caption font-bold text-paper">
          {mine && busy ? `Transcribing… ${progress}%` : 'Transcribe to text'}
        </Text>
      </Pressable>
      {mine && busy ? (
        <View className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-edge">
          <View className="h-full bg-grape" style={{ width: `${progress}%` }} />
        </View>
      ) : null}
      {failed ? (
        <Text className="mt-2 text-caption text-ember">
          [{errorCode}] {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
