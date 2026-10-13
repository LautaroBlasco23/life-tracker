// note_group_controller_test.go
//
// Subject:      internal/domain/note-group/controller.NoteGroupController over HTTP.
// Scope:        Route wiring + status codes + response envelope for the
//
//	note-group endpoints (POST/GET/PUT/DELETE /note-groups, POST /reorder).
//
// Out of scope: Service-layer rules → note_group_service_test.go
//
//	Repository SQL correctness → note_group_repository_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  DROP + AutoMigrate note_groups + notes per setup, matching
//
//	the note controller test precedent.
//
// Parallel-safe:  No — single shared DB connection, no per-test namespace.
package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/note-group/dto"
	ngmodel "life-tracker-backend/internal/domain/note-group/model"
	"life-tracker-backend/internal/domain/note-group/service"
	nmodel "life-tracker-backend/internal/domain/note/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var cfg *config.Config

func init() {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
	gin.SetMode(gin.TestMode)
}

func setupTestRouter(t *testing.T) (*gin.Engine, *service.NoteGroupService, func()) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	db.Exec("DROP TABLE IF EXISTS notes CASCADE")
	db.Exec("DROP TABLE IF EXISTS note_groups CASCADE")
	require.NoError(t, db.AutoMigrate(&nmodel.Note{}, &ngmodel.NoteGroup{}))

	noteGroupService := service.NewNoteGroupService(db)
	noteGroupController := NewNoteGroupController(noteGroupService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	noteGroups := router.Group("/note-groups")
	{
		noteGroups.POST("", noteGroupController.CreateNoteGroup)
		noteGroups.GET("", noteGroupController.GetNoteGroups)
		noteGroups.GET("/:id", noteGroupController.GetNoteGroup)
		noteGroups.PUT("/:id", noteGroupController.UpdateNoteGroup)
		noteGroups.POST("/reorder", noteGroupController.ReorderNoteGroups)
		noteGroups.DELETE("/:id", noteGroupController.DeleteNoteGroup)
	}

	cleanup := func() {
		db.Exec("DROP TABLE IF EXISTS notes CASCADE")
		db.Exec("DROP TABLE IF EXISTS note_groups CASCADE")
	}

	return router, noteGroupService, cleanup
}

func TestCreateNoteGroupHandler(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	tests := []struct {
		body           interface{}
		checkResponse  func(*testing.T, map[string]interface{})
		name           string
		expectedStatus int
	}{
		{
			name:           "valid group",
			body:           dto.CreateNoteGroupRequest{Name: "Work"},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "Work", data["name"])
				assert.Equal(t, float64(0), data["position"])
			},
		},
		{
			name:           "missing name",
			body:           dto.CreateNoteGroupRequest{},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "malformed JSON",
			body:           "not-valid-json{",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/note-groups", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkResponse != nil {
				var resp map[string]interface{}
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
				tt.checkResponse(t, resp)
			}
		})
	}
}

func TestGetNoteGroupsHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	_, err := svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "Work"})
	require.NoError(t, err)
	_, err = svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "Personal"})
	require.NoError(t, err)

	t.Run("lists all groups of the user with count", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/note-groups", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(2), resp["count"])
	})
}

func TestUpdateNoteGroupHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	group, err := svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "Original"})
	require.NoError(t, err)

	t.Run("renames group", func(t *testing.T) {
		newName := "Renamed"
		body, _ := json.Marshal(dto.UpdateNoteGroupRequest{Name: &newName})

		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/note-groups/%d", group.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "Renamed", data["name"])
	})

	t.Run("non-existent group is 404", func(t *testing.T) {
		newName := "Ghost"
		body, _ := json.Marshal(dto.UpdateNoteGroupRequest{Name: &newName})

		req := httptest.NewRequest(http.MethodPut, "/note-groups/9999", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestDeleteNoteGroupHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	group, err := svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "Delete Me"})
	require.NoError(t, err)

	t.Run("delete reassigns notes to ungrouped", func(t *testing.T) {
		// Seed a note assigned to the group via ReorderNotes-like raw update
		// (note service is out of scope here; use direct SQL).
		db := getTestDB(t)
		require.NoError(t, db.Exec(
			"INSERT INTO notes (user_id, title, group_id) VALUES (1, 'In Group', ?)", group.ID).Error)

		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/note-groups/%d", group.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var count int64
		require.NoError(t, db.Table("notes").
			Where("title = ? AND group_id IS NULL", "In Group").
			Count(&count).Error)
		assert.Equal(t, int64(1), count, "note should be unassigned after group deletion")
	})

	t.Run("non-existent group is 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/note-groups/9999", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestReorderNoteGroupsHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	groupA, err := svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "A"})
	require.NoError(t, err)
	groupB, err := svc.CreateNoteGroup(1, &dto.CreateNoteGroupRequest{Name: "B"})
	require.NoError(t, err)

	t.Run("reorders groups", func(t *testing.T) {
		items := []dto.NoteGroupPositionItem{
			{ID: groupA.ID, Position: 1},
			{ID: groupB.ID, Position: 0},
		}
		body, _ := json.Marshal(dto.ReorderNoteGroupsRequest{Items: items})

		req := httptest.NewRequest(http.MethodPost, "/note-groups/reorder", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		respA, err := svc.GetNoteGroup(groupA.ID, 1)
		require.NoError(t, err)
		assert.Equal(t, 1, respA.Position)
	})

	t.Run("empty items is 400", func(t *testing.T) {
		body, _ := json.Marshal(dto.ReorderNoteGroupsRequest{Items: []dto.NoteGroupPositionItem{}})

		req := httptest.NewRequest(http.MethodPost, "/note-groups/reorder", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// getTestDB returns a raw handle for assertions against seeded data.
func getTestDB(t *testing.T) *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}
