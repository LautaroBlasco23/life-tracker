package model

import (
	"database/sql/driver"
	"fmt"
	"time"

	activityModel "life-tracker-backend/internal/domain/activity/model"

	"life-tracker-backend/internal/domain/routine/dto"

	"gorm.io/gorm"
)

type PrivacyStatus string

const (
	PrivacyPublic  PrivacyStatus = "public"
	PrivacyPrivate PrivacyStatus = "private"
)

type RoutineStatus string

const (
	StatusDraft   RoutineStatus = "draft"
	StatusActive  RoutineStatus = "active"
	StatusStopped RoutineStatus = "stopped"
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

type Routine struct {
	CreatedAt     time.Time             `json:"createdAt"`
	UpdatedAt     time.Time             `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt        `json:"-" gorm:"index"`
	Title         string                `json:"title" gorm:"not null;size:255"`
	Description   string                `json:"description" gorm:"type:text"`
	PrivacyStatus PrivacyStatus         `json:"privacyStatus" gorm:"not null;default:'private';size:20"`
	Status        RoutineStatus         `json:"status" gorm:"not null;default:'active';size:20"`
	DayTime       activityModel.DayTime `json:"dayTime" gorm:"not null;default:'notSpecified';size:20"`
	DayFrequency  string                `json:"dayFrequency,omitempty" gorm:"type:text"`
	ID            uint                  `json:"id" gorm:"primaryKey"`
	UserID        uint                  `json:"userId" gorm:"not null;index"`
}

type RoutineActivity struct {
	RoutineID  uint `json:"routineId"  gorm:"primaryKey;not null"`
	ActivityID uint `json:"activityId" gorm:"primaryKey;not null"`
	Position   int  `json:"position"   gorm:"not null"`
}

func (RoutineActivity) TableName() string { return "routine_activities" }

func (r *Routine) ToResponse(activities []dto.RoutineActivityItem) *dto.RoutineResponse {
	return &dto.RoutineResponse{
		ID:            r.ID,
		UserID:        r.UserID,
		Title:         r.Title,
		Description:   r.Description,
		PrivacyStatus: string(r.PrivacyStatus),
		Status:        string(r.Status),
		DayTime:       string(r.DayTime),
		DayFrequency:  r.DayFrequency,
		Activities:    activities,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}
