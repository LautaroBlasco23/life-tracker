import type {
  StickyNote,
  CreateStickyNoteRequest,
  UpdateStickyNoteRequest,
} from "../types/sticky-note";
import { authService } from "./auth-service";
import { getConfig } from "../lib/config";

interface BackendListResponse<T> {
  count: number;
  data: T[] | null;
  message: string;
}

interface BackendSingleResponse<T> {
  data: T;
  message: string;
}

class StickyNoteService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  async getStickyNotes(): Promise<StickyNote[]> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/sticky-notes`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch sticky notes");
    }

    const result: BackendListResponse<StickyNote> = await response.json();
    return result.data ?? [];
  }

  async createStickyNote(data: CreateStickyNoteRequest): Promise<StickyNote> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/sticky-notes`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to create sticky note");
    }

    const result: BackendSingleResponse<StickyNote> = await response.json();
    return result.data;
  }

  async updateStickyNote(
    id: number,
    data: UpdateStickyNoteRequest,
  ): Promise<StickyNote> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/sticky-notes/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update sticky note");
    }

    const result: BackendSingleResponse<StickyNote> = await response.json();
    return result.data;
  }

  async deleteStickyNote(id: number): Promise<void> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/sticky-notes/${id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete sticky note");
    }
  }
}

export const stickyNoteService = new StickyNoteService();
