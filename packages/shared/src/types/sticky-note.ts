export interface StickyNote {
  id: number;
  userId: number;
  title: string;
  description: string;
  createdAt: string;
  editedAt: string;
}

/** Every field is optional: a sticky note may hold only a title or a description. */
export interface CreateStickyNoteRequest {
  title?: string;
  description?: string;
}

export interface UpdateStickyNoteRequest {
  title?: string;
  description?: string;
}
