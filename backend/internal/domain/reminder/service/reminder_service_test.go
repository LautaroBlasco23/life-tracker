package service

import (
	"fmt"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/reminder/dto"
	"life-tracker-backend/internal/domain/reminder/model"

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

	code := m.Run()
	os.Exit(code)
}

func setupTestDatabase(t *testing.T) {
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

	require.NoError(t, db.AutoMigrate(&model.Reminder{}))
	testDB = db

	require.NoError(t, db.Exec("TRUNCATE TABLE reminders RESTART IDENTITY CASCADE;").Error)
}

func newTestService(t *testing.T) *ReminderService {
	setupTestDatabase(t)
	return NewReminderService(testDB)
}

func TestCreateReminder(t *testing.T) {
	svc := newTestService(t)
	dueAt := time.Now().Add(48 * time.Hour)

	t.Run("creates reminder with default active window", func(t *testing.T) {
		reminder, err := svc.CreateReminder(1, &dto.CreateReminderRequest{
			Title: "Buy groceries",
			DueAt: dueAt,
		})
		require.NoError(t, err)
		assert.Equal(t, "Buy groceries", reminder.Title)
		assert.NotNil(t, reminder.ActiveFrom)
		assert.True(t, reminder.ActiveFrom.Before(reminder.DueAt))
		assert.Nil(t, reminder.CompletedAt)
		assert.Equal(t, "private", reminder.PrivacyStatus)
	})

	t.Run("creates reminder with explicit active window", func(t *testing.T) {
		activeFrom := time.Now().Add(24 * time.Hour)
		reminder, err := svc.CreateReminder(1, &dto.CreateReminderRequest{
			Title:      "Go to supermarket",
			DueAt:      dueAt,
			ActiveFrom: &activeFrom,
		})
		require.NoError(t, err)
		require.NotNil(t, reminder.ActiveFrom)
		assert.True(t, reminder.ActiveFrom.Equal(activeFrom))
	})

	t.Run("rejects window opening after deadline", func(t *testing.T) {
		activeFrom := time.Now().Add(72 * time.Hour)
		_, err := svc.CreateReminder(1, &dto.CreateReminderRequest{
			Title:      "Invalid",
			DueAt:      dueAt,
			ActiveFrom: &activeFrom,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "before the deadline")
	})
}

func TestGetUserReminders(t *testing.T) {
	svc := newTestService(t)
	dueAt := time.Now().Add(48 * time.Hour)

	_, err := svc.CreateReminder(2, &dto.CreateReminderRequest{Title: "One", DueAt: dueAt})
	require.NoError(t, err)
	_, err = svc.CreateReminder(2, &dto.CreateReminderRequest{Title: "Two", DueAt: dueAt})
	require.NoError(t, err)
	_, err = svc.CreateReminder(3, &dto.CreateReminderRequest{Title: "Other user", DueAt: dueAt})
	require.NoError(t, err)

	reminders, err := svc.GetUserReminders(2)
	require.NoError(t, err)
	require.Len(t, reminders, 2)
	for _, r := range reminders {
		assert.Equal(t, uint(2), r.UserID)
	}
}

func TestCompleteReminder(t *testing.T) {
	svc := newTestService(t)
	dueAt := time.Now().Add(48 * time.Hour)

	t.Run("completes active reminder and reverts", func(t *testing.T) {
		reminder, err := svc.CreateReminder(10, &dto.CreateReminderRequest{Title: "Task", DueAt: dueAt})
		require.NoError(t, err)

		completed, err := svc.CompleteReminder(10, reminder.ID)
		require.NoError(t, err)
		require.NotNil(t, completed.CompletedAt)

		err = svc.RevertCompletion(10, reminder.ID)
		require.NoError(t, err)

		reverted, err := svc.GetReminder(10, reminder.ID)
		require.NoError(t, err)
		assert.Nil(t, reverted.CompletedAt)
	})

	t.Run("rejects completion of locked reminder", func(t *testing.T) {
		activeFrom := time.Now().Add(24 * time.Hour)
		reminder, err := svc.CreateReminder(10, &dto.CreateReminderRequest{
			Title:      "Locked task",
			DueAt:      dueAt,
			ActiveFrom: &activeFrom,
		})
		require.NoError(t, err)

		_, err = svc.CompleteReminder(10, reminder.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not active yet")
	})

	t.Run("rejects double completion", func(t *testing.T) {
		reminder, err := svc.CreateReminder(10, &dto.CreateReminderRequest{Title: "Once", DueAt: dueAt})
		require.NoError(t, err)

		_, err = svc.CompleteReminder(10, reminder.ID)
		require.NoError(t, err)

		_, err = svc.CompleteReminder(10, reminder.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "already completed")
	})
}

func TestUpdateReminder(t *testing.T) {
	svc := newTestService(t)
	dueAt := time.Now().Add(48 * time.Hour)
	activeFrom := time.Now().Add(24 * time.Hour)

	reminder, err := svc.CreateReminder(20, &dto.CreateReminderRequest{
		Title:      "Original",
		DueAt:      dueAt,
		ActiveFrom: &activeFrom,
	})
	require.NoError(t, err)

	newTitle := "Updated"
	newDue := time.Now().Add(96 * time.Hour)
	updated, err := svc.UpdateReminder(20, reminder.ID, &dto.UpdateReminderRequest{
		Title: &newTitle,
		DueAt: &newDue,
	})
	require.NoError(t, err)
	assert.Equal(t, newTitle, updated.Title)
	// Postgres timestamptz keeps microseconds; compare within 1ms.
	assert.WithinDuration(t, newDue, updated.DueAt, time.Millisecond)

	t.Run("rejects window after deadline", func(t *testing.T) {
		badActive := time.Now().Add(200 * time.Hour)
		_, err := svc.UpdateReminder(20, reminder.ID, &dto.UpdateReminderRequest{ActiveFrom: &badActive})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "before the deadline")
	})
}

func TestDeleteReminder(t *testing.T) {
	svc := newTestService(t)
	dueAt := time.Now().Add(48 * time.Hour)

	reminder, err := svc.CreateReminder(30, &dto.CreateReminderRequest{Title: "Doomed", DueAt: dueAt})
	require.NoError(t, err)

	require.NoError(t, svc.DeleteReminder(30, reminder.ID))

	_, err = svc.GetReminder(30, reminder.ID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}
