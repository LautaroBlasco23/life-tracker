// health_service_test.go
//
// Subject:      internal/domain/health/service.{MealLogService,ExerciseService,WorkoutService}
//
//	against real MongoDB.
//
// Scope:        Meal log CRUD + validation + daily summary aggregation, exercise
//
//	catalog CRUD + validation, workout session CRUD + gym stats (muscle volume,
//	weekly volume).
//
// Infrastructure: MongoDB (test database via .env.test). Collections dropped between tests.
// Data strategy:  Drop all collections before each top-level test function.
// Parallel-safe:  No — shared MongoDB database, global drop between tests.
package service

import (
	"context"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/health/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	testMongoDB *mongo.Database
	mongoClient *mongo.Client
	healthCfg   *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	healthCfg = config.Load()
	code := m.Run()
	if mongoClient != nil {
		_ = mongoClient.Disconnect(context.Background())
	}
	os.Exit(code)
}

func setupHealthTestDatabase(t *testing.T) {
	t.Helper()
	if testMongoDB != nil {
		return
	}

	ctx := context.Background()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(healthCfg.MongoURI))
	require.NoError(t, err)
	require.NoError(t, client.Ping(ctx, nil), "MongoDB not available")

	testMongoDB = client.Database(healthCfg.MongoDatabase)
	mongoClient = client
}

func cleanHealthDatabase(t *testing.T) {
	t.Helper()
	collections, _ := testMongoDB.ListCollectionNames(context.Background(), bson.M{})
	for _, coll := range collections {
		_ = testMongoDB.Collection(coll).Drop(context.Background())
	}
}

func getHealthServices(t *testing.T) (*MealLogService, *ExerciseService, *WorkoutService) {
	t.Helper()
	setupHealthTestDatabase(t)
	cleanHealthDatabase(t)

	// Mirror production: unique (userId, name) constraint on exercises.
	_, err := testMongoDB.Collection("exercises").Indexes().CreateOne(
		context.Background(),
		mongo.IndexModel{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "name", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	)
	require.NoError(t, err)

	return NewMealLogService(testMongoDB), NewExerciseService(testMongoDB), NewWorkoutService(testMongoDB)
}

func TestCreateMealLogValidation(t *testing.T) {
	mealSvc, _, _ := getHealthServices(t)

	t.Run("invalid_meal_type_rejected", func(t *testing.T) {
		_, err := mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "brunch",
			Name:     "Test meal",
			Calories: 500,
		})
		assert.ErrorContains(t, err, "invalid meal type")
	})

	t.Run("valid_meal_created_with_default_date", func(t *testing.T) {
		meal, err := mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "lunch",
			Name:     "Chicken bowl",
			Calories: 650,
			Protein:  45,
			Carbs:    60,
			Fat:      20,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, meal.ID)
		assert.Equal(t, "lunch", meal.MealType)
		assert.False(t, meal.Date.IsZero())
	})
}

