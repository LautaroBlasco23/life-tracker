import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setStorageAdapter } from '../lib/storage';

// Services are module singletons built on authService, which hydrates from
// storage at import time. The in-memory adapter is installed before the
// import below so the singleton starts from a clean, controlled backend.

const store = new Map<string, string>();
setStorageAdapter({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
});

const { stickyNoteService } = await import('./sticky-note-service');
const { authService } = await import('./auth-service');
import type { StickyNote } from '../types/sticky-note';
import type { User } from '../types';

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

beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_URL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 }))
  );

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
});

const sticky: StickyNote = {
  id: 1,
  userId: 1,
  title: 'Remember',
  description: 'Call the dentist',
  createdAt: '2026-01-01T00:00:00Z',
  editedAt: '2026-01-01T00:00:00Z',
};

describe('stickyNoteService.getStickyNotes', () => {
  it('gets all sticky notes and unwraps the list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [sticky], message: 'ok' })
    );

    const result = await stickyNoteService.getStickyNotes();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/sticky-notes`);
    expect(init?.method).toBeUndefined(); // defaults to GET
    expect(result).toEqual([sticky]);
  });

  it('returns [] when the list data is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(stickyNoteService.getStickyNotes()).resolves.toEqual([]);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(stickyNoteService.getStickyNotes()).rejects.toThrow(
      'Failed to fetch sticky notes'
    );
  });
});

describe('stickyNoteService.createStickyNote', () => {
  it('posts both fields when given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: sticky, message: 'ok' })
    );

    const result = await stickyNoteService.createStickyNote({
      title: 'Remember',
      description: 'Call the dentist',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/sticky-notes`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Remember',
      description: 'Call the dentist',
    });
    expect(result).toEqual(sticky);
  });

  it('serializes a title-only note with description omitted', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: sticky, message: 'ok' })
    );

    await stickyNoteService.createStickyNote({ title: 'Remember' });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ title: 'Remember' });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      stickyNoteService.createStickyNote({ title: 'Remember' })
    ).rejects.toThrow('Failed to create sticky note');
  });
});

describe('stickyNoteService.updateStickyNote', () => {
  it('puts only the fields that were provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: sticky, message: 'ok' })
    );

    const result = await stickyNoteService.updateStickyNote(1, {
      description: 'Call the doctor',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/sticky-notes/1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({
      description: 'Call the doctor',
    });
    expect(result).toEqual(sticky);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      stickyNoteService.updateStickyNote(1, { title: 'New title' })
    ).rejects.toThrow('Failed to update sticky note');
  });
});

describe('stickyNoteService.deleteStickyNote', () => {
  it('sends a DELETE and resolves to nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      stickyNoteService.deleteStickyNote(1)
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/sticky-notes/1`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(stickyNoteService.deleteStickyNote(1)).rejects.toThrow(
      'Failed to delete sticky note'
    );
  });
});
