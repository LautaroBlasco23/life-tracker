import type {
  NoteGroup,
  CreateNoteGroupRequest,
  UpdateNoteGroupRequest,
  ReorderNoteGroupsRequestItem,
} from '../types/note';
import { authService } from './auth-service';
import { getConfig } from '../lib/config';

interface BackendListResponse<T> {
  count: number;
  data: T[] | null;
  message: string;
}

interface BackendSingleResponse<T> {
  data: T;
  message: string;
}

class NoteGroupService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getNoteGroups(): Promise<NoteGroup[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/note-groups`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch note groups');
    }

    const result: BackendListResponse<NoteGroup> = await response.json();
    return result.data ?? [];
  }

  async createNoteGroup(data: CreateNoteGroupRequest): Promise<NoteGroup> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/note-groups`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create note group');
    }

    const result: BackendSingleResponse<NoteGroup> = await response.json();
    return result.data;
  }

  async updateNoteGroup(id: number, data: UpdateNoteGroupRequest): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/note-groups/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update note group');
    }
  }

  async deleteNoteGroup(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/note-groups/${id}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete note group');
    }
  }

  async reorderNoteGroups(items: ReorderNoteGroupsRequestItem[]): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/note-groups/reorder`,
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to reorder note groups');
    }
  }
}

export const noteGroupService = new NoteGroupService();