func TestMealLogCRUDAndSummary(t *testing.T) {
	mealSvc, _, _ := getHealthServices(t)
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	require.NoError(t, err)

	t.Run("create_update_delete_meal", func(t *testing.T) {
		meal, err := mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "breakfast",
			Name:     "Oats",
			Calories: 300,
			Protein:  10,
			Carbs:    50,
			Fat:      6,
		})
		require.NoError(t, err)

		calories := 350.0
		updated, err := mealSvc.UpdateMealLog(1, meal.ID, &dto.UpdateMealLogRequest{
			Calories: &calories,
		})
		require.NoError(t, err)
		assert.Equal(t, 350.0, updated.Calories)
		assert.Equal(t, "Oats", updated.Name)

		require.NoError(t, mealSvc.DeleteMealLog(1, meal.ID))
		_, err = mealSvc.GetMealLog(1, meal.ID)
		assert.ErrorContains(t, err, "not found")
	})

	t.Run("summary_aggregates_daily_totals", func(t *testing.T) {
		date := time.Now().In(loc)
		dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, loc)
		// Two meals the same day, one meal the previous day.
		_, err := mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "lunch", Name: "Bowl A", Calories: 500, Protein: 30,
			Date: dayStart.Add(10 * time.Hour),
		})
		require.NoError(t, err)
		_, err = mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "dinner", Name: "Bowl B", Calories: 700, Protein: 40,
			Date: dayStart.Add(20 * time.Hour),
		})
		require.NoError(t, err)
		_, err = mealSvc.CreateMealLog(1, &dto.CreateMealLogRequest{
			MealType: "snack", Name: "Yesterday", Calories: 200,
			Date: dayStart.Add(-24 * time.Hour),
		})
		require.NoError(t, err)

		start := dayStart.Add(-24 * time.Hour)
		summary, err := mealSvc.GetNutritionSummary(1, start, dayStart, loc)
		require.NoError(t, err)
		require.Len(t, summary.Daily, 2)
		// Totals include yesterday's snack (200 kcal) plus today's two meals.
		assert.Equal(t, 500.0+700.0+200.0, summary.Totals.Calories)
		assert.Equal(t, 30.0+40.0, summary.Totals.Protein)
		assert.Equal(t, int64(3), summary.Totals.MealCount)
		// Last daily entry is today: 1200 kcal across two meals.
		assert.Equal(t, 500.0+700.0, summary.Daily[1].Calories)
		assert.Equal(t, int64(2), summary.Daily[1].MealCount)
	})
}

func TestExerciseService(t *testing.T) {
	_, exerciseSvc, _ := getHealthServices(t)

	t.Run("invalid_muscle_group_rejected", func(t *testing.T) {
		_, err := exerciseSvc.CreateExercise(1, &dto.CreateExerciseRequest{
			Name:         "Bad Exercise",
			MuscleGroups: []string{"wings"},
		})
		assert.ErrorContains(t, err, "invalid muscle group")
	})

	t.Run("create_and_list_exercises_scoped_to_user", func(t *testing.T) {
		ex, err := exerciseSvc.CreateExercise(1, &dto.CreateExerciseRequest{
			Name:         "Bench Press",
			MuscleGroups: []string{"chest", "triceps"},
		})
		require.NoError(t, err)
		assert.NotEmpty(t, ex.ID)

		ex2, err := exerciseSvc.CreateExercise(2, &dto.CreateExerciseRequest{
			Name:         "Bench Press",
			MuscleGroups: []string{"chest"},
		})
		require.NoError(t, err)
		assert.NotEmpty(t, ex2.ID)

		user1, err := exerciseSvc.GetExercises(1)
		require.NoError(t, err)
		require.Len(t, user1, 1)
		assert.Equal(t, "Bench Press", user1[0].Name)
	})

	t.Run("duplicate_name_same_user_rejected", func(t *testing.T) {
		_, err := exerciseSvc.CreateExercise(3, &dto.CreateExerciseRequest{
			Name:         "Squat",
			MuscleGroups: []string{"quads"},
		})
		require.NoError(t, err)

		_, err = exerciseSvc.CreateExercise(3, &dto.CreateExerciseRequest{
			Name:         "Squat",
			MuscleGroups: []string{"quads", "glutes"},
		})
		assert.ErrorContains(t, err, "already exists")
	})
}

