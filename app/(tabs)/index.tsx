import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import CalendarStrip from '@/components/CalendarStrip';
import Skeleton from '@/components/Skeleton';
import { dayKey, dayLabel, monthDayKey, startOfDay } from '@/lib/dates';
import { formatDuration } from '@/lib/entries';
import { useEntriesStore } from '@/store/useEntriesStore';
import { useTranscriptionStore } from '@/store/useTranscriptionStore';

function timeOfDay(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function JournalScreen() {
  const db = useSQLiteContext();
  const entries = useEntriesStore((s) => s.entries);
  const loading = useEntriesStore((s) => s.loading);
  const refresh = useEntriesStore((s) => s.refresh);
  const modelReady = useTranscriptionStore((s) => s.modelReady);
  const checkModel = useTranscriptionStore((s) => s.checkModel);

  const [selectedDay, setSelectedDay] = useState(() => startOfDay(Date.now()));
  const [onThisDay, setOnThisDay] = useState(false);
  const [todayMs, setTodayMs] = useState(() => Date.now());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Refresh the "today" snapshot each time the tab regains focus.
      setTodayMs(Date.now());
      void refresh(db);
      void checkModel();
    }, [db, refresh, checkModel])
  );

  const markedDays = useMemo(
    () => new Set(entries.map((e) => dayKey(e.createdAt))),
    [entries]
  );

  const hero = useMemo(
    () => entries.find((e) => dayKey(e.createdAt) === dayKey(todayMs)) ?? null,
    [entries, todayMs]
  );

  const visible = useMemo(() => {
    if (onThisDay) {
      const target = monthDayKey(todayMs);
      const year = new Date(todayMs).getFullYear();
      return entries.filter(
        (e) =>
          monthDayKey(e.createdAt) === target &&
          new Date(e.createdAt).getFullYear() < year
      );
    }
    const key = dayKey(selectedDay);
    return entries.filter((e) => dayKey(e.createdAt) === key);
  }, [entries, selectedDay, onThisDay, todayMs]);

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-12">
        <Text className="text-display text-paper">Journal</Text>
        <Text className="mt-1 text-caption text-faint">
          {loading ? 'Loading…' : `${entries.length} entries offline`}
        </Text>
      </View>

      {modelReady === false && !bannerDismissed ? (
        <View className="mx-5 mt-3 flex-row items-center rounded-2xl bg-[#2A2113] p-3">
          <Ionicons name="cloud-download-outline" size={18} color="#E8A33D" />
          <Text className="mx-2 flex-1 text-caption text-paper">
            Offline transcription model not on this device yet.
          </Text>
          <Pressable
            className="rounded-full bg-gold px-3 py-1.5"
            onPress={() => router.push('/settings')}>
            <Text className="text-micro font-bold text-ink">Get it</Text>
          </Pressable>
          <Pressable
            className="ml-1 h-8 w-8 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => setBannerDismissed(true)}>
            <Ionicons name="close" size={16} color="#6E6E76" />
          </Pressable>
        </View>
      ) : null}

      {loading && entries.length === 0 ? (
        <View className="mt-3 px-5">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="mt-3 h-36 rounded-card" />
          <Skeleton className="mt-3 h-24 rounded-card" />
        </View>
      ) : null}

      <View className="mt-3">
        <CalendarStrip
          selectedDay={selectedDay}
          todayMs={todayMs}
          markedDays={markedDays}
          onSelect={(day) => {
            setSelectedDay(day);
            setOnThisDay(false);
          }}
        />
      </View>

      <View className="mt-3 flex-row gap-2 px-5">
        <Pressable
          className="rounded-full bg-gold px-4 py-2.5"
          onPress={() => router.push('/add')}>
          <Text className="text-caption font-bold text-ink">＋ New Entry</Text>
        </Pressable>
        <Pressable
          className="rounded-full bg-card px-4 py-2.5"
          onPress={() => {
            setSelectedDay(startOfDay(Date.now()));
            setOnThisDay(false);
          }}>
          <Text className="text-caption font-bold text-paper">Today</Text>
        </Pressable>
        <Pressable
          className={`rounded-full px-4 py-2.5 ${onThisDay ? 'bg-grape' : 'bg-card'}`}
          onPress={() => setOnThisDay((v) => !v)}>
          <Text className="text-caption font-bold text-paper">On this day</Text>
        </Pressable>
      </View>

      {hero ? (
        <Pressable
          className="mx-5 mt-4 rounded-card bg-[#241F3D] p-5"
          onPress={() => router.push(`/entry/${hero.id}`)}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="mic-outline" size={14} color="#E8A33D" />
            <Text className="text-micro uppercase tracking-widest text-gold">
              Today&apos;s entry
            </Text>
          </View>
          <Text className="mt-2 text-title text-paper" numberOfLines={3}>
            {hero.transcript || hero.title}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-caption text-mist">
              {hero.audioPath ? `${formatDuration(hero.durationMs)} • ` : ''}
              {timeOfDay(hero.createdAt)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#A7A7AE" />
          </View>
        </Pressable>
      ) : (
        <Pressable
          className="mx-5 mt-4 items-center rounded-card bg-card p-6"
          onPress={() => router.push('/add')}>
          <Ionicons name="add-circle-outline" size={28} color="#E8A33D" />
          <Text className="mt-2 text-body font-bold text-paper">No entry today yet</Text>
          <Text className="mt-1 text-center text-caption text-mist">
            Tap to add your first entry of the day.
          </Text>
        </Pressable>
      )}

      <Text className="mx-5 mb-2 mt-5 text-title text-paper">
        {onThisDay ? 'On this day' : dayLabel(selectedDay)}
      </Text>

      {visible.length === 0 ? (
        <View className="mx-5 rounded-card bg-card p-5">
          <Text className="text-center text-caption text-faint">
            {onThisDay
              ? 'Nothing recorded on this date in past years.'
              : 'Nothing here — pick a dotted day or add something new.'}
          </Text>
        </View>
      ) : (
        visible.map((entry) => (
          <Pressable
            key={entry.id}
            className="mx-5 mb-2.5 rounded-card bg-card p-4"
            onPress={() => router.push(`/entry/${entry.id}`)}>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-body font-bold text-paper" numberOfLines={1}>
                {entry.title}
              </Text>
              {entry.audioPath ? (
                <Ionicons
                  name="mic-outline"
                  size={14}
                  color="#7C5CFF"
                  style={{ marginLeft: 8 }}
                />
              ) : null}
            </View>
            {entry.transcript ? (
              <Text className="mt-1 text-caption text-mist" numberOfLines={2}>
                {entry.transcript}
              </Text>
            ) : null}
            <Text className="mt-2 text-micro text-faint">
              {entry.audioPath ? `${formatDuration(entry.durationMs)} • ` : ''}
              {timeOfDay(entry.createdAt)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
