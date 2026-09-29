package service

import (
	"fmt"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	activityModel "life-tracker-backend/internal/domain/activity/model"
	"life-tracker-backend/internal/domain/routine/dto"
	"life-tracker-backend/internal/domain/routine/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	testDB *gorm.DB
	cfg    *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()

	os.Exit(m.Run())
}

func setupTestDatabases(t *testing.T) {
	if testDB == nil {
		dsn := fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
		)

		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Silent),
		})
		require.NoError(t, err, "Failed to connect to PostgreSQL")

		sqlDB, err := db.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(1)

		require.NoError(t, db.AutoMigrate(&activityModel.Activity{}, &model.Routine{}, &model.RoutineActivity{}))
		testDB = db
	}
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE routine_activities, routines, activities RESTART IDENTITY CASCADE;").Error)
}

type testContext struct {
	service *RoutineService
	db      *gorm.DB
}

func getTestService(t *testing.T) *testContext {
	setupTestDatabases(t)
	cleanDatabase(t)
	return &testContext{
		service: NewRoutineService(testDB),
		db:      testDB,
	}
}

func (tc *testContext) createActivity(t *testing.T, userID uint, title string) activityModel.Activity {
	t.Helper()
	a := activityModel.Activity{
		UserID:           userID,
		Title:            title,
		Description:      "Description of " + title,
		Frequency:        activityModel.FrequencyDaily,
		DayTime:          activityModel.DayTimeMorning,
		CompletionAmount: 2,
		IsActive:         true,
		PrivacyStatus:    activityModel.PrivacyPrivate,
	}
	require.NoError(t, tc.db.Create(&a).Error)
	return a
}

func TestCreateRoutine(t *testing.T) {
	tc := getTestService(t)
	act1 := tc.createActivity(t, 1, "Training session")
	act2 := tc.createActivity(t, 1, "Walk 10 minutes")

	t.Run("creates routine with activity details", func(t *testing.T) {
		req := &dto.CreateRoutineRequest{
			Title:         "Health routine",
			Description:   "Daily health habits",
			PrivacyStatus: "private",
			ActivityIDs: []dto.ActivityIDPosition{
				{ActivityID: act1.ID, Position: 0},
				{ActivityID: act2.ID, Position: 1},
			},
		}

		routine, err := tc.service.CreateRoutine(1, req)
		require.NoError(t, err)
		assert.Equal(t, "Health routine", routine.Title)
		require.Len(t, routine.Activities, 2)
		assert.Equal(t, "active", routine.Status)

		first := routine.Activities[0]
		assert.Equal(t, act1.ID, first.ActivityID)
		assert.Equal(t, "Training session", first.ActivityTitle)
		assert.Equal(t, "Description of Training session", first.Description)
		assert.Equal(t, "daily", first.Frequency)
		assert.Equal(t, "morning", first.DayTime)
		assert.Equal(t, "private", first.PrivacyStatus)
		assert.Equal(t, 2, first.CompletionAmount)
		assert.Equal(t, 0, first.Position)

		assert.Equal(t, act2.ID, routine.Activities[1].ActivityID)
		assert.Equal(t, 1, routine.Activities[1].Position)
	})

	t.Run("rejects activities not owned by user", func(t *testing.T) {
		foreign := tc.createActivity(t, 99, "Foreign activity")
		req := &dto.CreateRoutineRequest{
			Title:         "Bad routine",
			PrivacyStatus: "private",
			ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: foreign.ID, Position: 0}},
		}
		_, err := tc.service.CreateRoutine(1, req)
		require.Error(t, err)
	})

	t.Run("rejects unknown activity ids", func(t *testing.T) {
		req := &dto.CreateRoutineRequest{
			Title:         "Bad routine",
			PrivacyStatus: "private",
			ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: 999999, Position: 0}},
		}
		_, err := tc.service.CreateRoutine(1, req)
		require.Error(t, err)
	})
}

func TestGetMyRoutinesAndDetails(t *testing.T) {
	tc := getTestService(t)
	act1 := tc.createActivity(t, 1, "Training session")
	act2 := tc.createActivity(t, 1, "Walk 10 minutes")

	req := &dto.CreateRoutineRequest{
		Title:         "Health routine",
		PrivacyStatus: "public",
		ActivityIDs: []dto.ActivityIDPosition{
			{ActivityID: act1.ID, Position: 0},
			{ActivityID: act2.ID, Position: 1},
		},
	}
	_, err := tc.service.CreateRoutine(1, req)
	require.NoError(t, err)

	routines, err := tc.service.GetMyRoutines(1)
	require.NoError(t, err)
	require.Len(t, routines, 1)
	require.Len(t, routines[0].Activities, 2)
	assert.Equal(t, "Walk 10 minutes", routines[0].Activities[1].ActivityTitle)

	foreignRoutines, err := tc.service.GetMyRoutines(2)
	require.NoError(t, err)
	assert.Empty(t, foreignRoutines)
}

