import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// routineService is a module singleton whose requests go through
// authService, which hydrates from storage at import time. The in-memory
// adapter is installed before the import below so the singletons start from
// a clean, controlled storage backend.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { authService } = await import('./auth-service');
const { routineService } = await import('./routine-service');
import type { Routine, User } from '../types';

const API_URL = 'http://test-api';

const user: User = {
  id: 1,
  username: 'tester',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const tokens = (accessToken = 'access-1', refreshToken = 'refresh-1') => ({
  accessToken,
  refreshToken,
  expiresIn: 3600,
  tokenType: 'Bearer',
});

// Logs in with a queued login response so each test starts authenticated,
// then clears the mock so a test only sees its own requests.
async function loginAsUser(): Promise<void> {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ data: { tokens: tokens(), user }, message: 'ok' })
  );
  await authService.login({ identifier: 'test@example.com', password: 'secret' });
  vi.mocked(fetch).mockClear();
}

const routine: Routine = {
  id: 3,
  userId: 1,
  title: 'Morning reset',
  description: 'Start the day right',
  privacyStatus: 'private',
  activities: [],
  isCompletedToday: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );
});

afterEach(async () => {
  await authService.logout();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.clear();
});

describe('routineService.getRoutines', () => {
  it('gets routines from the /me endpoint and unwraps the list response', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [routine], message: 'ok' })
    );

    const result = await routineService.getRoutines();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/routines/me`);
    expect(result).toEqual([routine]);
  });

  it('returns [] when the backend data is null', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(routineService.getRoutines()).resolves.toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(routineService.getRoutines()).rejects.toThrow(
      'Failed to fetch routines'
    );
  });
});

describe('routineService.getRoutine', () => {
  it('gets a single routine by id', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: routine, message: 'ok' })
    );

    const result = await routineService.getRoutine(3);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/routines/3`);
    expect(result).toEqual(routine);
  });

  it('throws when the routine is not found', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(routineService.getRoutine(3)).rejects.toThrow(
      'Routine not found'
    );
  });
});

describe('routineService.createRoutine', () => {
  it('posts the create payload as JSON', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: routine, message: 'created' })
    );

    const request = {
      title: 'Morning reset',
      description: 'Start the day right',
      privacyStatus: 'private' as const,
      activityIds: [
        { activityId: 7, position: 0 },
        { activityId: 9, position: 1 },
      ],
    };
    const result = await routineService.createRoutine(request);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/routines`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(request);
    expect(result).toEqual(routine);
  });

  it('throws when creation fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(
      routineService.createRoutine({
        title: 'Morning reset',
        description: '',
        privacyStatus: 'private',
        activityIds: [],
      })
    ).rejects.toThrow('Failed to create routine');
  });
});

describe('routineService.updateRoutine', () => {
  it('patches the routine with the given updates', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: routine, message: 'ok' })
    );

    const updates = {
      title: 'Evening reset',
      activityIds: [{ activityId: 9, position: 0 }],
    };
    const result = await routineService.updateRoutine(3, updates);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/routines/3`);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual(updates);
    expect(result).toEqual(routine);
  });

  it('throws when the update fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(
      routineService.updateRoutine(3, { title: 'Nope' })
    ).rejects.toThrow('Failed to update routine');
  });
});

describe('routineService.deleteRoutine', () => {
  it('sends a DELETE request to the routine URL', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(routineService.deleteRoutine(3)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/routines/3`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws when the delete fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(routineService.deleteRoutine(3)).rejects.toThrow(
      'Failed to delete routine'
    );
  });
});
