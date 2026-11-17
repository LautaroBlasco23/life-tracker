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

const { noteService } = await import('./note-service');
const { authService } = await import('./auth-service');
import type { Note } from '../types/note';
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

const note: Note = {
  id: 1,
  userId: 1,
  title: 'Groceries',
  content: 'Milk, eggs',
  groupId: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00Z',
  editedAt: '2026-01-01T00:00:00Z',
};

describe('noteService.getNotes', () => {
  it('gets all notes without a query string when no filter is given', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [note], message: 'ok' })
    );

    const result = await noteService.getNotes();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes`);
    expect(init?.method).toBeUndefined(); // defaults to GET
    expect(result).toEqual([note]);
  });

  it('adds the q param when the filter has a query', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [note], message: 'ok' })
    );

    await noteService.getNotes({ q: 'milk' });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes?q=milk`);
  });

  it('returns [] when the list data is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 0, data: null, message: 'ok' })
    );

    await expect(noteService.getNotes()).resolves.toEqual([]);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(noteService.getNotes()).rejects.toThrow(
      'Failed to fetch notes'
    );
  });
});

describe('noteService.searchNotes', () => {
  it('delegates to getNotes with the query as the q filter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ count: 1, data: [note], message: 'ok' })
    );

    const result = await noteService.searchNotes('milk');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes?q=milk`);
    expect(result).toEqual([note]);
  });
});

describe('noteService.getNote', () => {
  it('gets a single note by id and unwraps data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: note, message: 'ok' })
    );

    const result = await noteService.getNote(1);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes/1`);
    expect(result).toEqual(note);
  });

  it('throws the exact error when the note is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));

    await expect(noteService.getNote(999)).rejects.toThrow('Note not found');
  });
});

describe('noteService.createNote', () => {
  it('posts title and content and unwraps the created note', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: note, message: 'ok' })
    );

    const result = await noteService.createNote({
      title: 'Groceries',
      content: 'Milk, eggs',
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes`);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Groceries',
      content: 'Milk, eggs',
    });
    expect(result).toEqual(note);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteService.createNote({ title: 'Groceries', content: 'Milk, eggs' })
    ).rejects.toThrow('Failed to create note');
  });
});

describe('noteService.updateNote', () => {
  it('puts only the fields that were provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: note, message: 'ok' })
    );

    const result = await noteService.updateNote(1, { content: 'Milk' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes/1`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ content: 'Milk' });
    expect(result).toEqual(note);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteService.updateNote(1, { title: 'Shopping' })
    ).rejects.toThrow('Failed to update note');
  });
});

describe('noteService.uploadImage', () => {
  it('posts the file as multipart form data and resolves to its URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: { url: `${API_URL}/uploads/pic.png` }, message: 'ok' })
    );
    const file = new File(['bytes'], 'pic.png', { type: 'image/png' });

    const url = await noteService.uploadImage(file);

    const [requestUrl, init] = vi.mocked(fetch).mock.calls[0];
    expect(requestUrl).toBe(`${API_URL}/notes/images`);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('image')).toBe(file);
    // No manual Content-Type: the browser must set the multipart boundary.
    expect(init?.headers).not.toHaveProperty('Content-Type');
    expect(url).toBe(`${API_URL}/uploads/pic.png`);
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    const file = new File(['bytes'], 'pic.png', { type: 'image/png' });

    await expect(noteService.uploadImage(file)).rejects.toThrow(
      'Failed to upload image'
    );
  });
});

describe('noteService.deleteNote', () => {
  it('sends a DELETE and resolves to nothing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(noteService.deleteNote(1)).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes/1`);
    expect(init?.method).toBe('DELETE');
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(noteService.deleteNote(1)).rejects.toThrow(
      'Failed to delete note'
    );
  });
});

describe('noteService.reorderNotes', () => {
  it('posts the items wrapped in an items payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      noteService.reorderNotes([{ id: 1, groupId: null, position: 2 }])
    ).resolves.toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/notes/reorder`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      items: [{ id: 1, groupId: null, position: 2 }],
    });
  });

  it('throws the exact error on a failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));

    await expect(
      noteService.reorderNotes([{ id: 1, groupId: null, position: 2 }])
    ).rejects.toThrow('Failed to reorder notes');
  });
});
