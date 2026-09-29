package dto

import "time"

type ActivityIDPosition struct {
	ActivityID uint `json:"activityId" binding:"required"`
	Position   int  `json:"position"`
}

type CreateRoutineRequest struct {
	Title         string               `json:"title" binding:"required,min=1,max=255"`
	Description   string               `json:"description" binding:"max=1000"`
	PrivacyStatus string               `json:"privacyStatus" binding:"required,oneof=public private"`
	Status        string               `json:"status" binding:"omitempty,oneof=draft active stopped"`
	DayTime       string               `json:"dayTime" binding:"omitempty,oneof=notSpecified morning afternoon evening"`
	DayFrequency  string               `json:"dayFrequency,omitempty"`
	ActivityIDs   []ActivityIDPosition `json:"activityIds" binding:"required,min=1"`
}

type UpdateRoutineRequest struct {
	Title         *string              `json:"title,omitempty" binding:"omitempty,min=1,max=255"`
	Description   *string              `json:"description,omitempty" binding:"omitempty,max=1000"`
	PrivacyStatus *string              `json:"privacyStatus,omitempty" binding:"omitempty,oneof=public private"`
	Status        *string              `json:"status,omitempty" binding:"omitempty,oneof=draft active stopped"`
	DayTime       *string              `json:"dayTime,omitempty" binding:"omitempty,oneof=notSpecified morning afternoon evening"`
	DayFrequency  *string              `json:"dayFrequency,omitempty"`
	ActivityIDs   []ActivityIDPosition `json:"activityIds,omitempty"`
}

type RoutineActivityItem struct {
	ActivityTitle    string `json:"activityTitle"`
	Description      string `json:"description"`
	Frequency        string `json:"frequency"`
	DayFrequency     string `json:"dayFrequency,omitempty"`
	DayTime          string `json:"dayTime"`
	PrivacyStatus    string `json:"privacyStatus"`
	CompletionAmount int    `json:"completionAmount"`
	ActivityID       uint   `json:"activityId"`
	Position         int    `json:"position"`
	TodayCompletions int    `json:"todayCompletions"`
	ScheduledToday   bool   `json:"scheduledToday"`
}

type RoutineRef struct {
	ID    uint   `json:"id"`
	Title string `json:"title"`
}

type RoutineResponse struct {
	CreatedAt        time.Time             `json:"createdAt"`
	UpdatedAt        time.Time             `json:"updatedAt"`
	Title            string                `json:"title"`
	Description      string                `json:"description"`
	PrivacyStatus    string                `json:"privacyStatus"`
	Status           string                `json:"status"`
	DayTime          string                `json:"dayTime"`
	DayFrequency     string                `json:"dayFrequency,omitempty"`
	Activities       []RoutineActivityItem `json:"activities"`
	IsCompletedToday bool                  `json:"isCompletedToday"`
	ID               uint                  `json:"id"`
	UserID           uint                  `json:"userId"`
}
