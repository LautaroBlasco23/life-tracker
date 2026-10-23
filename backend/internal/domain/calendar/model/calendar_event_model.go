package model

import (
	"time"

	"life-tracker-backend/internal/domain/calendar/dto"

	"gorm.io/gorm"
)

// CalendarEvent is a scheduled time block on the user's week calendar.
// Unlike TimeRecord (a logged duration anchored at creation time), it has an
// explicit start and end and may lie in the future.
//
// Recurring events are materialized: every occurrence of a weekly series is
// its own row sharing a SeriesID. The recurrence columns stay NULL for
// one-off events.
type CalendarEvent struct {
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index"`
	Title              string         `json:"title" gorm:"not null;size:255"`
	Description        string         `json:"description" gorm:"type:text"`
	Category           string         `json:"category" gorm:"not null;size:100"`
	ID                 uint           `json:"id" gorm:"primaryKey"`
	UserID             uint           `json:"userId" gorm:"not null;index"`
	StartAt            time.Time      `json:"startAt" gorm:"not null"`
	EndAt              time.Time      `json:"endAt" gorm:"not null"`
	SeriesID           *string        `json:"seriesId,omitempty" gorm:"size:64;index"`
	OccurrenceIndex    *int           `json:"occurrenceIndex,omitempty"`
	RecurrenceRule     *string        `json:"recurrenceRule,omitempty" gorm:"size:20"`
	RecurrenceUntil    *time.Time     `json:"recurrenceUntil,omitempty"`
	RecurrenceInterval *int           `json:"recurrenceInterval,omitempty"`
}

func (e *CalendarEvent) ToResponse() *dto.CalendarEventResponse {
	return &dto.CalendarEventResponse{
		ID:                 e.ID,
		Title:              e.Title,
		Description:        e.Description,
		Category:           e.Category,
		StartAt:            e.StartAt,
		EndAt:              e.EndAt,
		CreatedAt:          e.CreatedAt,
		UpdatedAt:          e.UpdatedAt,
		SeriesID:           e.SeriesID,
		OccurrenceIndex:    e.OccurrenceIndex,
		RecurrenceRule:     e.RecurrenceRule,
		RecurrenceUntil:    e.RecurrenceUntil,
		RecurrenceInterval: e.RecurrenceInterval,
	}
}
