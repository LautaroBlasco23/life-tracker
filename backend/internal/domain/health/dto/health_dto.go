package dto

import "time"

// Nutrition

type CreateMealLogRequest struct {
	MealType string    `json:"mealType" binding:"required"`
	Name     string    `json:"name" binding:"required,max=200"`
	Calories float64   `json:"calories" binding:"gte=0"`
	Protein  float64   `json:"protein" binding:"gte=0"`
	Carbs    float64   `json:"carbs" binding:"gte=0"`
	Fat      float64   `json:"fat" binding:"gte=0"`
	Date     time.Time `json:"date,omitempty"`
}

type UpdateMealLogRequest struct {
	MealType *string    `json:"mealType,omitempty"`
	Name     *string    `json:"name,omitempty" binding:"omitempty,max=200"`
	Calories *float64   `json:"calories,omitempty" binding:"omitempty,gte=0"`
	Protein  *float64   `json:"protein,omitempty" binding:"omitempty,gte=0"`
	Carbs    *float64   `json:"carbs,omitempty" binding:"omitempty,gte=0"`
	Fat      *float64   `json:"fat,omitempty" binding:"omitempty,gte=0"`
	Date     *time.Time `json:"date,omitempty"`
}

type MealLogResponse struct {
	ID        string    `json:"id"`
	UserID    uint      `json:"userId"`
	MealType  string    `json:"mealType"`
	Name      string    `json:"name"`
	Calories  float64   `json:"calories"`
	Protein   float64   `json:"protein"`
	Carbs     float64   `json:"carbs"`
	Fat       float64   `json:"fat"`
	Date      time.Time `json:"date"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type DailyNutritionSummary struct {
	Date      string  `json:"date"` // YYYY-MM-DD in the user's timezone
	Calories  float64 `json:"calories"`
	Protein   float64 `json:"protein"`
	Carbs     float64 `json:"carbs"`
	Fat       float64 `json:"fat"`
	MealCount int64   `json:"mealCount"`
}

type NutritionSummaryResponse struct {
	StartDate string                  `json:"startDate"`
	EndDate   string                  `json:"endDate"`
	Daily     []DailyNutritionSummary `json:"daily"`
	Totals    DailyNutritionSummary   `json:"totals"`
}

// Gym — exercises

type CreateExerciseRequest struct {
	Name         string   `json:"name" binding:"required,max=100"`
	MuscleGroups []string `json:"muscleGroups" binding:"required,min=1,dive,required"`
}

type UpdateExerciseRequest struct {
	Name         *string   `json:"name,omitempty" binding:"omitempty,max=100"`
	MuscleGroups *[]string `json:"muscleGroups,omitempty" binding:"omitempty,min=1,dive,required"`
}

type ExerciseResponse struct {
	ID           string    `json:"id"`
	UserID       uint      `json:"userId"`
	Name         string    `json:"name"`
	MuscleGroups []string  `json:"muscleGroups"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Gym — workout sessions

type CreateSetRequest struct {
	Reps     int     `json:"reps" binding:"required,gt=0"`
	WeightKg float64 `json:"weightKg" binding:"gte=0"`
}

type SessionExerciseRequest struct {
	ExerciseID string             `json:"exerciseId" binding:"required"`
	Sets       []CreateSetRequest `json:"sets" binding:"required,min=1,dive"`
}

type CreateWorkoutSessionRequest struct {
	Date            time.Time                `json:"date,omitempty"`
	DurationMinutes *int                     `json:"durationMinutes,omitempty" binding:"omitempty,gt=0"`
	Notes           string                   `json:"notes,omitempty" binding:"max=500"`
	Exercises       []SessionExerciseRequest `json:"exercises" binding:"required,min=1"`
}

type UpdateWorkoutSessionRequest struct {
	Date            *time.Time                `json:"date,omitempty"`
	DurationMinutes *int                      `json:"durationMinutes,omitempty" binding:"omitempty,gt=0"`
	Notes           *string                   `json:"notes,omitempty" binding:"omitempty,max=500"`
	Exercises       *[]SessionExerciseRequest `json:"exercises,omitempty" binding:"omitempty,min=1"`
}

type SetResponse struct {
	Reps     int     `json:"reps"`
	WeightKg float64 `json:"weightKg"`
}

type SessionExerciseResponse struct {
	ExerciseID string        `json:"exerciseId"`
	Sets       []SetResponse `json:"sets"`
}

type WorkoutSessionResponse struct {
	ID              string                    `json:"id"`
	UserID          uint                      `json:"userId"`
	Date            time.Time                 `json:"date"`
	DurationMinutes *int                      `json:"durationMinutes,omitempty"`
	Notes           string                    `json:"notes,omitempty"`
	Exercises       []SessionExerciseResponse `json:"exercises"`
	CreatedAt       time.Time                 `json:"createdAt"`
	UpdatedAt       time.Time                 `json:"updatedAt"`
}

type MuscleVolume struct {
	MuscleGroup string  `json:"muscleGroup"`
	VolumeKg    float64 `json:"volumeKg"`
	Sessions    int     `json:"sessions"`
}

type WeeklyVolume struct {
	WeekStart string  `json:"weekStart"` // YYYY-MM-DD (Monday) in the user's timezone
	VolumeKg  float64 `json:"volumeKg"`
}

type GymStatsResponse struct {
	StartDate    string         `json:"startDate"`
	EndDate      string         `json:"endDate"`
	WorkoutCount int            `json:"workoutCount"`
	MuscleVolume []MuscleVolume `json:"muscleVolume"`
	WeeklyVolume []WeeklyVolume `json:"weeklyVolume"`
}
