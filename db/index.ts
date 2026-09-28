export { DATABASE_NAME, DATABASE_VERSION, migrateDbIfNeeded } from './client';
export {
  clearAllEntries,
  countEntries,
  createEntry,
  deleteEntry,
  getEntryById,
  listEntries,
  listEntriesByRange,
  searchEntries,
  updateEntry,
} from './entriesRepo';
export { rowToEntry, type Entry, type EntryPatch, type EntryRow, type NewEntry } from './types';
