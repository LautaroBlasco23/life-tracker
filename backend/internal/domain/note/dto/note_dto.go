package dto

import "time"

type CreateNoteRequest struct {
	Title   string `json:"title" binding:"required,min=1,max=255"`
	// max=1000000: the column is unlimited Postgres text; the cap only
	// guards payload sanity (the 40MB global body limit is the real
	// ceiling). Note content may embed many image links, so it is generous.
	Content string `json:"content" binding:"max=1000000"`
}

type UpdateNoteRequest struct {
	Title   *string `json:"title,omitempty" binding:"omitempty,min=1,max=255"`
	Content *string `json:"content,omitempty" binding:"omitempty,max=1000000"`
}

type NotePositionItem struct {
	ID       uint  `json:"id" binding:"required"`
	GroupID  *uint `json:"groupId"`
	Position int   `json:"position"`
}

type ReorderNotesRequest struct {
	Items []NotePositionItem `json:"items" binding:"required,min=1,dive"`
}

type NoteResponse struct {
	CreatedAt time.Time `json:"createdAt"`
	EditedAt  time.Time `json:"editedAt"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	GroupID   *uint     `json:"groupId"`
	Position  int       `json:"position"`
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
}

type NoteFilter struct {
	Query string `form:"q"`
}
