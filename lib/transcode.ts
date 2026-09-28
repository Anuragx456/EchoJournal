import { Directory, File, Paths } from 'expo-file-system';
import { extractAudio } from 'expo-video-audio-extractor';

/**
 * Decode a compressed voice clip (m4a/AAC from expo-audio) to 16 kHz mono
 * 16-bit PCM WAV via the platform decoder (MediaCodec, no ffmpeg).
 * Output lives in document/transcoded/ and feeds whisper.rn directly.
 */
function toFsPath(uri: string): string {
  // The native extractor uses java.io.File / MediaExtractor.setDataSource(path),
  // which need plain filesystem paths — a file:// URI becomes the literal
  // filename "file:/data/..." and fails with ENOENT. Strip the scheme.
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export async function transcodeToWav(inputUri: string, tag: string): Promise<string> {
  const dir = new Directory(Paths.document, 'transcoded');
  if (!dir.exists) {
    dir.create();
  }
  const safe = tag.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dest = new File(dir, `${safe}.wav`);
  const out = await extractAudio({
    video: toFsPath(inputUri),
    output: toFsPath(dest.uri),
    format: 'wav',
    channels: 1,
    sampleRate: 16000,
  });
  // Contract is an absolute path; whisper.rn wants a file:// URI.
  return out.startsWith('file://') ? out : `file://${out}`;
}
