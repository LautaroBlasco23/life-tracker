package model

import (
	"time"

	"life-tracker-backend/internal/domain/health/dto"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Exercise struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID       uint               `bson:"userId" json:"userId"`
	Name         string             `bson:"name" json:"name"`
	MuscleGroups []string           `bson:"muscleGroups" json:"muscleGroups"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
}

func (e *Exercise) ToResponse() *dto.ExerciseResponse {
	return &dto.ExerciseResponse{
		ID:           e.ID.Hex(),
		UserID:       e.UserID,
		Name:         e.Name,
		MuscleGroups: e.MuscleGroups,
		CreatedAt:    e.CreatedAt,
	}
}
