/**
 * Platform storage adapter.
 *
 * Web: backed by localStorage. Native: the host app must call
 * setStorageAdapter() with its own implementation (MMKV/AsyncStorage/...)
 * from a module imported BEFORE any service module, so the adapter is
 * installed before auth state is read at module init.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function webStorage(): StorageAdapter | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage;
    }
  } catch {
    // Storage access can throw (e.g. disabled cookies); fall through.
  }
  return null;
}

let storageAdapter: StorageAdapter | null = webStorage();

export function setStorageAdapter(adapter: StorageAdapter): void {
  storageAdapter = adapter;
}

/** Storage facade used by shared code. No-ops safely when no adapter is set. */
export const storage: StorageAdapter = {
  getItem: (key) => storageAdapter?.getItem(key) ?? null,
  setItem: (key, value) => storageAdapter?.setItem(key, value),
  removeItem: (key) => storageAdapter?.removeItem(key),
};
