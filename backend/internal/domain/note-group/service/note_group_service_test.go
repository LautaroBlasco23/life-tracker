// note_group_service_test.go
//
// Subject:      internal/domain/note-group/service.NoteGroupService against real PostgreSQL.
// Scope:        CRUD operations, delete with note-unassignment, reordering.
// Out of scope: HTTP contract → note_group_controller_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  TRUNCATE note_groups + notes before each top-level test function.
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package service

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

	require.NoError(t, db.AutoMigrate(&nmodel.Note{}, &ngmodel.NoteGroup{}))
	testDB = db
}

func cleanDatabase(t *testing.T) {
	t.Helper()
	require.NoError(t, testDB.Exec("TRUNCATE TABLE note_groups, notes RESTART IDENTITY CASCADE;").Error)
}

func getTestService(t *testing.T) *NoteGroupService {
	t.Helper()
	setupTestDatabase(t)
	cleanDatabase(t)
	return NewNoteGroupService(testDB)
}

func seedNote(t *testing.T, userID uint, title string, groupID *uint) {
	t.Helper()
	note := &nmodel.Note{UserID: userID, Title: title, GroupID: groupID}
	require.NoError(t, testDB.Create(note).Error)
}

// TestCreateAndGetNoteGroups verifies creation, listing scope, and that
// groups of other users are invisible.
func TestCreateAndGetNoteGroups(t *testing.T) {
	svc := getTestService(t)
	userID := uint(10)

	created, err := svc.CreateNoteGroup(userID, &dto.CreateNoteGroupRequest{Name: "Work"})
	assert.NoError(t, err)
	require.NotNil(t, created)
	assert.Equal(t, "Work", created.Name)
	assert.Equal(t, 0, created.Position)
	assert.NotZero(t, created.ID)

	_, err = svc.CreateNoteGroup(userID, &dto.CreateNoteGroupRequest{Name: "Personal"})
	require.NoError(t, err)

	groups, err := svc.GetNoteGroups(userID)
	assert.NoError(t, err)
	assert.Len(t, groups, 2)

	otherGroups, err := svc.GetNoteGroups(999)
	assert.NoError(t, err)
	assert.Empty(t, otherGroups)
}

// TestUpdateNoteGroup verifies patching and ownership enforcement.
func TestUpdateNoteGroup(t *testing.T) {
	svc := getTestService(t)
	userID := uint(11)

	group, err := svc.CreateNoteGroup(userID, &dto.CreateNoteGroupRequest{Name: "Original"})
	require.NoError(t, err)

	newName := "Renamed"
	resp, err := svc.UpdateNoteGroup(group.ID, userID, &dto.UpdateNoteGroupRequest{Name: &newName})
	assert.NoError(t, err)
	assert.Equal(t, "Renamed", resp.Name)

	_, err = svc.UpdateNoteGroup(group.ID, 999, &dto.UpdateNoteGroupRequest{Name: &newName})
	assert.ErrorIs(t, err, ErrNoteGroupNotFound)
}

// TestDeleteNoteGroup verifies the group is soft-deleted and its notes are
// unassigned (returning to the ungrouped section), not deleted.
func TestDeleteNoteGroup(t *testing.T) {
	svc := getTestService(t)
	userID := uint(12)

	group, err := svc.CreateNoteGroup(userID, &dto.CreateNoteGroupRequest{Name: "To Delete"})
	require.NoError(t, err)
	seedNote(t, userID, "In Group", &group.ID)
	seedNote(t, userID, "Ungrouped", nil)

	err = svc.DeleteNoteGroup(group.ID, userID)
	assert.NoError(t, err)

	// Group is no longer retrievable.
	_, err = svc.GetNoteGroup(group.ID, userID)
	assert.ErrorIs(t, err, ErrNoteGroupNotFound)

	// Its notes survive unassigned.
	var unassigned int64
	require.NoError(t, testDB.Table("notes").
		Where("user_id = ? AND group_id IS NULL", userID).
		Count(&unassigned).Error)
	assert.Equal(t, int64(2), unassigned)

	// Deleting again reports not-found.
	err = svc.DeleteNoteGroup(group.ID, userID)
	assert.ErrorIs(t, err, ErrNoteGroupNotFound)
}

// TestReorderNoteGroups verifies position updates for the ordering of the list.
func TestReorderNoteGroups(t *testing.T) {
	svc := getTestService(t)
	userID := uint(13)

	group, err := svc.CreateNoteGroup(userID, &dto.CreateNoteGroupRequest{Name: "Medium Pos"})
	require.NoError(t, err)

	err = svc.ReorderNoteGroups(userID, &dto.ReorderNoteGroupsRequest{
		Items: []dto.NoteGroupPositionItem{{ID: group.ID, Position: 7}},
	})
	assert.NoError(t, err)

	resp, err := svc.GetNoteGroup(group.ID, userID)
	assert.NoError(t, err)
	assert.Equal(t, 7, resp.Position)
}
