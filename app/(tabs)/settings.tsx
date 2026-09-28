import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { clearAllEntries, listEntries } from '@/db';
import { buildExportText, writeExportFile } from '@/lib/export';
import { WHISPER_MODEL_SIZE_MB, modelDisplayName, modelFileUri } from '@/lib/whisper';
import { useEntriesStore } from '@/store/useEntriesStore';
import { useTranscriptionStore } from '@/store/useTranscriptionStore';

/**
 * Settings (Phase 6): model download/delete with progress, journal export
 * (.txt via system share sheet), clear-all-data with audio-file cleanup.
 */
export default function SettingsScreen() {
  const db = useSQLiteContext();
  const totalCount = useEntriesStore((s) => s.totalCount);
  const refresh = useEntriesStore((s) => s.refresh);
  const modelReady = useTranscriptionStore((s) => s.modelReady);
  const checkModel = useTranscriptionStore((s) => s.checkModel);
  const downloadStatus = useTranscriptionStore((s) => s.downloadStatus);
  const downloadProgress = useTranscriptionStore((s) => s.downloadProgress);
  const downloadError = useTranscriptionStore((s) => s.downloadError);
  const startModelDownload = useTranscriptionStore((s) => s.startModelDownload);
  const deleteModel = useTranscriptionStore((s) => s.deleteModel);

  const [busy, setBusy] = useState<'export' | 'clear' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh(db);
      void checkModel();
    }, [db, refresh, checkModel])
  );

  const confirmDownload = () => {
    Alert.alert(
      'Download transcription model?',
      `${modelDisplayName()} is ${WHISPER_MODEL_SIZE_MB} MB — WiFi recommended. It is stored on-device and never uploaded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => void startModelDownload() },
      ]
    );
  };

  const confirmDeleteModel = () => {
    Alert.alert(
      'Delete transcription model?',
      'Transcription will be unavailable until you download the model again. Your entries stay untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteModel() },
      ]
    );
  };

  const handleExport = async () => {
    setBusy('export');
    setNotice(null);
    try {
      const entries = await listEntries(db, 500);
      const uri = await writeExportFile(buildExportText(entries));
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri);
      }
      setNotice(`Exported ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} to ${uri}`);
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Delete all journal entries?',
      'This removes every entry and its audio file from this device. The transcription model stays. This cannot be undone — export first if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy('clear');
              setNotice(null);
              try {
                const entries = await listEntries(db, 1000);
                for (const entry of entries) {
                  if (entry.audioPath) {
                    try {
                      new File(entry.audioPath).delete();
                    } catch {
                      // Orphaned or already-gone files must not block the wipe.
                    }
                  }
                }
                await clearAllEntries(db);
                await refresh(db);
                setNotice('All entries and audio files deleted.');
              } catch (e) {
                setNotice(`Clear failed: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                setBusy(null);
              }
            })(),
        },
      ]
    );
  };

  const downloading = downloadStatus === 'downloading';

  return (
    <ScrollView className="flex-1 bg-ink" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-12">
        <Text className="text-display text-paper">Settings</Text>
        <Text className="mt-1 text-caption text-faint">EchoJournal v0.1.0 • offline only</Text>
      </View>

      <View className="mx-5 mt-4 rounded-card bg-card p-4">
        <Text className="text-body font-bold text-paper">Whisper model</Text>
        <Text className="mt-1 text-caption text-mist">{modelDisplayName()}</Text>
        <Text className="mt-1 text-micro text-faint" numberOfLines={2}>
          {modelFileUri()}
        </Text>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className={`text-caption font-bold ${modelReady ? 'text-moss' : 'text-gold'}`}>
            {modelReady === null ? 'Checking…' : modelReady ? 'On device ✓' : 'Not on device'}
          </Text>
          <Pressable
            className="rounded-full bg-edge px-4 py-2"
            onPress={() => void checkModel()}>
            <Text className="text-caption font-bold text-paper">Recheck</Text>
          </Pressable>
        </View>

        {downloading ? (
          <View className="mt-3">
            <View className="h-2 overflow-hidden rounded-full bg-edge">
              <View className="h-full bg-gold" style={{ width: `${downloadProgress}%` }} />
            </View>
            <Text className="mt-1 text-micro text-faint">
              Downloading… {downloadProgress}% ({WHISPER_MODEL_SIZE_MB} MB total)
            </Text>
          </View>
        ) : null}
        {downloadStatus === 'done' && modelReady ? (
          <Text className="mt-2 text-micro text-moss">Model ready for transcription.</Text>
        ) : null}
        {downloadError ? (
          <Text className="mt-2 text-caption text-ember">{downloadError}</Text>
        ) : null}

        <View className="mt-3 flex-row gap-2">
          {!modelReady ? (
            <Pressable
              disabled={downloading}
              className={`rounded-full bg-gold px-4 py-2.5 ${downloading ? 'opacity-50' : ''}`}
              onPress={confirmDownload}>
              <Text className="text-caption font-bold text-ink">
                {downloading ? 'Downloading…' : 'Download model'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              className="rounded-full bg-edge px-4 py-2.5"
              onPress={confirmDeleteModel}>
              <Text className="text-caption font-bold text-ember">Delete model</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="mx-5 mt-3 rounded-card bg-card p-4">
        <Text className="text-body font-bold text-paper">Journal data</Text>
        <Text className="mt-1 text-caption text-mist">
          {totalCount} {totalCount === 1 ? 'entry' : 'entries'} in on-device SQLite.
        </Text>
        {notice ? <Text className="mt-2 text-caption text-mist">{notice}</Text> : null}
        <View className="mt-3 flex-row gap-2">
          <Pressable
            disabled={busy !== null}
            className={`rounded-full bg-edge px-4 py-2.5 ${busy ? 'opacity-50' : ''}`}
            onPress={() => void handleExport()}>
            <Text className="text-caption font-bold text-paper">
              {busy === 'export' ? 'Exporting…' : 'Export as text'}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy !== null}
            className={`rounded-full bg-[#3A1D1D] px-4 py-2.5 ${busy ? 'opacity-50' : ''}`}
            onPress={handleClearAll}>
            <Text className="text-caption font-bold text-ember">
              {busy === 'clear' ? 'Clearing…' : 'Clear all data'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="mx-5 mt-3 rounded-card bg-card p-4">
        <Text className="text-body font-bold text-paper">Debug</Text>
        <View className="mt-3 flex-row gap-2">
          <Link href="/db-debug" asChild>
            <Pressable className="rounded-full bg-edge px-4 py-2.5">
              <Text className="text-caption font-bold text-paper">DB debug</Text>
            </Pressable>
          </Link>
          <Link href="/record-debug" asChild>
            <Pressable className="rounded-full bg-edge px-4 py-2.5">
              <Text className="text-caption font-bold text-paper">Record debug</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
