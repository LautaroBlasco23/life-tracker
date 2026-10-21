// calendar_event_repository_test.go
//
// Subject: internal/domain/calendar/repository.CalendarEventRepository against real PostgreSQL.
// Scope:   SQL correctness for calendar event CRUD, overlap range filtering, and ownership.
// Out of scope:
//   - service-layer business rules  → calendar_event_service_test.go (unit)
//   - HTTP contract                 → calendar_event_controller_test.go (unit)
//
// Infrastructure: PostgreSQL (test database), schema via AutoMigrate.
// Data strategy: TRUNCATE TABLE after each test, single test DB connection.
// Parallel-safe: no — shared testDB with sequential cleanup.
package repository

import (
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/calendar/model"

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

func setupTestDatabase(t *testing.T) {
	t.Helper()
	if testDB != nil {
		return
	}

	dsn := "host=" + cfg.DBHost + " port=" + cfg.DBPort + " user=" + cfg.DBUser +
		" password=" + cfg.DBPassword + " dbname=" + cfg.DBName + " sslmode=" + cfg.DBSSLMode

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(&model.CalendarEvent{}))
	testDB = db
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE calendar_events RESTART IDENTITY CASCADE;").Error)
}

func getTestRepository(t *testing.T) CalendarEventRepository {
	setupTestDatabase(t)
	cleanDatabase(t)
	return NewCalendarEventRepository(testDB)
}

func at(hour, minute int) time.Time {
	return time.Date(2026, time.October, 19, hour, minute, 0, 0, time.UTC)
}

func createTestEvent(t *testing.T, repo CalendarEventRepository, userID uint, title string, start, end time.Time) *model.CalendarEvent {
	t.Helper()
	event := &model.CalendarEvent{
		UserID:   userID,
		Title:    title,
		Category: "Study",
		StartAt:  start,
		EndAt:    end,
	}
	require.NoError(t, repo.Create(event))
	return event
}

// TestFindByUserIDRange verifies the half-open overlap rule used by the week
// view: events that merely touch the range boundary are excluded, events that
// cross it are included.
func TestFindByUserIDRange(t *testing.T) {
	repo := getTestRepository(t)
	userID := uint(1)

	from := at(0, 0)            // Monday 00:00
	to := from.AddDate(0, 0, 7) // next Monday 00:00

	createTestEvent(t, repo, userID, "inside", at(10, 0), at(12, 0))
	createTestEvent(t, repo, userID, "crossing-start", from.Add(-2*time.Hour), at(1, 0))
	createTestEvent(t, repo, userID, "crossing-end", from.AddDate(0, 0, 6).Add(23*time.Hour), to.Add(time.Hour))
	touchingStart := createTestEvent(t, repo, userID, "touching-start", from.Add(-2*time.Hour), from)
	touchingEnd := createTestEvent(t, repo, userID, "touching-end", to, to.Add(2*time.Hour))
	createTestEvent(t, repo, uint(2), "other-user", at(10, 0), at(11, 0))

	deleted := createTestEvent(t, repo, userID, "deleted", at(14, 0), at(15, 0))
	require.NoError(t, repo.Delete(deleted.ID, userID))

	events, err := repo.FindByUserID(userID, &CalendarEventFilter{From: &from, To: &to})
	require.NoError(t, err)

	titles := make([]string, len(events))
	for i, event := range events {
		titles[i] = event.Title
	}

	assert.Equal(t, []string{"crossing-start", "inside", "crossing-end"}, titles)
	assert.NotContains(t, titles, touchingStart.Title)
	assert.NotContains(t, titles, touchingEnd.Title)
}

// TestFindByUserIDNoFilter verifies ordering and user isolation without a range.
func TestFindByUserIDNoFilter(t *testing.T) {
	repo := getTestRepository(t)
	userID := uint(10)

	createTestEvent(t, repo, userID, "second", at(12, 0), at(13, 0))
	createTestEvent(t, repo, userID, "first", at(8, 0), at(9, 0))
	createTestEvent(t, repo, uint(11), "foreign", at(8, 0), at(9, 0))

	events, err := repo.FindByUserID(userID, nil)
	require.NoError(t, err)
	require.Len(t, events, 2)
	assert.Equal(t, "first", events[0].Title)
	assert.Equal(t, "second", events[1].Title)
}

// TestDeleteEnforcesOwnership verifies a foreign event cannot be deleted.
func TestDeleteEnforcesOwnership(t *testing.T) {
	repo := getTestRepository(t)
	event := createTestEvent(t, repo, uint(20), "mine", at(8, 0), at(9, 0))

	assert.ErrorIs(t, repo.Delete(event.ID, uint(21)), ErrCalendarEventNotFound)
	assert.NoError(t, repo.Delete(event.ID, uint(20)))
}

// TestUpdatePersistsChanges verifies the partial update map is applied.
func TestUpdatePersistsChanges(t *testing.T) {
	repo := getTestRepository(t)
	event := createTestEvent(t, repo, uint(30), "original", at(8, 0), at(9, 0))

	require.NoError(t, repo.Update(event, map[string]interface{}{
		"title":    "renamed",
		"start_at": at(9, 30),
	}))

	updated, err := repo.FindByID(event.ID, uint(30))
	require.NoError(t, err)
	assert.Equal(t, "renamed", updated.Title)
	assert.True(t, at(9, 30).Equal(updated.StartAt))
	assert.True(t, at(9, 0).Equal(updated.EndAt))
}
