export interface Note {
  id: number;
  userId: number;
  title: string;
  content: string;
  createdAt: string;
  editedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  content: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
}

export interface NoteFilter extends Record<string, string | undefined> {
  q?: string;
}
