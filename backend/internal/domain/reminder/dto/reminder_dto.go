package dto

import (
	"time"
)

type CreateReminderRequest struct {
	Title         string     `json:"title" binding:"required,min=1,max=255"`
	Description   string     `json:"description" binding:"max=1000"`
	DueAt         time.Time  `json:"dueAt" binding:"required"`
	ActiveFrom    *time.Time `json:"activeFrom,omitempty"`
	PrivacyStatus string     `json:"privacyStatus,omitempty" binding:"omitempty,oneof=public private"`
}

type UpdateReminderRequest struct {
	Title         *string    `json:"title,omitempty" binding:"omitempty,min=1,max=255"`
	Description   *string    `json:"description,omitempty" binding:"omitempty,max=1000"`
	DueAt         *time.Time `json:"dueAt,omitempty" binding:"omitempty"`
	ActiveFrom    *time.Time `json:"activeFrom,omitempty"`
	PrivacyStatus *string    `json:"privacyStatus,omitempty" binding:"omitempty,oneof=public private"`
}

type ReminderResponse struct {
	ID            uint       `json:"id"`
	UserID        uint       `json:"userId"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	DueAt         time.Time  `json:"dueAt"`
	ActiveFrom    *time.Time `json:"activeFrom,omitempty"`
	CompletedAt   *time.Time `json:"completedAt,omitempty"`
	PrivacyStatus string     `json:"privacyStatus"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}
