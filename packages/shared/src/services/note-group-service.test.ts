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

const { noteGroupService } = await import('./note-group-service');
const { authService } = await import('./auth-service');
import type { NoteGroup } from '../types/note';
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

const group: NoteGroup = {
  id: 1,
  userId: 1,
  name: 'Work',
  position: 0,
  createdAt: '2026-01-01T00:00:00Z',
  editedAt: '2026-01-01T00:00:00Z',
};

describe('noteGroupService.getNoteGroups', () => {
  it('gets all note groups and unwraps the list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [group], message: 'ok' })
    );

    const result = await noteGroupService.getNoteGroups();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/note-groups`);
    expect(init?.method).toBeUndefined(); // defaults to GET
    expect(result).toEqual([group]);
  });

  it('returns [] when the list data is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(noteGroupService.getNoteGroups()).resolves.toEqual([]);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(noteGroupService.getNoteGroups()).rejects.toThrow(
      'Failed to fetch note groups'
    );
  });
});

describe('noteGroupService.createNoteGroup', () => {
  it('posts the name and unwraps the created group', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: group, message: 'ok' })
    );

    const result = await noteGroupService.createNoteGroup({ name: 'Work' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/note-groups`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Work' });
    expect(result).toEqual(group);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteGroupService.createNoteGroup({ name: 'Work' })
    ).rejects.toThrow('Failed to create note group');
  });
});

describe('noteGroupService.updateNoteGroup', () => {
  it('puts the fields that were provided and resolves to nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      noteGroupService.updateNoteGroup(1, { name: 'Personal' })
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/note-groups/1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Personal' });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteGroupService.updateNoteGroup(1, { name: 'Personal' })
    ).rejects.toThrow('Failed to update note group');
  });
});

describe('noteGroupService.deleteNoteGroup', () => {
  it('sends a DELETE and resolves to nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(noteGroupService.deleteNoteGroup(1)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/note-groups/1`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(noteGroupService.deleteNoteGroup(1)).rejects.toThrow(
      'Failed to delete note group'
    );
  });
});

describe('noteGroupService.reorderNoteGroups', () => {
  it('posts the items wrapped in an items payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      noteGroupService.reorderNoteGroups([
        { id: 2, position: 0 },
        { id: 1, position: 1 },
      ])
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/note-groups/reorder`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      items: [
        { id: 2, position: 0 },
        { id: 1, position: 1 },
      ],
    });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteGroupService.reorderNoteGroups([{ id: 1, position: 0 }])
    ).rejects.toThrow('Failed to reorder note groups');
  });
});
