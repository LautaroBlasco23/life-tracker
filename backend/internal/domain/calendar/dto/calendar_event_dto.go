package dto

import "time"

type CreateCalendarEventRequest struct {
	Title       string    `json:"title" binding:"required,min=1,max=255"`
	Description string    `json:"description" binding:"max=1000"`
	Category    string    `json:"category" binding:"required,min=1,max=100"`
	StartAt     time.Time `json:"startAt" binding:"required"`
	EndAt       time.Time `json:"endAt" binding:"required"`
}

type UpdateCalendarEventRequest struct {
	Title       *string    `json:"title,omitempty" binding:"omitempty,min=1,max=255"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=1000"`
	Category    *string    `json:"category,omitempty" binding:"omitempty,min=1,max=100"`
	StartAt     *time.Time `json:"startAt,omitempty"`
	EndAt       *time.Time `json:"endAt,omitempty"`
}

type CalendarEventResponse struct {
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	StartAt     time.Time `json:"startAt"`
	EndAt       time.Time `json:"endAt"`
	ID          uint      `json:"id"`
}

// CalendarEventFilter selects events overlapping [From, To). Both bounds are
// optional; callers always pass either both or neither.
type CalendarEventFilter struct {
	From *time.Time
	To   *time.Time
}