func TestWorkoutService(t *testing.T) {
	_, exerciseSvc, workoutSvc := getHealthServices(t)
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	require.NoError(t, err)

	t.Run("create_workout_requires_existing_exercise", func(t *testing.T) {
		_, err := workoutSvc.CreateWorkoutSession(1, &dto.CreateWorkoutSessionRequest{
			Exercises: []dto.SessionExerciseRequest{
				{ExerciseID: "507f1f77bcf86cd799439011", Sets: []dto.CreateSetRequest{{Reps: 10, WeightKg: 20}}},
			},
		})
		assert.ErrorContains(t, err, "not found")
	})

	t.Run("gym_stats_compute_muscle_and_weekly_volume", func(t *testing.T) {
		bench, err := exerciseSvc.CreateExercise(1, &dto.CreateExerciseRequest{
			Name:         "Bench Press",
			MuscleGroups: []string{"chest", "triceps"},
		})
		require.NoError(t, err)
		row, err := exerciseSvc.CreateExercise(1, &dto.CreateExerciseRequest{
			Name:         "Barbell Row",
			MuscleGroups: []string{"back", "biceps"},
		})
		require.NoError(t, err)

		now := time.Now().In(loc)
		today := time.Date(now.Year(), now.Month(), now.Day(), 12, 0, 0, 0, loc)
		lastWeek := today.AddDate(0, 0, -7)

		_, err = workoutSvc.CreateWorkoutSession(1, &dto.CreateWorkoutSessionRequest{
			Date: today,
			Exercises: []dto.SessionExerciseRequest{
				{
					ExerciseID: bench.ID,
					Sets: []dto.CreateSetRequest{
						{Reps: 10, WeightKg: 60},
						{Reps: 8, WeightKg: 60},
					},
				},
				{
					ExerciseID: row.ID,
					Sets:       []dto.CreateSetRequest{{Reps: 10, WeightKg: 40}},
				},
			},
		})
		require.NoError(t, err)

		_, err = workoutSvc.CreateWorkoutSession(1, &dto.CreateWorkoutSessionRequest{
			Date: lastWeek,
			Exercises: []dto.SessionExerciseRequest{
				{
					ExerciseID: bench.ID,
					Sets:       []dto.CreateSetRequest{{Reps: 10, WeightKg: 50}},
				},
			},
		})
		require.NoError(t, err)

		stats, err := workoutSvc.GetGymStats(1, lastWeek, today, loc)
		require.NoError(t, err)
		assert.Equal(t, 2, stats.WorkoutCount)
		require.Len(t, stats.WeeklyVolume, 2) // two distinct weeks

		volumeByMuscle := map[string]float64{}
		for _, mv := range stats.MuscleVolume {
			volumeByMuscle[mv.MuscleGroup] = mv.VolumeKg
		}
		// Chest and triceps: 60*10 + 60*8 (today) + 50*10 (last week) = 1080 + 500 = 1580.
		assert.InDelta(t, 1580, volumeByMuscle["chest"], 0.001)
		assert.InDelta(t, 1580, volumeByMuscle["triceps"], 0.001)
		assert.InDelta(t, 400, volumeByMuscle["back"], 0.001)
		assert.Equal(t, 2, muscleSessionsCount(stats, "chest"))
		assert.Equal(t, 1, muscleSessionsCount(stats, "back"))
	})

	t.Run("deleted_exercise_skipped_in_stats", func(t *testing.T) {
		ex, err := exerciseSvc.CreateExercise(4, &dto.CreateExerciseRequest{
			Name:         "Curl",
			MuscleGroups: []string{"biceps"},
		})
		require.NoError(t, err)
		_, err = workoutSvc.CreateWorkoutSession(4, &dto.CreateWorkoutSessionRequest{
			Exercises: []dto.SessionExerciseRequest{
				{ExerciseID: ex.ID, Sets: []dto.CreateSetRequest{{Reps: 12, WeightKg: 10}}},
			},
		})
		require.NoError(t, err)
		require.NoError(t, exerciseSvc.DeleteExercise(4, ex.ID))

		now := time.Now()
		stats, err := workoutSvc.GetGymStats(4, now, now, time.UTC)
		require.NoError(t, err)
		assert.Equal(t, 1, stats.WorkoutCount)
		assert.Empty(t, stats.MuscleVolume)
	})
}

func muscleSessionsCount(stats *dto.GymStatsResponse, muscle string) int {
	for _, mv := range stats.MuscleVolume {
		if mv.MuscleGroup == muscle {
			return mv.Sessions
		}
	}
	return 0
}
