package dto

import (
	activityDTO "life-tracker-backend/internal/domain/activity/dto"
	routineDTO "life-tracker-backend/internal/domain/routine/dto"
	userDTO "life-tracker-backend/internal/domain/user/dto"
)

// PublicProfileResponse is the public profile of another user. Content is only
// populated when the viewer may view it (public profile or accepted follow);
// the shell (card + counts) is always returned.
type PublicProfileResponse struct {
	userDTO.PublicUserCard
	FollowersCount        int64                `json:"followersCount"`
	FollowingCount        int64                `json:"followingCount"`
	PublicRoutinesCount   int64                `json:"publicRoutinesCount"`
	PublicActivitiesCount int64                `json:"publicActivitiesCount"`
	CanViewContent        bool                 `json:"canViewContent"`
	Routines              []PublicRoutineCard  `json:"routines"`
	Activities            []PublicActivityCard `json:"activities"`
}

type PublicRoutineCard struct {
	ID          uint                             `json:"id"`
	Title       string                           `json:"title"`
	Description string                           `json:"description"`
	Streak      *activityDTO.StreakInfo          `json:"streak,omitempty"`
	Activities  []routineDTO.RoutineActivityItem `json:"activities"`
	Subscribed  bool                             `json:"subscribed"`
}

type PublicActivityCard struct {
	ID               uint                    `json:"id"`
	Title            string                  `json:"title"`
	Description      string                  `json:"description"`
	Frequency        string                  `json:"frequency"`
	DayFrequency     string                  `json:"dayFrequency,omitempty"`
	DayTime          string                  `json:"dayTime"`
	CompletionAmount int                     `json:"completionAmount"`
	Streak           *activityDTO.StreakInfo `json:"streak,omitempty"`
	Subscribed       bool                    `json:"subscribed"`
}
