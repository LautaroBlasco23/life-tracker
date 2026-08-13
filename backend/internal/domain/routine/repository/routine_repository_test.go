package repository

import (
	"fmt"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/activity/model"
	routineModel "life-tracker-backend/internal/domain/routine/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	testDB  *gorm.DB
	testLoc *time.Location
	cfg     *config.Config
)

func TestMain(m *testing.M) {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
	testLoc = time.UTC

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

		require.NoError(t, db.AutoMigrate(&model.Activity{}, &routineModel.Routine{}, &routineModel.RoutineActivity{}))
		testDB = db
	}
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE routine_activities, routines, activities RESTART IDENTITY CASCADE;").Error)
}

type testContext struct {
	db *gorm.DB
}

func getTestRepository(t *testing.T) *testContext {
	setupTestDatabases(t)
	cleanDatabase(t)
	return &testContext{db: testDB}
}

func (tc *testContext) createActivity(t *testing.T, userID uint, title string) model.Activity {
	t.Helper()
	a := model.Activity{
		UserID:           userID,
		Title:            title,
		Frequency:        model.FrequencyDaily,
		DayTime:          model.DayTimeMorning,
		CompletionAmount: 1,
		IsActive:         true,
	}
	require.NoError(t, tc.db.Create(&a).Error)
	return a
}

func (tc *testContext) createRoutine(t *testing.T, userID uint, title string, activityIDs ...uint) routineModel.Routine {
	t.Helper()
	r := routineModel.Routine{
		UserID:        userID,
		Title:         title,
		PrivacyStatus: routineModel.PrivacyPrivate,
	}
	require.NoError(t, tc.db.Create(&r).Error)
	for pos, activityID := range activityIDs {
		item := routineModel.RoutineActivity{RoutineID: r.ID, ActivityID: activityID, Position: pos}
		require.NoError(t, tc.db.Create(&item).Error)
	}
	return r
}

func TestFindRoutinesByActivityIDs(t *testing.T) {
	tc := getTestRepository(t)
	repo := NewRoutineRepository(tc.db)

	act1 := tc.createActivity(t, 1, "Training session")
	act2 := tc.createActivity(t, 1, "Stretching")
	act3 := tc.createActivity(t, 2, "Someone else's activity")

	tc.createRoutine(t, 1, "Health routine", act1.ID, act2.ID)
	tc.createRoutine(t, 1, "Morning routine", act1.ID)

	t.Run("groups routines by activity ordered by title", func(t *testing.T) {
		result, err := repo.FindRoutinesByActivityIDs([]uint{act1.ID, act2.ID}, 1)
		require.NoError(t, err)

		require.Len(t, result[act1.ID], 2)
		assert.Equal(t, "Health routine", result[act1.ID][0].Title)
		assert.Equal(t, "Morning routine", result[act1.ID][1].Title)

		require.Len(t, result[act2.ID], 1)
		assert.Equal(t, "Health routine", result[act2.ID][0].Title)
	})

	t.Run("scopes by user", func(t *testing.T) {
		result, err := repo.FindRoutinesByActivityIDs([]uint{act3.ID}, 1)
		require.NoError(t, err)
		assert.Empty(t, result[act3.ID])
	})

	t.Run("excludes soft-deleted routines", func(t *testing.T) {
		deleted := tc.createRoutine(t, 1, "Deleted routine", act1.ID)
		require.NoError(t, tc.db.Delete(&routineModel.Routine{}, deleted.ID).Error)

		result, err := repo.FindRoutinesByActivityIDs([]uint{act1.ID}, 1)
		require.NoError(t, err)
		for _, ref := range result[act1.ID] {
			assert.NotEqual(t, deleted.ID, ref.ID)
		}
	})

	t.Run("empty ids returns empty map", func(t *testing.T) {
		result, err := repo.FindRoutinesByActivityIDs(nil, 1)
		require.NoError(t, err)
		assert.Empty(t, result)
	})
}

func TestRoutineCRUD(t *testing.T) {
	tc := getTestRepository(t)
	repo := NewRoutineRepository(tc.db)

	act1 := tc.createActivity(t, 1, "Walk")
	act2 := tc.createActivity(t, 1, "Read")

	t.Run("create and find by id", func(t *testing.T) {
		r := &routineModel.Routine{UserID: 1, Title: "Health", PrivacyStatus: routineModel.PrivacyPrivate}
		require.NoError(t, repo.Create(r))
		assert.NotZero(t, r.ID)

		require.NoError(t, repo.SetActivities(r.ID, []routineModel.RoutineActivity{
			{RoutineID: r.ID, ActivityID: act1.ID, Position: 0},
			{RoutineID: r.ID, ActivityID: act2.ID, Position: 1},
		}))

		found, err := repo.FindByID(r.ID, 1)
		require.NoError(t, err)
		assert.Equal(t, "Health", found.Title)

		items, err := repo.GetActivities(r.ID)
		require.NoError(t, err)
		require.Len(t, items, 2)
		assert.Equal(t, act1.ID, items[0].ActivityID)
		assert.Equal(t, act2.ID, items[1].ActivityID)
	})

	t.Run("find by id enforces user", func(t *testing.T) {
		r := tc.createRoutine(t, 1, "Private", act1.ID)
		_, err := repo.FindByID(r.ID, 99)
		assert.ErrorIs(t, err, ErrRoutineNotFound)
	})

	t.Run("find by id public returns routine regardless of user", func(t *testing.T) {
		r := tc.createRoutine(t, 1, "Public", act1.ID)
		found, err := repo.FindByIDPublic(r.ID)
		require.NoError(t, err)
		assert.Equal(t, r.ID, found.ID)
	})

	t.Run("set activities replaces membership", func(t *testing.T) {
		r := tc.createRoutine(t, 1, "Replaced", act1.ID)
		require.NoError(t, repo.SetActivities(r.ID, []routineModel.RoutineActivity{
			{RoutineID: r.ID, ActivityID: act2.ID, Position: 0},
		}))

		items, err := repo.GetActivities(r.ID)
		require.NoError(t, err)
		require.Len(t, items, 1)
		assert.Equal(t, act2.ID, items[0].ActivityID)
	})

	t.Run("delete removes routine", func(t *testing.T) {
		r := tc.createRoutine(t, 1, "Doomed", act1.ID)
		require.NoError(t, repo.Delete(r.ID, 1))
		_, err := repo.FindByID(r.ID, 1)
		assert.ErrorIs(t, err, ErrRoutineNotFound)
	})
}
