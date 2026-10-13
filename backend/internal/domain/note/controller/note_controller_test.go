// note_controller_test.go
//
// Subject:      internal/domain/note/controller.NoteController over HTTP.
// Scope:        Route wiring + status codes + response envelope for the note
//
//	endpoints (POST/GET/PUT/DELETE /notes).
//
// Out of scope: Service-layer rules → note_service_test.go
//
//	Repository SQL correctness → note_repository_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  DROP + AutoMigrate notes per setup, matching the activity
//
//	controller test precedent.
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
	ngmodel "life-tracker-backend/internal/domain/note-group/model"
	"life-tracker-backend/internal/domain/note/dto"
	"life-tracker-backend/internal/domain/note/model"
	"life-tracker-backend/internal/domain/note/service"

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

func setupTestRouter(t *testing.T) (*gin.Engine, *service.NoteService, func()) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	db.Exec("DROP TABLE IF EXISTS notes CASCADE")
	require.NoError(t, db.AutoMigrate(&model.Note{}, &ngmodel.NoteGroup{}))

	noteService := service.NewNoteService(db)
	noteController := NewNoteController(noteService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	notes := router.Group("/notes")
	{
		notes.POST("", noteController.CreateNote)
		notes.GET("", noteController.GetNotes)
		notes.GET("/:id", noteController.GetNote)
		notes.PUT("/:id", noteController.UpdateNote)
		notes.DELETE("/:id", noteController.DeleteNote)
	}

	cleanup := func() {
		db.Exec("DROP TABLE IF EXISTS notes CASCADE")
	}

	return router, noteService, cleanup
}

func TestCreateNoteHandler(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	tests := []struct {
		body           interface{}
		checkResponse  func(*testing.T, map[string]interface{})
		name           string
		expectedStatus int
	}{
		{
			name: "valid note",
			body: dto.CreateNoteRequest{
				Title:   "Shopping List",
				Content: "Eggs, bread, milk",
			},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "Shopping List", data["title"])
				assert.Equal(t, "Eggs, bread, milk", data["content"])
			},
		},
		{
			name:           "missing title",
			body:           dto.CreateNoteRequest{Content: "no title"},
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
			req := httptest.NewRequest(http.MethodPost, "/notes", bytes.NewBuffer(body))
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

func TestGetNotesHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	_, err := svc.CreateNote(1, &dto.CreateNoteRequest{Title: "Alpha", Content: "first note"})
	require.NoError(t, err)
	_, err = svc.CreateNote(1, &dto.CreateNoteRequest{Title: "Beta", Content: "second note"})
	require.NoError(t, err)

	t.Run("lists all notes of the user with count", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notes", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(2), resp["count"])
	})

	t.Run("q filter narrows results", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notes?q=alpha", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(1), resp["count"])
	})
}

func TestGetNoteHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	note, err := svc.CreateNote(1, &dto.CreateNoteRequest{Title: "Get Me", Content: "body"})
	require.NoError(t, err)

	t.Run("returns the note", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/notes/%d", note.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "Get Me", data["title"])
	})

	t.Run("non-existent note is 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notes/9999", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("invalid ID is 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/notes/invalid", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestUpdateNoteHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	note, err := svc.CreateNote(1, &dto.CreateNoteRequest{Title: "Original", Content: "body"})
	require.NoError(t, err)

	t.Run("updates title", func(t *testing.T) {
		newTitle := "Updated Title"
		body, _ := json.Marshal(dto.UpdateNoteRequest{Title: &newTitle})

		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/notes/%d", note.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "Updated Title", data["title"])
		assert.Equal(t, "body", data["content"])
	})

	t.Run("non-existent note is 404", func(t *testing.T) {
		newTitle := "Ghost"
		body, _ := json.Marshal(dto.UpdateNoteRequest{Title: &newTitle})

		req := httptest.NewRequest(http.MethodPut, "/notes/9999", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("empty update payload leaves note unchanged", func(t *testing.T) {
		// NoteUpdateRequest fields are omitempty, so an empty payload passes
		// binding and the controller returns 200 with unchanged data.
		body, _ := json.Marshal(dto.UpdateNoteRequest{})

		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/notes/%d", note.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "Updated Title", data["title"])
		assert.Equal(t, "body", data["content"])
	})
}

func TestDeleteNoteHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	note, err := svc.CreateNote(1, &dto.CreateNoteRequest{Title: "Delete Me", Content: "bye"})
	require.NoError(t, err)

	t.Run("deletes successfully", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/notes/%d", note.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["message"], "deleted successfully")
	})

	t.Run("non-existent note is 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/notes/9999", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// NOTE: The note controller reads userID via ctx.GetUint("userID"), which
// silently returns 0 when the middleware is absent — it does not return 401
// the way the activity/social controllers do (middleware.GetUserIDFromContext).
// That gap is documented in the report; a 401 test would be wrong here.
