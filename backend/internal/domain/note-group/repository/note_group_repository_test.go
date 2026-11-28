// note_group_repository_test.go
//
// Subject:      internal/domain/note-group/repository.NoteGroupRepository against real PostgreSQL.
// Scope:        CRUD, ownership scoping, list ordering, transactional delete
//
//	with note unassignment, and reorder semantics.
//
// Out of scope: Service-layer orchestration → note_group_service_test.go;
//
//	HTTP contract → note_group_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  AutoMigrate + TRUNCATE note_groups and notes (no DROP:
//
//	sibling packages run in parallel and use the same tables).
//
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package repository

import (
	"fmt"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/note-group/dto"
	ngmodel "life-tracker-backend/internal/domain/note-group/model"
	nmodel "life-tracker-backend/internal/domain/note/model"

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

	require.NoError(t, db.AutoMigrate(&nmodel.Note{}, &ngmodel.NoteGroup{}))
	testDB = db
	return testDB
}

func getTestRepository(t *testing.T) (*NoteGroupRepository, *gorm.DB) {
	t.Helper()
	db := setupTestDatabase(t)
	require.NoError(t, db.Exec("TRUNCATE TABLE note_groups, notes RESTART IDENTITY CASCADE").Error)
	return NewNoteGroupRepository(db), db
}

func TestNoteGroupRepository_CreateAndFindByID(t *testing.T) {
	repo, _ := getTestRepository(t)

	group := &ngmodel.NoteGroup{UserID: 1, Name: "Work"}
	require.NoError(t, repo.Create(group))
	assert.NotZero(t, group.ID)

	t.Run("owner can find by id", func(t *testing.T) {
		found, err := repo.FindByID(group.ID, 1)
		require.NoError(t, err)
		assert.Equal(t, "Work", found.Name)
	})

	t.Run("other user cannot find by id", func(t *testing.T) {
		_, err := repo.FindByID(group.ID, 2)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})

	t.Run("unknown id is not found", func(t *testing.T) {
		_, err := repo.FindByID(9999, 1)
		require.Error(t, err)
		assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
	})
}

// TestNoteGroupRepository_FindByUserID verifies ownership scoping and the
// position ASC → created_at DESC → id DESC ordering.
func TestNoteGroupRepository_FindByUserID(t *testing.T) {
	repo, db := getTestRepository(t)

	first := &ngmodel.NoteGroup{UserID: 1, Name: "First"}
	require.NoError(t, repo.Create(first))
	require.NoError(t, repo.Create(&ngmodel.NoteGroup{UserID: 2, Name: "Foreign"}))
	second := &ngmodel.NoteGroup{UserID: 1, Name: "Second"}
	require.NoError(t, repo.Create(second))

	// Same created_at second would tie; force position order instead.
	require.NoError(t, db.Model(&ngmodel.NoteGroup{}).Where("id = ?", first.ID).Update("position", 2).Error)
	require.NoError(t, db.Model(&ngmodel.NoteGroup{}).Where("id = ?", second.ID).Update("position", 1).Error)

	groups, err := repo.FindByUserID(1)
	require.NoError(t, err)
	require.Len(t, groups, 2)
	assert.Equal(t, "Second", groups[0].Name, "lower position first")
	assert.Equal(t, "First", groups[1].Name)

	foreignGroups, err := repo.FindByUserID(3)
	require.NoError(t, err)
	assert.Empty(t, foreignGroups)
}

func TestNoteGroupRepository_Update(t *testing.T) {
	repo, _ := getTestRepository(t)

	group := &ngmodel.NoteGroup{UserID: 1, Name: "Original"}
	require.NoError(t, repo.Create(group))

	group.Name = "Renamed"
	require.NoError(t, repo.Update(group))

	found, err := repo.FindByID(group.ID, 1)
	require.NoError(t, err)
	assert.Equal(t, "Renamed", found.Name)
}

// TestNoteGroupRepository_Delete verifies the soft delete unassigns the
// group's notes in the same transaction instead of deleting them.
func TestNoteGroupRepository_Delete(t *testing.T) {
	repo, db := getTestRepository(t)

	group := &ngmodel.NoteGroup{UserID: 1, Name: "To Delete"}
	require.NoError(t, repo.Create(group))
	require.NoError(t, db.Create(&nmodel.Note{UserID: 1, Title: "In Group", GroupID: &group.ID}).Error)
	require.NoError(t, db.Create(&nmodel.Note{UserID: 1, Title: "Ungrouped"}).Error)

	require.NoError(t, repo.Delete(group.ID, 1))

	// The group is soft-deleted (invisible through GORM).
	_, err := repo.FindByID(group.ID, 1)
	require.Error(t, err)

	// Its notes survive unassigned.
	var unassigned int64
	require.NoError(t, db.Table("notes").
		Where("user_id = ? AND group_id IS NULL", 1).
		Count(&unassigned).Error)
	assert.Equal(t, int64(2), unassigned)

	// Non-owned delete is a no-op: the foreign group survives.
	foreign := &ngmodel.NoteGroup{UserID: 2, Name: "Foreign"}
	require.NoError(t, repo.Create(foreign))
	require.NoError(t, repo.Delete(foreign.ID, 1))
	found, err := repo.FindByID(foreign.ID, 2)
	require.NoError(t, err)
	assert.Equal(t, "Foreign", found.Name)
}

// TestNoteGroupRepository_Reorder verifies position updates and that rows not
// owned by the user are silently ignored.
func TestNoteGroupRepository_Reorder(t *testing.T) {
	repo, _ := getTestRepository(t)

	owned := &ngmodel.NoteGroup{UserID: 1, Name: "Owned"}
	require.NoError(t, repo.Create(owned))
	foreign := &ngmodel.NoteGroup{UserID: 2, Name: "Foreign"}
	require.NoError(t, repo.Create(foreign))

	err := repo.Reorder(1, []dto.NoteGroupPositionItem{
		{ID: owned.ID, Position: 7},
		{ID: foreign.ID, Position: 9}, // not owned — ignored
	})
	require.NoError(t, err)

	found, err := repo.FindByID(owned.ID, 1)
	require.NoError(t, err)
	assert.Equal(t, 7, found.Position)

	foreignFound, err := repo.FindByID(foreign.ID, 2)
	require.NoError(t, err)
	assert.Equal(t, 0, foreignFound.Position)
}
