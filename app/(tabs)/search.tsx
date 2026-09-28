import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import HighlightedText from '@/components/HighlightedText';
import type { Entry } from '@/db';
import { formatDuration, formatEntryDate } from '@/lib/entries';
import { snippetForTokens, tokenizeForHighlight } from '@/lib/search';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useEntriesStore } from '@/store/useEntriesStore';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

/**
 * Live FTS5 search (Phase 5): debounced as-you-type querying against the
 * Phase 1 repo, match snippets + gold highlights in results.
 */
export default function SearchScreen() {
  const db = useSQLiteContext();
  const search = useEntriesStore((s) => s.search);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entry[] | null>(null);
  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const requestRef = useRef(0);

  const tokens = useMemo(() => tokenizeForHighlight(debounced), [debounced]);
  const typing = query !== debounced;
  const tooShort = query.trim().length > 0 && query.trim().length < MIN_CHARS;

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < MIN_CHARS) {
      return;
    }
    const id = (requestRef.current += 1);
    void search(db, q)
      .then((rows) => {
        if (requestRef.current === id) {
          setResults(rows);
        }
      })
      .catch(() => {
        if (requestRef.current === id) {
          setResults([]);
        }
      });
  }, [debounced, db, search]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (text.trim().length < MIN_CHARS) {
      // Invalidate in-flight queries; the debounced effect stays idle below 2 chars.
      requestRef.current += 1;
      setResults(null);
    }
  };

  const handleClear = () => {
    requestRef.current += 1;
    setQuery('');
    setResults(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-ink"
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled">
      <View className="px-5 pt-12">
        <Text className="text-display text-paper">Search</Text>
        <Text className="mt-1 text-caption text-faint">
          Full-text search across titles + transcripts (on-device FTS5).
        </Text>
      </View>

      <View className="mt-4 flex-row items-center gap-2 px-5">
        <View className="flex-1 flex-row items-center rounded-2xl bg-card pr-2">
          <TextInput
            className="flex-1 px-4 py-3 text-body text-paper"
            placeholder="Type a word…"
            placeholderTextColor="#6E6E76"
            value={query}
            onChangeText={handleChange}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={handleClear}>
              <Ionicons name="close-circle" size={20} color="#6E6E76" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="mt-3 px-5">
        {tooShort ? (
          <Text className="text-caption text-faint">Type at least 2 characters to search.</Text>
        ) : typing ? (
          <Text className="text-caption text-faint">Searching…</Text>
        ) : results ? (
          <Text className="mb-2 text-caption text-faint">
            {results.length} match{results.length === 1 ? '' : 'es'}
          </Text>
        ) : (
          <Text className="text-caption text-faint">
            Results appear as you type — try a word from a past entry.
          </Text>
        )}

        {(results ?? []).map((entry) => {
          const { snippet, leading, trailing } = snippetForTokens(
            entry.transcript,
            tokens
          );
          return (
            <Pressable
              key={entry.id}
              className="mb-2.5 rounded-card bg-card p-4"
              onPress={() => router.push(`/entry/${entry.id}`)}>
              <HighlightedText
                text={entry.title}
                tokens={tokens}
                className="text-body font-bold text-paper"
                numberOfLines={1}
              />
              {snippet ? (
                <HighlightedText
                  text={`${leading ? '… ' : ''}${snippet}${trailing ? ' …' : ''}`}
                  tokens={tokens}
                  className="mt-1 text-caption text-mist"
                  numberOfLines={3}
                />
              ) : null}
              <Text className="mt-2 text-micro text-faint">
                {formatEntryDate(entry.createdAt)} • {formatDuration(entry.durationMs)}
              </Text>
            </Pressable>
          );
        })}

        {results && results.length === 0 ? (
          <Text className="text-caption text-faint">No matches — try another word.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
