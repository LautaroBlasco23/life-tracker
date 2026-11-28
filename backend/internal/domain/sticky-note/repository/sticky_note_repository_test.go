// sticky_note_repository_test.go
//
// Subject:      internal/domain/sticky-note/repository.StickyNoteRepository against real PostgreSQL.
// Scope:        CRUD, ownership scoping (find/update/delete of other users'
//
//	notes are invisible/no-op), and list ordering.
//
// Out of scope: Service-layer orchestration → sticky_note_service_test.go;
//
//	HTTP contract → sticky_note_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  AutoMigrate + TRUNCATE sticky_notes (no DROP: sibling
//
//	packages run in parallel and use the same table).
//
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package repository

import (
	"fmt"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
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

func setupTestDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	if testDB != nil {
		return testDB
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
	return testDB
}

func getTestRepository(t *testing.T) (*StickyNoteRepository, *gorm.DB) {
	t.Helper()
	db := setupTestDatabase(t)
	require.NoError(t, db.Exec("TRUNCATE TABLE sticky_notes RESTART IDENTITY CASCADE").Error)
	return NewStickyNoteRepository(db), db
}

func TestStickyNoteRepository_CreateAndFindByID(t *testing.T) {
	repo, _ := getTestRepository(t)

	note := &model.StickyNote{UserID: 1, Title: "Ideas", Description: "Shower thoughts"}
	require.NoError(t, repo.Create(note))
	assert.NotZero(t, note.ID)

	t.Run("owner can find by id", func(t *testing.T) {
		found, err := repo.FindByID(note.ID, 1)
		require.NoError(t, err)
		assert.Equal(t, "Ideas", found.Title)
		assert.Equal(t, "Shower thoughts", found.Description)
	})

	t.Run("other user cannot find by id", func(t *testing.T) {
		_, err := repo.FindByID(note.ID, 2)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	t.Run("unknown id is not found", func(t *testing.T) {
		_, err := repo.FindByID(9999, 1)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

// TestStickyNoteRepository_FindByUserID verifies ownership scoping and the
// created_at DESC → id DESC ordering.
func TestStickyNoteRepository_FindByUserID(t *testing.T) {
	repo, db := getTestRepository(t)

	first := &model.StickyNote{UserID: 1, Title: "First"}
	require.NoError(t, repo.Create(first))
	second := &model.StickyNote{UserID: 1, Title: "Second"}
	require.NoError(t, repo.Create(second))
	require.NoError(t, repo.Create(&model.StickyNote{UserID: 2, Title: "Foreign"}))

	notes, err := repo.FindByUserID(1)
	require.NoError(t, err)
	require.Len(t, notes, 2)
	assert.Equal(t, "Second", notes[0].Title, "most recent first")
	assert.Equal(t, "First", notes[1].Title)

	foreignNotes, err := repo.FindByUserID(3)
	require.NoError(t, err)
	assert.Empty(t, foreignNotes)

	// created_at ties are broken by id DESC.
	require.NoError(t, db.Exec(
		"UPDATE sticky_notes SET created_at = NOW() WHERE id IN (?, ?)", first.ID, second.ID,
	).Error)
	tied, err := repo.FindByUserID(1)
	require.NoError(t, err)
	require.Len(t, tied, 2)
	assert.Equal(t, "Second", tied[0].Title, "id DESC tie-break")
}

func TestStickyNoteRepository_Update(t *testing.T) {
	repo, _ := getTestRepository(t)

	note := &model.StickyNote{UserID: 1, Title: "Original"}
	require.NoError(t, repo.Create(note))

	note.Title = "Renamed"
	note.Description = "Updated"
	require.NoError(t, repo.Update(note))

	found, err := repo.FindByID(note.ID, 1)
	require.NoError(t, err)
	assert.Equal(t, "Renamed", found.Title)
	assert.Equal(t, "Updated", found.Description)
}

func TestStickyNoteRepository_Delete(t *testing.T) {
	repo, _ := getTestRepository(t)

	t.Run("owner deletes the note", func(t *testing.T) {
		note := &model.StickyNote{UserID: 1, Title: "Doomed"}
		require.NoError(t, repo.Create(note))

		require.NoError(t, repo.Delete(note.ID, 1))

		_, err := repo.FindByID(note.ID, 1)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	t.Run("non-owned delete is a no-op", func(t *testing.T) {
		foreign := &model.StickyNote{UserID: 2, Title: "Foreign"}
		require.NoError(t, repo.Create(foreign))

		require.NoError(t, repo.Delete(foreign.ID, 1))

		found, err := repo.FindByID(foreign.ID, 2)
		require.NoError(t, err)
		assert.Equal(t, "Foreign", found.Title)
	})
}
