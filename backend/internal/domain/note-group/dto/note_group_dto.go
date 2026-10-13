package dto

import "time"

type CreateNoteGroupRequest struct {
	Name string `json:"name" binding:"required,min=1,max=255"`
}

type UpdateNoteGroupRequest struct {
	Name *string `json:"name,omitempty" binding:"omitempty,min=1,max=255"`
}

type NoteGroupPositionItem struct {
	ID       uint `json:"id" binding:"required"`
	Position int  `json:"position"`
}

type ReorderNoteGroupsRequest struct {
	Items []NoteGroupPositionItem `json:"items" binding:"required,min=1,dive"`
}

type NoteGroupResponse struct {
	CreatedAt time.Time `json:"createdAt"`
	EditedAt  time.Time `json:"editedAt"`
	Name      string    `json:"name"`
	Position  int       `json:"position"`
	ID        uint      `json:"id"`
	UserID    uint      `json:"userId"`
}
