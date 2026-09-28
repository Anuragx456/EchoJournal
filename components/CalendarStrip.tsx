import { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { addDays, dayKey, dayNumber, dowLetter, startOfDay } from '@/lib/dates';

const PAST_DAYS = 60;
const FUTURE_DAYS = 14;
const CELL_WIDTH = 52;

interface CalendarStripProps {
  /** Any timestamp within the selected day. */
  selectedDay: number;
  /** "Now" snapshot owned by the parent (keeps render pure). */
  todayMs: number;
  /** Set of dayKey() strings that have entries. */
  markedDays: Set<string>;
  onSelect: (dayStartMs: number) => void;
}

export default function CalendarStrip({ selectedDay, todayMs, markedDays, onSelect }: CalendarStripProps) {
  const days = useMemo(() => {
    const today = startOfDay(todayMs);
    const list: number[] = [];
    for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i += 1) {
      list.push(addDays(today, i));
    }
    return list;
  }, [todayMs]);

  const selectedKey = dayKey(selectedDay);
  const todayKey = dayKey(todayMs);
  const initialIndex = useMemo(
    () => Math.max(0, days.findIndex((d) => dayKey(d) === selectedKey)),
    [days, selectedKey]
  );
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    // Jump without animation on first mount; FlatList ref may not be ready.
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      } catch {
        // Layout not ready yet — the list still renders from initialScrollIndex.
      }
    }, 50);
    return () => clearTimeout(t);
  }, [initialIndex]);

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(d) => String(d)}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({
        length: CELL_WIDTH,
        offset: CELL_WIDTH * index,
        index,
      })}
      onScrollToIndexFailed={() => undefined}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}
      renderItem={({ item }) => {
        const key = dayKey(item);
        const isSelected = key === selectedKey;
        const isToday = key === todayKey;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`${key}${isToday ? ', today' : ''}`}
            style={{ width: CELL_WIDTH }}
            className="items-center py-2">
            <Text className={`text-micro ${isSelected ? 'text-gold' : 'text-faint'}`}>
              {dowLetter(item)}
            </Text>
            <View
              className={`mt-1 h-9 w-9 items-center justify-center rounded-full ${
                isSelected ? 'bg-gold' : isToday ? 'bg-card' : 'bg-transparent'
              }`}>
              <Text
                className={`text-body font-bold ${
                  isSelected ? 'text-ink' : isToday ? 'text-gold' : 'text-paper'
                }`}>
                {dayNumber(item)}
              </Text>
            </View>
            <View
              className={`mt-1 h-1 w-1 rounded-full ${
                markedDays.has(key) ? 'bg-grape' : 'bg-transparent'
              }`}
            />
          </Pressable>
        );
      }}
    />
  );
}
