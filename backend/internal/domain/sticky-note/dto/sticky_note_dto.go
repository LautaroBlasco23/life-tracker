package dto

import "time"

// CreateStickyNoteRequest has no required fields: a sticky note may carry only
// a title, only a description, or both.
type CreateStickyNoteRequest struct {
	Title       *string `json:"title,omitempty" binding:"omitempty,max=255"`
	Description *string `json:"description,omitempty" binding:"omitempty,max=10000"`
}

type UpdateStickyNoteRequest struct {
	Title       *string `json:"title,omitempty" binding:"omitempty,max=255"`
	Description *string `json:"description,omitempty" binding:"omitempty,max=10000"`
}

type StickyNoteResponse struct {
	CreatedAt   time.Time `json:"createdAt"`
	EditedAt    time.Time `json:"editedAt"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	ID          uint      `json:"id"`
	UserID      uint      `json:"userId"`
}
