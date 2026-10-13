export interface Note {
  id: number;
  userId: number;
  title: string;
  content: string;
  groupId: number | null;
  position: number;
  createdAt: string;
  editedAt: string;
}

export interface NoteGroup {
  id: number;
  userId: number;
  name: string;
  position: number;
  createdAt: string;
  editedAt: string;
}

export interface CreateNoteGroupRequest {
  name: string;
}

export interface UpdateNoteGroupRequest {
  name?: string;
}

export interface ReorderNotesRequestItem {
  id: number;
  /** Null moves the note back to the ungrouped section. */
  groupId: number | null;
  position: number;
}

export interface ReorderNoteGroupsRequestItem {
  id: number;
  position: number;
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
