/**
 * Side-effect module: installs the platform adapters BEFORE any shared
 * service module is evaluated (auth-service reads storage at module init).
 * Must be the FIRST import in the app entry.
 *
 * Sensitive values (access/refresh tokens) are stored in expo-secure-store
 * (Android Keystore) instead of the plaintext SQLite kv-store; everything
 * else (currentUser, apiUrl, …) stays in the fast synchronous kv-store.
 *
 * SecureStore is async-only while the shared adapter is synchronous, so
 * tokens go through a write-through memory cache: reads return the cached
 * value (empty until the pre-load below resolves, then always fresh), writes
 * update the cache and persist to SecureStore immediately.
 */
import { setStorageAdapter, setApiUrl, authService } from '@shared';
import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';

// Write-through cache for SecureStore values (declared before the adapter so
// no closure ever touches it before initialization).
const tokenCache = new Map<string, string>();

// Sync key-value store backed by SQLite. Works in Expo Go and dev builds.
// Non-sensitive keys only; tokens never touch this store.
setStorageAdapter({
  getItem: (key) => {
    if (key === 'accessToken' || key === 'refreshToken') {
      return tokenCache.get(key) ?? null;
    }
    return Storage.getItemSync(key);
  },
  setItem: (key, value) => {
    if (key === 'accessToken' || key === 'refreshToken') {
      tokenCache.set(key, value);
      void SecureStore.setItemAsync(key, value);
      return;
    }
    Storage.setItemSync(key, value);
  },
  removeItem: (key) => {
    if (key === 'accessToken' || key === 'refreshToken') {
      tokenCache.delete(key);
      void SecureStore.deleteItemAsync(key).catch(() => {});
      return;
    }
    Storage.removeItemSync(key);
  },
});

// Pre-load tokens from SecureStore into the cache, then restore the session:
// auth-service read them (empty) at module init, before SecureStore responded.
// loadStoredSession() re-reads and notifies listeners, so the AuthGuard
// recovers via its onAuthChange subscription.
void (async () => {
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync('accessToken'),
      SecureStore.getItemAsync('refreshToken'),
    ]);
    if (access) tokenCache.set('accessToken', access);
    if (refresh) tokenCache.set('refreshToken', refresh);
  } finally {
    authService.loadStoredSession();
  }
})();

// Runtime override (set from the Profile screen) wins over the build-time env.
// Only https:// is accepted: the override would otherwise point the app (and
// the Bearer tokens it sends) at an arbitrary http host.
const storedApiUrl = Storage.getItemSync('apiUrl');
if (storedApiUrl?.startsWith('https://')) {
  setApiUrl(storedApiUrl);
} else {
  // Prod API is the default: a plain release build with no env config is the
  // phone app. Dev builds set EXPO_PUBLIC_API_URL (see .env.example);
  // the Profile-screen override (stored 'apiUrl') wins over both.
  setApiUrl(
    process.env.EXPO_PUBLIC_API_URL ?? 'https://api.example.com/api',
  );
}

export {};
