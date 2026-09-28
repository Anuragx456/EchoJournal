import { Buffer } from 'buffer';
import { Directory, File, Paths } from 'expo-file-system';

import type { Entry } from '@/db';
import { formatDuration, formatEntryDate } from './entries';

/** Plain-text backup of every entry (newest first). */
export function buildExportText(entries: Entry[]): string {
  const lines = [
    `EchoJournal export — ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} — ${new Date().toISOString()}`,
    '',
  ];
  for (const entry of entries) {
    lines.push(`## ${entry.title}`);
    lines.push(`${formatEntryDate(entry.createdAt)} • ${formatDuration(entry.durationMs)}`);
    lines.push('');
    lines.push(entry.transcript.length > 0 ? entry.transcript : '(no transcript)');
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

/** Writes the export into document/exports/ and returns its file:// URI. */
export async function writeExportFile(text: string): Promise<string> {
  const dir = new Directory(Paths.document, 'exports');
  if (!dir.exists) {
    dir.create();
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = new File(dir, `echojournal-export-${stamp}.txt`);
  const writer = file.writableStream().getWriter();
  try {
    await writer.write(Buffer.from(text, 'utf8'));
  } finally {
    await writer.close();
  }
  return file.uri;
}