func TestGetRoutineVisibility(t *testing.T) {
	tc := getTestService(t)
	act1 := tc.createActivity(t, 1, "Training session")

	publicReq := &dto.CreateRoutineRequest{
		Title:         "Public routine",
		PrivacyStatus: "public",
		ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: act1.ID, Position: 0}},
	}
	publicRoutine, err := tc.service.CreateRoutine(1, publicReq)
	require.NoError(t, err)

	privateReq := &dto.CreateRoutineRequest{
		Title:         "Private routine",
		PrivacyStatus: "private",
		ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: act1.ID, Position: 0}},
	}
	privateRoutine, err := tc.service.CreateRoutine(1, privateReq)
	require.NoError(t, err)

	t.Run("owner can fetch own routine", func(t *testing.T) {
		fetched, err := tc.service.GetRoutine(1, publicRoutine.ID)
		require.NoError(t, err)
		require.Len(t, fetched.Activities, 1)
		assert.Equal(t, "Training session", fetched.Activities[0].ActivityTitle)
	})

	t.Run("other user can fetch public routine", func(t *testing.T) {
		fetched, err := tc.service.GetRoutine(2, publicRoutine.ID)
		require.NoError(t, err)
		assert.Equal(t, publicRoutine.ID, fetched.ID)
	})

	t.Run("other user cannot fetch private routine", func(t *testing.T) {
		_, err := tc.service.GetRoutine(2, privateRoutine.ID)
		require.Error(t, err)
	})
}

func TestUpdateRoutine(t *testing.T) {
	tc := getTestService(t)
	act1 := tc.createActivity(t, 1, "Training session")
	act2 := tc.createActivity(t, 1, "Walk 10 minutes")
	act3 := tc.createActivity(t, 1, "Stretching")

	req := &dto.CreateRoutineRequest{
		Title:         "Health routine",
		PrivacyStatus: "private",
		ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: act1.ID, Position: 0}},
	}
	routine, err := tc.service.CreateRoutine(1, req)
	require.NoError(t, err)

	t.Run("updates status", func(t *testing.T) {
		status := "stopped"
		updateReq := &dto.UpdateRoutineRequest{Status: &status}
		updated, err := tc.service.UpdateRoutine(1, routine.ID, updateReq)
		require.NoError(t, err)
		assert.Equal(t, "stopped", updated.Status)
	})

	t.Run("updates fields and replaces activities", func(t *testing.T) {
		title := "Updated routine"
		privacy := "public"
		updateReq := &dto.UpdateRoutineRequest{
			Title:         &title,
			PrivacyStatus: &privacy,
			ActivityIDs: []dto.ActivityIDPosition{
				{ActivityID: act2.ID, Position: 0},
				{ActivityID: act3.ID, Position: 1},
			},
		}

		updated, err := tc.service.UpdateRoutine(1, routine.ID, updateReq)
		require.NoError(t, err)
		assert.Equal(t, "Updated routine", updated.Title)
		assert.Equal(t, "public", updated.PrivacyStatus)
		require.Len(t, updated.Activities, 2)
		assert.Equal(t, act2.ID, updated.Activities[0].ActivityID)
		assert.Equal(t, act3.ID, updated.Activities[1].ActivityID)
	})

	t.Run("rejects non-owner update", func(t *testing.T) {
		title := "Hacked"
		updateReq := &dto.UpdateRoutineRequest{Title: &title}
		_, err := tc.service.UpdateRoutine(99, routine.ID, updateReq)
		require.Error(t, err)
	})

	t.Run("rejects foreign activity in membership", func(t *testing.T) {
		foreign := tc.createActivity(t, 99, "Foreign")
		updateReq := &dto.UpdateRoutineRequest{
			ActivityIDs: []dto.ActivityIDPosition{{ActivityID: foreign.ID, Position: 0}},
		}
		_, err := tc.service.UpdateRoutine(1, routine.ID, updateReq)
		require.Error(t, err)
	})
}

func TestDeleteRoutine(t *testing.T) {
	tc := getTestService(t)
	act1 := tc.createActivity(t, 1, "Training session")

	req := &dto.CreateRoutineRequest{
		Title:         "Health routine",
		PrivacyStatus: "private",
		ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: act1.ID, Position: 0}},
	}
	routine, err := tc.service.CreateRoutine(1, req)
	require.NoError(t, err)

	t.Run("owner deletes routine but activity survives", func(t *testing.T) {
		require.NoError(t, tc.service.DeleteRoutine(1, routine.ID))

		var count int64
		require.NoError(t, tc.db.Model(&activityModel.Activity{}).Where("id = ?", act1.ID).Count(&count).Error)
		assert.Equal(t, int64(1), count)
	})

	t.Run("non-owner cannot delete", func(t *testing.T) {
		r2req := &dto.CreateRoutineRequest{
			Title:         "Another routine",
			PrivacyStatus: "private",
			ActivityIDs:   []dto.ActivityIDPosition{{ActivityID: act1.ID, Position: 0}},
		}
		r2, err := tc.service.CreateRoutine(1, r2req)
		require.NoError(t, err)
		require.Error(t, tc.service.DeleteRoutine(2, r2.ID))
	})
}
