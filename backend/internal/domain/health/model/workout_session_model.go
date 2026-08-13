package model

import (
	"time"

	"life-tracker-backend/internal/domain/health/dto"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WorkoutSet struct {
	Reps     int     `bson:"reps" json:"reps"`
	WeightKg float64 `bson:"weightKg" json:"weightKg"`
}

type SessionExercise struct {
	ExerciseID primitive.ObjectID `bson:"exerciseId" json:"exerciseId"`
	Sets       []WorkoutSet       `bson:"sets" json:"sets"`
}

type WorkoutSession struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          uint               `bson:"userId" json:"userId"`
	Date            time.Time          `bson:"date" json:"date"`
	DurationMinutes *int               `bson:"durationMinutes,omitempty" json:"durationMinutes,omitempty"`
	Notes           string             `bson:"notes,omitempty" json:"notes,omitempty"`
	Exercises       []SessionExercise  `bson:"exercises" json:"exercises"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func (w *WorkoutSession) ToResponse() *dto.WorkoutSessionResponse {
	response := &dto.WorkoutSessionResponse{
		ID:              w.ID.Hex(),
		UserID:          w.UserID,
		Date:            w.Date,
		DurationMinutes: w.DurationMinutes,
		Notes:           w.Notes,
		Exercises:       make([]dto.SessionExerciseResponse, 0, len(w.Exercises)),
		CreatedAt:       w.CreatedAt,
		UpdatedAt:       w.UpdatedAt,
	}
	for _, se := range w.Exercises {
		sets := make([]dto.SetResponse, 0, len(se.Sets))
		for _, set := range se.Sets {
			sets = append(sets, dto.SetResponse{Reps: set.Reps, WeightKg: set.WeightKg})
		}
		response.Exercises = append(response.Exercises, dto.SessionExerciseResponse{
			ExerciseID: se.ExerciseID.Hex(),
			Sets:       sets,
		})
	}
	return response
}
