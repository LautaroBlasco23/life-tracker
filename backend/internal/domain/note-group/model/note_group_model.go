package model

import (
	"time"

	"life-tracker-backend/internal/domain/note-group/dto"

	"gorm.io/gorm"
)

type NoteGroup struct {
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	Name      string         `json:"name" gorm:"not null;size:255"`
	Position  int            `json:"-" gorm:"not null;default:0"`
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    uint           `json:"userId" gorm:"not null;index"`
}

func (g *NoteGroup) ToResponse() *dto.NoteGroupResponse {
	return &dto.NoteGroupResponse{
		ID:        g.ID,
		UserID:    g.UserID,
		Name:      g.Name,
		Position:  g.Position,
		CreatedAt: g.CreatedAt,
		EditedAt:  g.UpdatedAt,
	}
}
