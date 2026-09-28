import type { Entry } from '@/db';

const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function startOfDay(timestampMs: number): number {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(timestampMs: number, days: number): number {
  const d = new Date(timestampMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Local calendar key: 'YYYY-MM-DD'. */
export function dayKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Month-day key for "on this day" matching across years: 'MM-DD'. */
export function monthDayKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${m}-${day}`;
}

export function dowLetter(timestampMs: number): string {
  return DOW_LETTER[new Date(timestampMs).getDay()];
}

export function dayNumber(timestampMs: number): string {
  return `${new Date(timestampMs).getDate()}`;
}

export function isToday(timestampMs: number): boolean {
  return dayKey(timestampMs) === dayKey(Date.now());
}

export function isYesterday(timestampMs: number): boolean {
  return dayKey(timestampMs) === dayKey(addDays(Date.now(), -1));
}

export function dayLabel(timestampMs: number): string {
  if (isToday(timestampMs)) {
    return 'Today';
  }
  if (isYesterday(timestampMs)) {
    return 'Yesterday';
  }
  return new Date(timestampMs).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface DayGroup {
  key: string;
  label: string;
  items: Entry[];
}

/** Group newest-first entries by calendar day (input already sorted DESC). */
export function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.createdAt);
    const list = groups.get(key);
    if (list) {
      list.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: dayLabel(items[0].createdAt),
    items,
  }));
}
