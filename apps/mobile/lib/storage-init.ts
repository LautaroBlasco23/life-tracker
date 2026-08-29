/**
 * Side-effect module: installs the platform adapters BEFORE any shared
 * service module is evaluated (auth-service reads storage at module init).
 * Must be the FIRST import in the app entry.
 */
import { setStorageAdapter, setApiUrl } from '@shared';
import Storage from 'expo-sqlite/kv-store';

// Sync key-value store backed by SQLite. Works in Expo Go and dev builds.
setStorageAdapter({
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => Storage.removeItemSync(key),
});

// Runtime override (set from the Profile screen) wins over the build-time env.
const storedApiUrl = Storage.getItemSync('apiUrl');
if (storedApiUrl) {
  setApiUrl(storedApiUrl);
} else {
  // Android emulator reaches the host via 10.0.2.2. Physical devices / real
  // environments must set EXPO_PUBLIC_API_URL (see .env.example).
  setApiUrl(process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080/api');
}

export {};