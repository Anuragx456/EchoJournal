import type { SQLiteDatabase } from 'expo-sqlite';

import { rowToEntry, type Entry, type EntryPatch, type EntryRow, type NewEntry } from './types';

const COLUMNS = 'id, title, transcript, audio_path, duration_ms, created_at, updated_at';

function toEntry(row: EntryRow): Entry {
  return rowToEntry(row);
}

export async function createEntry(db: SQLiteDatabase, input: NewEntry): Promise<Entry> {
  const now = Date.now();
  const createdAt = input.createdAt ?? now;
  const result = await db.runAsync(
    `INSERT INTO entries (title, transcript, audio_path, duration_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.title,
    input.transcript,
    input.audioPath ?? null,
    input.durationMs ?? 0,
    createdAt,
    now
  );
  const id = Number(result.lastInsertRowId);
  const row = await db.getFirstAsync<EntryRow>(`SELECT ${COLUMNS} FROM entries WHERE id = ?`, id);
  if (!row) {
    throw new Error(`createEntry: inserted row ${id} not found`);
  }
  return toEntry(row);
}

export async function getEntryById(db: SQLiteDatabase, id: number): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>(`SELECT ${COLUMNS} FROM entries WHERE id = ?`, id);
  return row ? toEntry(row) : null;
}

export async function listEntries(
  db: SQLiteDatabase,
  limit = 100,
  offset = 0
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT ${COLUMNS} FROM entries ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    limit,
    offset
  );
  return rows.map(toEntry);
}

export async function listEntriesByRange(
  db: SQLiteDatabase,
  startMs: number,
  endMsExclusive: number
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT ${COLUMNS} FROM entries
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at DESC`,
    startMs,
    endMsExclusive
  );
  return rows.map(toEntry);
}

export async function updateEntry(
  db: SQLiteDatabase,
  id: number,
  patch: EntryPatch
): Promise<Entry | null> {
  const existing = await db.getFirstAsync<EntryRow>(
    `SELECT ${COLUMNS} FROM entries WHERE id = ?`,
    id
  );
  if (!existing) {
    return null;
  }
  const next = {
    title: patch.title ?? existing.title,
    transcript: patch.transcript ?? existing.transcript,
    audio_path: patch.audioPath !== undefined ? patch.audioPath : existing.audio_path,
    duration_ms: patch.durationMs ?? existing.duration_ms,
  };
  await db.runAsync(
    `UPDATE entries SET title = ?, transcript = ?, audio_path = ?, duration_ms = ?, updated_at = ?
     WHERE id = ?`,
    next.title,
    next.transcript,
    next.audio_path,
    next.duration_ms,
    Date.now(),
    id
  );
  const row = await db.getFirstAsync<EntryRow>(`SELECT ${COLUMNS} FROM entries WHERE id = ?`, id);
  return row ? toEntry(row) : null;
}

export async function deleteEntry(db: SQLiteDatabase, id: number): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM entries WHERE id = ?', id);
  return result.changes > 0;
}

export async function countEntries(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM entries');
  return row?.count ?? 0;
}

export async function clearAllEntries(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM entries');
}

function buildFtsQuery(query: string): string {
  const tokens = query
    .replace(/["*^:()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 10);
  if (tokens.length === 0) {
    return '';
  }
  return tokens.map((t) => `"${t}"*`).join(' ');
}

export async function searchEntries(db: SQLiteDatabase, query: string): Promise<Entry[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const match = buildFtsQuery(trimmed);
  if (match.length === 0) {
    return [];
  }
  try {
    const rows = await db.getAllAsync<EntryRow>(
      `SELECT e.${COLUMNS.replaceAll(', ', ', e.')} FROM entries_fts f
       JOIN entries e ON e.id = f.rowid
       WHERE entries_fts MATCH ?
       ORDER BY bm25(entries_fts) LIMIT 50`,
      match
    );
    return rows.map(toEntry);
  } catch {
    const rows = await db.getAllAsync<EntryRow>(
      `SELECT ${COLUMNS} FROM entries
       WHERE title LIKE ? OR transcript LIKE ?
       ORDER BY created_at DESC LIMIT 50`,
      `%${trimmed}%`,
      `%${trimmed}%`
    );
    return rows.map(toEntry);
  }
}
