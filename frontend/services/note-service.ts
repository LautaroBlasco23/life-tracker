import type {
  Note,
  CreateNoteRequest,
  UpdateNoteRequest,
  NoteFilter,
} from '@/types/note';
import { authService } from './auth-service';
import { getConfig } from '@/lib/config';

interface BackendListResponse<T> {
  count: number;
  data: T[] | null;
  message: string;
}

interface BackendSingleResponse<T> {
  data: T;
  message: string;
}

class NoteService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  private buildQueryString(filter?: NoteFilter): string {
    if (!filter) return '';

    const params = new URLSearchParams();

    if (filter.q) params.set('q', filter.q);

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  async getNotes(filter?: NoteFilter): Promise<Note[]> {
    const queryString = this.buildQueryString(filter);
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/notes${queryString}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch notes');
    }

    const result: BackendListResponse<Note> = await response.json();
    return result.data ?? [];
  }

  async searchNotes(query: string): Promise<Note[]> {
    return this.getNotes({ q: query });
  }

  async getNote(id: number): Promise<Note> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/notes/${id}`
    );

    if (!response.ok) {
      throw new Error('Note not found');
    }

    const result: BackendSingleResponse<Note> = await response.json();
    return result.data;
  }

  async createNote(data: CreateNoteRequest): Promise<Note> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/notes`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create note');
    }

    const result: BackendSingleResponse<Note> = await response.json();
    return result.data;
  }

  async updateNote(id: number, data: UpdateNoteRequest): Promise<Note> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/notes/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update note');
    }

    const result: BackendSingleResponse<Note> = await response.json();
    return result.data;
  }

  async deleteNote(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/notes/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete note');
    }
  }
}

export const noteService = new NoteService();
