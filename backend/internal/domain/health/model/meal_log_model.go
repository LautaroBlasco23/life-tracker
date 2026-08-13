package model

import (
	"time"

	"life-tracker-backend/internal/domain/health/dto"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MealLog struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    uint               `bson:"userId" json:"userId"`
	MealType  string             `bson:"mealType" json:"mealType"`
	Name      string             `bson:"name" json:"name"`
	Calories  float64            `bson:"calories" json:"calories"`
	Protein   float64            `bson:"protein" json:"protein"`
	Carbs     float64            `bson:"carbs" json:"carbs"`
	Fat       float64            `bson:"fat" json:"fat"`
	Date      time.Time          `bson:"date" json:"date"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

func (m *MealLog) ToResponse() *dto.MealLogResponse {
	return &dto.MealLogResponse{
		ID:        m.ID.Hex(),
		UserID:    m.UserID,
		MealType:  m.MealType,
		Name:      m.Name,
		Calories:  m.Calories,
		Protein:   m.Protein,
		Carbs:     m.Carbs,
		Fat:       m.Fat,
		Date:      m.Date,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}
