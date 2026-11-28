import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// Services are module singletons hydrating from storage at import time; the
// in-memory adapter must be installed before the imports below.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
const { dataService } = await import('./data-service');
import type { RestoreCounts } from './data-service';

const API_URL = 'http://test-api';

const user = {
  id: 1,
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// exportData drives the browser-only download flow (document + object URLs),
// so those globals are faked per test; the reachable logic (URL building,
// anchor attributes, cleanup) is still asserted.

const createObjectURL = vi.fn(() => 'blob:mock-url');
const revokeObjectURL = vi.fn();

beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );
  // Extend the real URL constructor so any internal new URL() keeps working.
  vi.stubGlobal(URL.name, Object.assign(URL, { createObjectURL, revokeObjectURL }));

  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
  );
  await authService.login({ identifier: 'test@example.com', password: 'secret' });
  vi.mocked(fetch).mockClear();
});

afterEach(async () => {
  await authService.logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.clear();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubDownloadDom(): { anchor: Record<string, unknown>; appendChild: ReturnType<typeof vi.fn> } {
  const anchor: Record<string, unknown> = {
    href: '',
    download: '',
    click: vi.fn(),
    remove: vi.fn(),
  };
  const appendChild = vi.fn();
  vi.stubGlobal('document', {
    createElement: vi.fn(() => anchor),
    body: { appendChild },
  });
  return { anchor, appendChild };
}

const tokens = (accessToken = 'access-1', refreshToken = 'refresh-1') => ({
  accessToken,
  refreshToken,
  expiresIn: 3600,
  tokenType: 'Bearer',
});

const counts: RestoreCounts = {
  activities: 3,
  timeRecords: 10,
  calendarEvents: 2,
  notes: 4,
  routines: 1,
  routineActivities: 5,
  activityRecords: 8,
  transactions: 6,
  payments: 7,
};

describe('dataService.exportData', () => {
  it('downloads the blob under the Content-Disposition filename', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('xlsx-bytes', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="backup-2026.xlsx"' },
      })
    );
    const { anchor, appendChild } = stubDownloadDom();

    const filename = await dataService.exportData();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/data/export`);
    expect(init?.method ?? 'GET').toBe('GET');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.download).toBe('backup-2026.xlsx');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(filename).toBe('backup-2026.xlsx');
  });

  it('falls back to the default filename without Content-Disposition', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('xlsx-bytes'));
    const { anchor } = stubDownloadDom();

    const filename = await dataService.exportData();

    expect(anchor.download).toBe('life-tracker-backup.xlsx');
    expect(filename).toBe('life-tracker-backup.xlsx');
  });

  it('throws on non-ok responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(dataService.exportData()).rejects.toThrow('Failed to export data');
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('dataService.importData', () => {
  it('posts the file as FormData without a JSON content type', async () => {
    const file = new File(['xlsx-bytes'], 'backup.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: counts, message: 'restore complete' })
    );

    const result = await dataService.importData(file);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/users/me/data/import`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('file')).toBe(file);
    // FormData bodies must keep the browser-generated multipart boundary.
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(result).toEqual(counts);
  });

  it('surfaces the backend error message when present', async () => {
    const file = new File(['xlsx-bytes'], 'backup.xlsx');
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'invalid backup file' }, 400)
    );

    await expect(dataService.importData(file)).rejects.toThrow(
      'invalid backup file'
    );
  });

  it('falls back to the default message on a non-JSON error body', async () => {
    const file = new File(['xlsx-bytes'], 'backup.xlsx');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('oops', { status: 500 }));

    await expect(dataService.importData(file)).rejects.toThrow(
      'Failed to import data'
    );
  });
});
