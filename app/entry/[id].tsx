import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import TranscribeButton from '@/components/TranscribeButton';
import Skeleton from '@/components/Skeleton';
import { deleteEntry, getEntryById, updateEntry, type Entry } from '@/db';
import { formatDuration, formatEntryDate } from '@/lib/entries';
import { useEntriesStore } from '@/store/useEntriesStore';

function ClipPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-ink p-3">
      <Pressable
        className="h-10 w-10 items-center justify-center rounded-full bg-gold"
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause clip' : 'Play clip'}
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
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={18}
          color="#0D0D0F"
        />
      </Pressable>
      <Text className="text-caption text-mist tabular-nums">
        {formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}
      </Text>
    </View>
  );
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number(id);
  const db = useSQLiteContext();
  const refresh = useEntriesStore((s) => s.refresh);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(entryId)) {
      setMissing(true);
      return;
    }
    const row = await getEntryById(db, entryId);
    if (!row) {
      setMissing(true);
      return;
    }
    setEntry(row);
    setTitle(row.title);
    setTranscript(row.transcript);
  }, [db, entryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const dirty = entry !== null && (title !== entry.title || transcript !== entry.transcript);

  const handleSave = async () => {
    if (!entry || !dirty) {
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEntry(db, entry.id, { title, transcript });
      if (updated) {
        setEntry(updated);
      }
      await refresh(db);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) {
      return;
    }
    setDeleting(true);
    try {
      await deleteEntry(db, entry.id);
      await refresh(db);
      router.back();
    } finally {
      setDeleting(false);
    }
  };

  if (missing) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-6">
        <Text className="text-title text-paper">Entry not found</Text>
        <Pressable
          className="mt-4 rounded-full bg-card px-5 py-3"
          onPress={() => router.back()}>
          <Text className="text-caption font-bold text-paper">Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!entry) {
    return (
      <View className="flex-1 bg-ink px-5 pt-12">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="mt-4 h-4 w-40 rounded-full" />
        <Skeleton className="mt-3 h-8 w-3/4 rounded-lg" />
        <Skeleton className="mt-3 h-48 rounded-card" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-ink"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between px-5 pt-12">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#F5F3EE" />
        </Pressable>
        <Pressable
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete entry"
          onPress={() => void handleDelete()}
          className="h-10 w-10 items-center justify-center rounded-full bg-card">
          <Ionicons name="trash-outline" size={18} color="#E5484D" />
        </Pressable>
      </View>

      <View className="mt-2 px-5">
        <Text className="text-micro text-faint">
          {formatEntryDate(entry.createdAt)}
          {entry.audioPath ? ` • ${formatDuration(entry.durationMs)}` : ''}
        </Text>
        <TextInput
          className="mt-2 text-title text-paper"
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#6E6E76"
          multiline
        />
        <TextInput
          className="mt-3 min-h-40 rounded-card bg-card p-4 text-body text-paper"
          value={transcript}
          onChangeText={setTranscript}
          placeholder="Transcript — edit freely, corrections save to search too."
          placeholderTextColor="#6E6E76"
          multiline
          textAlignVertical="top"
        />
        <Pressable
          disabled={!dirty || saving}
          onPress={() => void handleSave()}
          className={`mt-3 self-start rounded-full px-5 py-2.5 ${
            dirty ? 'bg-gold' : 'bg-card opacity-60'
          }`}>
          <Text className={`text-caption font-bold ${dirty ? 'text-ink' : 'text-faint'}`}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Text>
        </Pressable>
      </View>

      {entry.audioPath ? (
        <View className="mx-5 mt-4 rounded-card bg-card p-4">
          <Text className="mb-2 text-caption font-bold text-paper">Voice clip</Text>
          <ClipPlayer uri={entry.audioPath} />
          <View className="mt-3">
            <TranscribeButton
              entryId={entry.id}
              audioUri={entry.audioPath}
              audioMs={entry.durationMs}
              onDone={() => void load()}
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
