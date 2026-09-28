export interface Entry {
  id: number;
  title: string;
  transcript: string;
  audioPath: string | null;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewEntry {
  title: string;
  transcript: string;
  audioPath?: string | null;
  durationMs?: number;
  createdAt?: number;
}

export interface EntryPatch {
  title?: string;
  transcript?: string;
  audioPath?: string | null;
  durationMs?: number;
}

export interface EntryRow {
  id: number;
  title: string;
  transcript: string;
  audio_path: string | null;
  duration_ms: number;
  created_at: number;
  updated_at: number;
}

export function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    title: row.title,
    transcript: row.transcript,
    audioPath: row.audio_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
