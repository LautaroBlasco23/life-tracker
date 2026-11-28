import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// reminderService is a module singleton whose requests go through
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
const { reminderService } = await import('./reminder-service');
import type { Reminder, User } from '../types';

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

const reminder: Reminder = {
  id: 5,
  userId: 1,
  title: 'Pay rent',
  description: 'Monthly transfer',
  dueAt: '2026-11-20T18:00:00Z',
  activeFrom: null,
  completedAt: null,
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

describe('reminderService.getReminders', () => {
  it('gets reminders and unwraps the list response', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [reminder], message: 'ok' })
    );

    const result = await reminderService.getReminders();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders`);
    expect(result).toEqual([reminder]);
  });

  it('returns [] when the backend data is null', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(reminderService.getReminders()).resolves.toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(reminderService.getReminders()).rejects.toThrow(
      'Failed to fetch reminders'
    );
  });
});

describe('reminderService.getReminder', () => {
  it('gets a single reminder by id', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: reminder, message: 'ok' })
    );

    const result = await reminderService.getReminder(5);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders/5`);
    expect(result).toEqual(reminder);
  });

  it('throws when the reminder is not found', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(reminderService.getReminder(5)).rejects.toThrow(
      'Reminder not found'
    );
  });
});

describe('reminderService.createReminder', () => {
  it('posts the create payload as JSON', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: reminder, message: 'created' })
    );

    const request = {
      title: 'Pay rent',
      description: 'Monthly transfer',
      dueAt: '2026-11-20T18:00:00Z',
      activeFrom: '2026-11-18T00:00:00Z',
      privacyStatus: 'private' as const,
    };
    const result = await reminderService.createReminder(request);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(request);
    expect(result).toEqual(reminder);
  });

  it('throws when creation fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(
      reminderService.createReminder({
        title: 'Pay rent',
        description: '',
        dueAt: '2026-11-20T18:00:00Z',
      })
    ).rejects.toThrow('Failed to create reminder');
  });
});

describe('reminderService.updateReminder', () => {
  it('puts the updates, preserving explicit null fields', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: reminder, message: 'ok' })
    );

    const updates = {
      title: 'Pay rent tomorrow',
      dueAt: '2026-11-21T18:00:00Z',
      activeFrom: null,
    };
    const result = await reminderService.updateReminder(5, updates);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders/5`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual(updates);
    expect(result).toEqual(reminder);
  });

  it('throws when the update fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(
      reminderService.updateReminder(5, { title: 'Nope' })
    ).rejects.toThrow('Failed to update reminder');
  });
});

describe('reminderService.deleteReminder', () => {
  it('sends a DELETE request to the reminder URL', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(reminderService.deleteReminder(5)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders/5`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws when the delete fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(reminderService.deleteReminder(5)).rejects.toThrow(
      'Failed to delete reminder'
    );
  });
});

describe('reminderService.completeReminder', () => {
  it('posts to the complete endpoint without a body', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        data: { ...reminder, completedAt: '2026-11-17T10:00:00Z' },
        message: 'ok',
      })
    );

    const result = await reminderService.completeReminder(5);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders/5/complete`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    expect(result).toEqual({
      ...reminder,
      completedAt: '2026-11-17T10:00:00Z',
    });
  });

  it('throws when completing fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(reminderService.completeReminder(5)).rejects.toThrow(
      'Failed to complete reminder'
    );
  });
});

describe('reminderService.revertCompletion', () => {
  it('deletes the completion via the complete endpoint', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      reminderService.revertCompletion(5)
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/reminders/5/complete`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws when reverting fails', async () => {
    await loginAsUser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(reminderService.revertCompletion(5)).rejects.toThrow(
      'Failed to revert reminder completion'
    );
  });
});
