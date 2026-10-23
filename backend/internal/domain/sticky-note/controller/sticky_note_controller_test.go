// sticky_note_controller_test.go
//
// Subject:      internal/domain/sticky-note/controller.StickyNoteController over HTTP.
// Scope:        Route wiring + status codes + response envelope for the sticky-note
//
//	endpoints (POST/GET/PUT/DELETE /sticky-notes).
//
// Out of scope: Service-layer rules → sticky_note_service_test.go
//
// Infrastructure: PostgreSQL (test database via .env.test).
// Data strategy:  DROP + AutoMigrate sticky_notes per setup.
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
	"life-tracker-backend/internal/domain/sticky-note/dto"
	"life-tracker-backend/internal/domain/sticky-note/model"
	"life-tracker-backend/internal/domain/sticky-note/service"

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

func setupTestRouter(t *testing.T) (*gin.Engine, *service.StickyNoteService, func()) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	db.Exec("DROP TABLE IF EXISTS sticky_notes CASCADE")
	require.NoError(t, db.AutoMigrate(&model.StickyNote{}))

	stickyNoteService := service.NewStickyNoteService(db)
	stickyNoteController := NewStickyNoteController(stickyNoteService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	stickyNotes := router.Group("/sticky-notes")
	{
		stickyNotes.POST("", stickyNoteController.CreateStickyNote)
		stickyNotes.GET("", stickyNoteController.GetStickyNotes)
		stickyNotes.GET("/:id", stickyNoteController.GetStickyNote)
		stickyNotes.PUT("/:id", stickyNoteController.UpdateStickyNote)
		stickyNotes.DELETE("/:id", stickyNoteController.DeleteStickyNote)
	}

	cleanup := func() {
		db.Exec("DROP TABLE IF EXISTS sticky_notes CASCADE")
	}

	return router, stickyNoteService, cleanup
}

func TestCreateStickyNoteHandler(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	tests := []struct {
		body           interface{}
		checkResponse  func(*testing.T, map[string]interface{})
		name           string
		expectedStatus int
	}{
		{
			name:           "title and description",
			body:           dto.CreateStickyNoteRequest{Title: strPtr("Groceries"), Description: strPtr("Eggs")},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "Groceries", data["title"])
				assert.Equal(t, "Eggs", data["description"])
			},
		},
		{
			name:           "title only",
			body:           dto.CreateStickyNoteRequest{Title: strPtr("Buy milk")},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "Buy milk", data["title"])
				assert.Equal(t, "", data["description"])
			},
		},
		{
			name:           "description only",
			body:           dto.CreateStickyNoteRequest{Description: strPtr("Call the plumber")},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "", data["title"])
				assert.Equal(t, "Call the plumber", data["description"])
			},
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
			req := httptest.NewRequest(http.MethodPost, "/sticky-notes", bytes.NewBuffer(body))
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

func TestGetStickyNotesHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	_, err := svc.CreateStickyNote(1, &dto.CreateStickyNoteRequest{Title: strPtr("A")})
	require.NoError(t, err)
	_, err = svc.CreateStickyNote(1, &dto.CreateStickyNoteRequest{Title: strPtr("B")})
	require.NoError(t, err)

	t.Run("lists all sticky notes of the user with count", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/sticky-notes", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(2), resp["count"])
	})
}

func TestUpdateStickyNoteHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	note, err := svc.CreateStickyNote(1, &dto.CreateStickyNoteRequest{Title: strPtr("Original")})
	require.NoError(t, err)

	t.Run("updates title", func(t *testing.T) {
		newTitle := "Renamed"
		body, _ := json.Marshal(dto.UpdateStickyNoteRequest{Title: &newTitle})

		req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/sticky-notes/%d", note.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		assert.Equal(t, "Renamed", data["title"])
	})

	t.Run("non-existent sticky note is 404", func(t *testing.T) {
		newTitle := "Ghost"
		body, _ := json.Marshal(dto.UpdateStickyNoteRequest{Title: &newTitle})

		req := httptest.NewRequest(http.MethodPut, "/sticky-notes/9999", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestDeleteStickyNoteHandler(t *testing.T) {
	router, svc, cleanup := setupTestRouter(t)
	defer cleanup()

	note, err := svc.CreateStickyNote(1, &dto.CreateStickyNoteRequest{Title: strPtr("Delete Me")})
	require.NoError(t, err)

	t.Run("deletes sticky note", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/sticky-notes/%d", note.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("non-existent sticky note is 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/sticky-notes/9999", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func strPtr(s string) *string { return &s }
