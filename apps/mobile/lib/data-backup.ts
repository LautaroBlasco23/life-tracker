import { authService } from '@shared';
import { getConfig } from '@shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { RestoreCounts } from '@shared';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_FILENAME = 'life-tracker-backup.xlsx';

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="?([^";]+)"?/);
  return match ? match[1] : null;
}

/**
 * Mobile export: web downloads the XLSX blob; on Android the file is written
 * to the cache directory and handed to the share sheet so the user can save
 * or send it. Returns the filename it was written as.
 */
export async function exportBackup(): Promise<string> {
  const response = await authService.makeAuthenticatedRequest(
    `${getConfig().apiUrl}/users/me/data/export`
  );
  if (!response.ok) {
    throw new Error('Failed to export data');
  }
  const buffer = await response.arrayBuffer();
  const filename =
    filenameFromDisposition(response.headers.get('Content-Disposition')) ??
    DEFAULT_FILENAME;

  const file = new File(Paths.cache, `${Date.now()}-${filename}`);
  file.write(new Uint8Array(buffer));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: XLSX_MIME,
      dialogTitle: filename,
    });
  }
  return filename;
}

/** Pick an XLSX backup from the device; returns uri + display name. */
export async function pickBackupFile(): Promise<{ uri: string; name: string } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name ?? 'backup.xlsx' };
}

/**
 * Restore from a backup file. Web posts a DOM File; React Native posts a
 * { uri, name, type } FormData part (same shape userService.uploadProfilePicture
 * already uses). Destructive on the server: current data is replaced.
 */
export async function importBackup(file: { uri: string; name: string }): Promise<RestoreCounts> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: XLSX_MIME,
  } as unknown as File);
  const response = await authService.makeAuthenticatedRequest(
    `${getConfig().apiUrl}/users/me/data/import`,
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!response.ok) {
    let message = 'Failed to import data';
    try {
      const error = (await response.json()) as { error?: string };
      if (error.error) message = error.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  const result = (await response.json()) as { data: RestoreCounts };
  return result.data;
}
