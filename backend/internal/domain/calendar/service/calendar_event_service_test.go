// calendar_event_service_test.go
//
// Subject: internal/domain/calendar/service.CalendarService against real PostgreSQL.
// Scope:   interval validation, CRUD, ownership, and range listing.
// Out of scope: overlap SQL correctness → calendar_event_repository_test.go
//
//	HTTP contract → calendar_event_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy: TRUNCATE calendar_events before each top-level test function.
// Parallel-safe: no — single shared DB connection, no per-test namespace.
package service

import (
	"fmt"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/calendar/dto"
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

	require.NoError(t, db.AutoMigrate(&model.CalendarEvent{}))
	testDB = db
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE calendar_events RESTART IDENTITY CASCADE;").Error)
}

func getTestService(t *testing.T) *CalendarService {
	t.Helper()
	setupTestDatabase(t)
	cleanDatabase(t)
	return NewCalendarService(testDB)
}

func baseRequest() *dto.CreateCalendarEventRequest {
	return &dto.CreateCalendarEventRequest{
		Title:       "English class",
		Description: "B2 conversation",
		Category:    "Study",
		StartAt:     time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:       time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
}

func TestCreateEvent(t *testing.T) {
	svc := getTestService(t)

	tests := []struct {
		name    string
		mutate  func(*dto.CreateCalendarEventRequest)
		wantErr bool
	}{
		{
			name:   "valid_interval_is_persisted",
			mutate: func(*dto.CreateCalendarEventRequest) {},
		},
		{
			name:    "zero_length_rejected",
			mutate:  func(r *dto.CreateCalendarEventRequest) { r.EndAt = r.StartAt },
			wantErr: true,
		},
		{
			name: "reversed_interval_rejected",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(-time.Hour)
			},
			wantErr: true,
		},
		{
			name: "longer_than_24h_rejected",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(25 * time.Hour)
			},
			wantErr: true,
		},
		{
			name: "exactly_24h_allowed",
			mutate: func(r *dto.CreateCalendarEventRequest) {
				r.EndAt = r.StartAt.Add(24 * time.Hour)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := baseRequest()
			tt.mutate(req)

			resp, err := svc.CreateEvent(7, req)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, resp)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, resp)
			assert.NotZero(t, resp.ID)
			assert.Equal(t, req.Title, resp.Title)
			assert.True(t, req.StartAt.Equal(resp.StartAt))
			assert.True(t, req.EndAt.Equal(resp.EndAt))
		})
	}
}

func TestGetEventsRangeAndIsolation(t *testing.T) {
	svc := getTestService(t)
	userID := uint(42)

	seeds := []*dto.CreateCalendarEventRequest{
		{Title: "monday", Category: "Study", StartAt: time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC)},
		{Title: "next-week", Category: "Study", StartAt: time.Date(2026, time.October, 27, 10, 0, 0, 0, time.UTC), EndAt: time.Date(2026, time.October, 27, 12, 0, 0, 0, time.UTC)},
	}
	for _, seed := range seeds {
		_, err := svc.CreateEvent(userID, seed)
		require.NoError(t, err)
	}

	foreign := &dto.CreateCalendarEventRequest{
		Title:    "foreign",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	_, err := svc.CreateEvent(uint(43), foreign)
	require.NoError(t, err)

	from := time.Date(2026, time.October, 19, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 7)

	t.Run("range_filter_returns_overlapping_event", func(t *testing.T) {
		resp, err := svc.GetEvents(userID, &dto.CalendarEventFilter{From: &from, To: &to})
		require.NoError(t, err)
		require.Len(t, resp, 1)
		assert.Equal(t, "monday", resp[0].Title)
	})

	t.Run("no_filter_returns_all_user_events", func(t *testing.T) {
		resp, err := svc.GetEvents(userID, nil)
		require.NoError(t, err)
		assert.Len(t, resp, 2)
	})

	t.Run("other_user_is_isolated", func(t *testing.T) {
		resp, err := svc.GetEvents(uint(99), nil)
		require.NoError(t, err)
		assert.Empty(t, resp)
	})
}

func TestUpdateEvent(t *testing.T) {
	svc := getTestService(t)
	userID := uint(50)

	created, err := svc.CreateEvent(userID, baseRequest())
	require.NoError(t, err)

	t.Run("partial_update_keeps_other_fields", func(t *testing.T) {
		title := "English class (moved)"
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{Title: &title})
		require.NoError(t, err)
		assert.Equal(t, title, resp.Title)
		assert.True(t, created.StartAt.Equal(resp.StartAt))
	})

	t.Run("empty_update_is_a_noop", func(t *testing.T) {
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{})
		require.NoError(t, err)
		assert.Equal(t, created.ID, resp.ID)
	})

	t.Run("invalid_merged_interval_rejected", func(t *testing.T) {
		newStart := created.EndAt.Add(time.Hour)
		resp, err := svc.UpdateEvent(userID, created.ID, &dto.UpdateCalendarEventRequest{StartAt: &newStart})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})

	t.Run("foreign_user_cannot_update", func(t *testing.T) {
		title := "hijacked"
		resp, err := svc.UpdateEvent(uint(51), created.ID, &dto.UpdateCalendarEventRequest{Title: &title})
		assert.Error(t, err)
		assert.Nil(t, resp)
	})
}

func TestDeleteEvent(t *testing.T) {
	svc := getTestService(t)
	userID := uint(60)

	created, err := svc.CreateEvent(userID, baseRequest())
	require.NoError(t, err)

	assert.Error(t, svc.DeleteEvent(uint(61), created.ID))
	assert.NoError(t, svc.DeleteEvent(userID, created.ID))

	resp, err := svc.GetEvent(userID, created.ID)
	assert.Error(t, err)
	assert.Nil(t, resp)
}
