package model

import (
	"time"

	"life-tracker-backend/internal/domain/sticky-note/dto"

	"gorm.io/gorm"
)

type StickyNote struct {
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	Title       string         `json:"title" gorm:"not null;size:255"`
	Description string         `json:"description" gorm:"type:text"`
	ID          uint           `json:"id" gorm:"primaryKey"`
	UserID      uint           `json:"userId" gorm:"not null;index"`
}

func (s *StickyNote) ToResponse() *dto.StickyNoteResponse {
	return &dto.StickyNoteResponse{
		ID:          s.ID,
		UserID:      s.UserID,
		Title:       s.Title,
		Description: s.Description,
		CreatedAt:   s.CreatedAt,
		EditedAt:    s.UpdatedAt,
	}
}
