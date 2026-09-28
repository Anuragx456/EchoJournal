import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'echojournal.db';
export const DATABASE_VERSION = 1;

const SCHEMA_V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL DEFAULT '',
  audio_path TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries (created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title,
  transcript,
  content = 'entries',
  content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts (rowid, title, transcript)
  VALUES (new.id, new.title, new.transcript);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts (entries_fts, rowid, title, transcript)
  VALUES ('delete', old.id, old.title, old.transcript);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts (entries_fts, rowid, title, transcript)
  VALUES ('delete', old.id, old.title, old.transcript);
  INSERT INTO entries_fts (rowid, title, transcript)
  VALUES (new.id, new.title, new.transcript);
END;
`;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) {
    return;
  }
  if (currentVersion === 0) {
    await db.execAsync(SCHEMA_V1);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
