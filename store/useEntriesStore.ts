import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import {
  countEntries,
  createEntry,
  deleteEntry,
  listEntries,
  searchEntries,
  updateEntry,
  type Entry,
  type EntryPatch,
  type NewEntry,
} from '@/db';

interface EntriesState {
  entries: Entry[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refresh: (db: SQLiteDatabase) => Promise<void>;
  create: (db: SQLiteDatabase, input: NewEntry) => Promise<Entry>;
  update: (db: SQLiteDatabase, id: number, patch: EntryPatch) => Promise<Entry | null>;
  remove: (db: SQLiteDatabase, id: number) => Promise<boolean>;
  search: (db: SQLiteDatabase, query: string) => Promise<Entry[]>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown database error';
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  totalCount: 0,
  loading: false,
  error: null,

  refresh: async (db) => {
    set({ loading: true, error: null });
    try {
      const [entries, totalCount] = await Promise.all([listEntries(db), countEntries(db)]);
      set({ entries, totalCount, loading: false });
    } catch (error) {
      set({ loading: false, error: toMessage(error) });
    }
  },

  create: async (db, input) => {
    set({ loading: true, error: null });
    try {
      const entry = await createEntry(db, input);
      await get().refresh(db);
      return entry;
    } catch (error) {
      set({ loading: false, error: toMessage(error) });
      throw error;
    }
  },

  update: async (db, id, patch) => {
    set({ loading: true, error: null });
    try {
      const entry = await updateEntry(db, id, patch);
      await get().refresh(db);
      return entry;
    } catch (error) {
      set({ loading: false, error: toMessage(error) });
      throw error;
    }
  },

  remove: async (db, id) => {
    set({ loading: true, error: null });
    try {
      const deleted = await deleteEntry(db, id);
      await get().refresh(db);
      return deleted;
    } catch (error) {
      set({ loading: false, error: toMessage(error) });
      throw error;
    }
  },

  search: async (db, query) => {
    return searchEntries(db, query);
  },
}));
