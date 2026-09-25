package model

import (
	"database/sql/driver"
	"fmt"
	"time"

	"life-tracker-backend/internal/domain/reminder/dto"

	"gorm.io/gorm"
)

type PrivacyStatus string

const (
	PrivacyPublic  PrivacyStatus = "public"
	PrivacyPrivate PrivacyStatus = "private"
)

func (p *PrivacyStatus) Scan(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return fmt.Errorf("cannot scan type %T into PrivacyStatus", value)
	}
	*p = PrivacyStatus(str)
	return nil
}

func (p PrivacyStatus) Value() (driver.Value, error) {
	return string(p), nil
}

// Reminder is a one-time task with a completable window:
// locked before ActiveFrom, completable until DueAt, missed afterwards.
type Reminder struct {
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
	Title         string         `json:"title" gorm:"not null;size:255"`
	Description   string         `json:"description" gorm:"type:text"`
	ID            uint           `json:"id" gorm:"primaryKey"`
	UserID        uint           `json:"userId" gorm:"not null;index"`
	DueAt         time.Time      `json:"dueAt" gorm:"not null"`
	ActiveFrom    *time.Time     `json:"activeFrom,omitempty"`
	CompletedAt   *time.Time     `json:"completedAt,omitempty"`
	PrivacyStatus PrivacyStatus  `json:"privacyStatus" gorm:"not null;default:'private';size:20"`
}

func (r *Reminder) ToResponse() *dto.ReminderResponse {
	return &dto.ReminderResponse{
		ID:            r.ID,
		UserID:        r.UserID,
		Title:         r.Title,
		Description:   r.Description,
		DueAt:         r.DueAt,
		ActiveFrom:    r.ActiveFrom,
		CompletedAt:   r.CompletedAt,
		PrivacyStatus: string(r.PrivacyStatus),
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
