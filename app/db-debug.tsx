import { useSQLiteContext } from 'expo-sqlite';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { clearAllEntries, type Entry } from '@/db';
import { formatDuration, formatEntryDate, titleFromTranscript } from '@/lib/entries';
import { useEntriesStore } from '@/store/useEntriesStore';

function dummyTranscript(index: number): string {
  return `Dummy entry ${index} — today I walked in the park and felt grateful. Search keywords: sunshine journal offline test ${Date.now()}.`;
}

export default function DbDebugScreen() {
  const db = useSQLiteContext();
  const { entries, totalCount, loading, error, refresh, create, update, remove, search } =
    useEntriesStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void refresh(db);
  }, [db, refresh]);

  const handleAddDummy = async () => {
    const transcript = dummyTranscript(totalCount + 1);
    await create(db, {
      title: titleFromTranscript(transcript),
      transcript,
      audioPath: null,
      durationMs: 0,
    });
    setResults(null);
    setQuery('');
  };

  const handleEdit = async (entry: Entry) => {
    await update(db, entry.id, { title: `${entry.title} (edited)` });
  };

  const handleDelete = async (id: number) => {
    await remove(db, id);
  };

  const handleClear = async () => {
    await clearAllEntries(db);
    setResults(null);
    setQuery('');
    await refresh(db);
  };

  const handleSearch = async () => {
    if (query.trim().length === 0) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const matches = await search(db, query);
      setResults(matches);
    } finally {
      setSearching(false);
    }
  };

  const visible = results ?? entries;

  return (
    <View className="flex-1 bg-[#0D0D0F] px-4 pt-12">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-white">DB Debug — Phase 1</Text>
        <View className="flex-row gap-2">
          <Link href="/record-debug" asChild>
            <Pressable className="rounded-full bg-[#4C6FFF] px-4 py-2">
              <Text className="text-xs font-semibold text-white">Record</Text>
            </Pressable>
          </Link>
          <Link href="/" asChild>
            <Pressable className="rounded-full bg-[#2A2A30] px-4 py-2">
              <Text className="text-xs font-semibold text-white">Home</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text className="mt-1 text-xs text-neutral-400">
        {loading ? 'Working…' : `${totalCount} entries in SQLite (echojournal.db)`}
      </Text>
      {error ? <Text className="mt-1 text-xs text-red-400">Error: {error}</Text> : null}

      <View className="mt-4 flex-row gap-2">
        <Pressable
          className="flex-1 items-center rounded-full bg-[#4C6FFF] px-4 py-3"
          onPress={() => void handleAddDummy()}>
          <Text className="text-sm font-semibold text-white">Add dummy entry</Text>
        </Pressable>
        <Pressable
          className="items-center rounded-full bg-[#2A2A30] px-4 py-3"
          onPress={() => void handleClear()}>
          <Text className="text-sm font-semibold text-white">Clear all</Text>
        </Pressable>
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          className="flex-1 rounded-2xl bg-[#1A1A1E] px-4 py-3 text-sm text-white"
          placeholder="Search transcripts (FTS5)…"
          placeholderTextColor="#737373"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.length === 0) {
              setResults(null);
            }
          }}
          onSubmitEditing={() => void handleSearch()}
          returnKeyType="search"
        />
        <Pressable
          className="rounded-full bg-[#2A2A30] px-4 py-3"
          onPress={() => void handleSearch()}>
          <Text className="text-sm font-semibold text-white">{searching ? '…' : 'Search'}</Text>
        </Pressable>
      </View>
      {results ? (
        <Text className="mt-2 text-xs text-neutral-400">
          {results.length} match{results.length === 1 ? '' : 'es'} for “{query}” — tap Search with
          empty text to reset.
        </Text>
      ) : null}

      <FlatList
        className="mt-3"
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="mt-10 items-center">
            <Text className="text-sm text-neutral-400">
              No entries yet. Add a dummy entry to test create/read/update/delete.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-3 rounded-2xl bg-[#17171A] p-4">
            <Text className="text-sm font-bold text-white">
              #{item.id} — {item.title}
            </Text>
            <Text className="mt-1 text-xs text-neutral-300" numberOfLines={3}>
              {item.transcript}
            </Text>
            <Text className="mt-2 text-[11px] text-neutral-500">
              {formatDuration(item.durationMs)} • {formatEntryDate(item.createdAt)}
              {item.audioPath ? ` • ${item.audioPath}` : ' • no audio yet (Phase 2)'}
            </Text>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                className="rounded-full bg-[#2A2A30] px-4 py-2"
                onPress={() => void handleEdit(item)}>
                <Text className="text-xs font-semibold text-white">Edit title</Text>
              </Pressable>
              <Pressable
                className="rounded-full bg-[#3A1D1D] px-4 py-2"
                onPress={() => void handleDelete(item.id)}>
                <Text className="text-xs font-semibold text-red-300">Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}
