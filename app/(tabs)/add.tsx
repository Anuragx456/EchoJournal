import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Recorder from '@/components/Recorder';
import { formatEntryDate } from '@/lib/entries';
import { TEMPLATES, starterFor, type JournalTemplate } from '@/lib/templates';
import { useEntriesStore } from '@/store/useEntriesStore';
import { useTranscriptionStore } from '@/store/useTranscriptionStore';

interface SavedClip {
  id: number;
  uri: string;
  durationMs: number;
}

type Mode = 'talk' | 'write';

/**
 * Add tab: one place to journal — talk it out (record + auto-transcribe) or
 * write it down. Five templates provide speaking cues / starter prompts;
 * Free Flow is no-structure.
 */
export default function AddScreen() {
  const db = useSQLiteContext();
  const modelReady = useTranscriptionStore((s) => s.modelReady);
  const checkModel = useTranscriptionStore((s) => s.checkModel);
  const txStatus = useTranscriptionStore((s) => s.status);
  const txProgress = useTranscriptionStore((s) => s.progress);
  const txOutcome = useTranscriptionStore((s) => s.outcome);
  const txError = useTranscriptionStore((s) => s.errorMessage);
  const activeEntryId = useTranscriptionStore((s) => s.activeEntryId);
  const transcribeEntry = useTranscriptionStore((s) => s.transcribeEntry);
  const createEntry = useEntriesStore((s) => s.create);

  const [template, setTemplate] = useState<JournalTemplate>(TEMPLATES[0]);
  const [mode, setMode] = useState<Mode>('talk');
  const [todayMs, setTodayMs] = useState(() => Date.now());
  const [saved, setSaved] = useState<SavedClip | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  /** True once the user types — switching templates never wipes their words. */
  const [titleTouched, setTitleTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setTodayMs(Date.now());
      void checkModel();
    }, [checkModel])
  );

  const pickTemplate = (t: JournalTemplate) => {
    setTemplate(t);
    // Refill only untouched fields — never wipe words the user already wrote.
    if (!titleTouched) {
      setTitle(`${t.name} ${formatEntryDate(todayMs)}`);
    }
    if (!bodyTouched) {
      setBody(starterFor(t));
    }
  };

  const handleSaved = (clip: SavedClip) => {
    setSaved(clip);
    if (useTranscriptionStore.getState().modelReady) {
      void transcribeEntry(db, clip.id, clip.uri, clip.durationMs);
    }
  };

  const handleSaveWritten = async () => {
    const text = body.trim();
    if (text.length === 0 || saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const entry = await createEntry(db, {
        title:
          title.trim().length > 0
            ? title.trim()
            : `${template.name} ${formatEntryDate(todayMs)}`,
        transcript: text,
      });
      router.push(`/entry/${entry.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save entry.');
    } finally {
      setSaving(false);
    }
  };

  const mine = saved !== null && activeEntryId === saved.id;
  const transcribing = mine && (txStatus === 'loading-model' || txStatus === 'transcribing');
  const done = mine && txStatus === 'done' && txOutcome !== null;
  const failed = mine && txStatus === 'error';

  return (
    <ScrollView
      className="flex-1 bg-ink"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-12">
        <Text className="text-display text-paper">New Entry</Text>
        <Text className="mt-1 text-caption text-faint">
          Talk it out or write it down — saved on this device only.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        className="mt-4"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {TEMPLATES.map((t) => {
          const selected = t.id === template.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => pickTemplate(t)}
              accessibilityRole="button"
              accessibilityLabel={`${t.name} template`}
              accessibilityState={{ selected }}
              className={`w-36 rounded-card p-3 ${selected ? 'bg-[#2A2113]' : 'bg-card'}`}
              style={selected ? { borderWidth: 1, borderColor: '#E8A33D' } : undefined}>
              <Ionicons
                name={t.icon}
                size={20}
                color={selected ? '#E8A33D' : '#A7A7AE'}
              />
              <Text className="mt-2 text-caption font-bold text-paper" numberOfLines={1}>
                {t.name}
              </Text>
              <Text className="mt-1 text-micro text-faint" numberOfLines={2}>
                {t.tagline}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mx-5 mt-4 flex-row rounded-full bg-card p-1">
        <Pressable
          onPress={() => setMode('talk')}
          accessibilityRole="button"
          accessibilityLabel="Talk mode"
          accessibilityState={{ selected: mode === 'talk' }}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 ${mode === 'talk' ? 'bg-gold' : ''}`}>
          <Ionicons
            name="mic-outline"
            size={16}
            color={mode === 'talk' ? '#0D0D0F' : '#A7A7AE'}
          />
          <Text
            className={`text-caption font-bold ${mode === 'talk' ? 'text-ink' : 'text-mist'}`}>
            Talk
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('write')}
          accessibilityRole="button"
          accessibilityLabel="Write mode"
          accessibilityState={{ selected: mode === 'write' }}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 ${mode === 'write' ? 'bg-gold' : ''}`}>
          <Ionicons
            name="pencil-outline"
            size={16}
            color={mode === 'write' ? '#0D0D0F' : '#A7A7AE'}
          />
          <Text
            className={`text-caption font-bold ${mode === 'write' ? 'text-ink' : 'text-mist'}`}>
            Write
          </Text>
        </Pressable>
      </View>

      {mode === 'talk' ? (
        <View className="mt-4 px-5">
          {template.prompts.length > 0 ? (
            <View className="mb-3 rounded-card bg-card p-4">
              <Text className="text-micro uppercase tracking-widest text-gold">
                Talk through • {template.name}
              </Text>
              {template.prompts.map((p) => (
                <Text key={p} className="mt-1.5 text-caption text-mist">
                  • {p}
                </Text>
              ))}
            </View>
          ) : null}
          <Recorder onSaved={handleSaved} />
        </View>
      ) : (
        <View className="mt-4 px-5">
          <TextInput
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setTitleTouched(true);
            }}
            placeholder={`${template.name} ${formatEntryDate(todayMs)}`}
            placeholderTextColor="#6E6E76"
            className="rounded-card bg-card p-4 text-body font-bold text-paper"
          />
          <TextInput
            value={body}
            onChangeText={(t) => {
              setBody(t);
              setBodyTouched(true);
            }}
            placeholder="Start writing…"
            placeholderTextColor="#6E6E76"
            multiline
            textAlignVertical="top"
            className="mt-3 min-h-40 rounded-card bg-card p-4 text-body text-paper"
          />
          {saveError ? (
            <Text className="mt-2 text-caption text-ember">{saveError}</Text>
          ) : null}
          <Pressable
            disabled={body.trim().length === 0 || saving}
            accessibilityRole="button"
            accessibilityLabel="Save entry"
            accessibilityState={{ disabled: body.trim().length === 0 || saving }}
            onPress={() => void handleSaveWritten()}
            className={`mt-3 items-center rounded-full bg-gold py-3 ${body.trim().length === 0 || saving ? 'opacity-50' : ''}`}>
            <Text className="text-caption font-bold text-ink">
              {saving ? 'Saving…' : 'Save entry'}
            </Text>
          </Pressable>
        </View>
      )}

      {saved && mode === 'talk' ? (
        <View className="mx-5 mt-3 rounded-card bg-[#14231B] p-4">
          {transcribing ? (
            <View>
              <Text className="text-caption font-bold text-paper">
                Transcribing… {txProgress}%
              </Text>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge">
                <View className="h-full bg-gold" style={{ width: `${txProgress}%` }} />
              </View>
            </View>
          ) : done && txOutcome ? (
            <Text className="text-caption text-moss" numberOfLines={4}>
              “{txOutcome.text}” — saved as entry #{saved.id}.
            </Text>
          ) : failed ? (
            <Text className="text-caption text-ember">
              Saved audio, but transcription failed: {txError} Open the entry to retry.
            </Text>
          ) : (
            <Text className="text-caption text-moss">
              Saved as entry #{saved.id}
              {modelReady === false
                ? ' (audio only — download the model in Settings to transcribe).'
                : modelReady === null
                  ? '.'
                  : ' — transcribing…'}
            </Text>
          )}
          <View className="mt-3 flex-row gap-2">
            <Pressable
              className="rounded-full bg-gold px-4 py-2.5"
              onPress={() => router.push(`/entry/${saved.id}`)}>
              <Text className="text-caption font-bold text-ink">Open entry</Text>
            </Pressable>
            <Pressable
              className="rounded-full bg-card px-4 py-2.5"
              onPress={() => setSaved(null)}>
              <Text className="text-caption font-bold text-paper">Record another</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
