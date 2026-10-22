// sticky_note_service_test.go
//
// Subject:      internal/domain/sticky-note/service.StickyNoteService against real PostgreSQL.
// Scope:        CRUD, optional title/description, ownership scoping.
// Out of scope: HTTP contract → sticky_note_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  TRUNCATE sticky_notes before each top-level test function.
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package service

import (
	"fmt"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/sticky-note/dto"
	"life-tracker-backend/internal/domain/sticky-note/model"

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

	require.NoError(t, db.AutoMigrate(&model.StickyNote{}))
	testDB = db
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE sticky_notes RESTART IDENTITY CASCADE;").Error)
}

func getTestService(t *testing.T) *StickyNoteService {
	t.Helper()
	setupTestDatabase(t)
	cleanDatabase(t)
	return NewStickyNoteService(testDB)
}

func strPtr(s string) *string { return &s }

// TestCreateStickyNoteOptionalFields verifies a sticky note can carry only a
// title, only a description, or both.
func TestCreateStickyNoteOptionalFields(t *testing.T) {
	svc := getTestService(t)
	userID := uint(10)

	titleOnly, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{
		Title: strPtr("Buy milk"),
	})
	assert.NoError(t, err)
	require.NotNil(t, titleOnly)
	assert.Equal(t, "Buy milk", titleOnly.Title)
	assert.Equal(t, "", titleOnly.Description)
	assert.NotZero(t, titleOnly.ID)

	descOnly, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{
		Description: strPtr("Call the plumber"),
	})
	assert.NoError(t, err)
	assert.Equal(t, "", descOnly.Title)
	assert.Equal(t, "Call the plumber", descOnly.Description)

	both, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{
		Title:       strPtr("Groceries"),
		Description: strPtr("Eggs, bread"),
	})
	assert.NoError(t, err)
	assert.Equal(t, "Groceries", both.Title)
	assert.Equal(t, "Eggs, bread", both.Description)
}

// TestCreateAndGetStickyNotes verifies listing scope: other users' sticky notes
// are invisible, and the newest note comes first.
func TestCreateAndGetStickyNotes(t *testing.T) {
	svc := getTestService(t)
	userID := uint(11)

	first, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{Title: strPtr("First")})
	require.NoError(t, err)
	second, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{Title: strPtr("Second")})
	require.NoError(t, err)

	notes, err := svc.GetStickyNotes(userID)
	assert.NoError(t, err)
	require.Len(t, notes, 2)
	assert.Equal(t, second.ID, notes[0].ID, "newest sticky note first")
	assert.Equal(t, first.ID, notes[1].ID)

	otherNotes, err := svc.GetStickyNotes(999)
	assert.NoError(t, err)
	assert.Empty(t, otherNotes)
}

// TestUpdateStickyNote verifies partial updates (title, description) and
// ownership enforcement.
func TestUpdateStickyNote(t *testing.T) {
	svc := getTestService(t)
	userID := uint(12)

	note, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{Title: strPtr("Original")})
	require.NoError(t, err)

	newTitle := "Renamed"
	newDesc := "Updated description"

	updated, err := svc.UpdateStickyNote(note.ID, userID, &dto.UpdateStickyNoteRequest{
		Title:       &newTitle,
		Description: &newDesc,
	})
	assert.NoError(t, err)
	assert.Equal(t, "Renamed", updated.Title)
	assert.Equal(t, "Updated description", updated.Description)

	// Partial update: only the title changes, the description stays untouched.
	newerTitle := "Renamed again"
	partial, err := svc.UpdateStickyNote(note.ID, userID, &dto.UpdateStickyNoteRequest{Title: &newerTitle})
	assert.NoError(t, err)
	assert.Equal(t, "Renamed again", partial.Title)
	assert.Equal(t, "Updated description", partial.Description)

	_, err = svc.UpdateStickyNote(note.ID, 999, &dto.UpdateStickyNoteRequest{Title: &newTitle})
	assert.ErrorIs(t, err, ErrStickyNoteNotFound)
}

// TestDeleteStickyNote verifies soft deletion and not-found on repeat.
func TestDeleteStickyNote(t *testing.T) {
	svc := getTestService(t)
	userID := uint(13)

	note, err := svc.CreateStickyNote(userID, &dto.CreateStickyNoteRequest{Title: strPtr("To Delete")})
	require.NoError(t, err)

	err = svc.DeleteStickyNote(note.ID, userID)
	assert.NoError(t, err)

	_, err = svc.GetStickyNote(note.ID, userID)
	assert.ErrorIs(t, err, ErrStickyNoteNotFound)

	err = svc.DeleteStickyNote(note.ID, userID)
	assert.ErrorIs(t, err, ErrStickyNoteNotFound)
}
