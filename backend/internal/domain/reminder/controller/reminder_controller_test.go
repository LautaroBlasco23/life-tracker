package controller

// reminder_controller_test.go
//
// Subject: internal/domain/reminder/controller/reminder_controller.go
// Scope:   HTTP handler behavior for reminder CRUD, completion and revert —
//          request parsing, status codes, and response shape as seen by clients.
// Out of scope:
//   - Service-layer business logic → reminder_service_test.go
//   - Repository/database behavior → needs the compose test DB (see report)
// Setup:   Real PostgreSQL via ENVIRONMENT=test config; the reminders table is
//          dropped and recreated per router.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/domain/reminder/dto"
	"life-tracker-backend/internal/domain/reminder/model"
	"life-tracker-backend/internal/domain/reminder/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var cfg *config.Config

func init() {
	os.Setenv("ENVIRONMENT", "test")
	cfg = config.Load()
	gin.SetMode(gin.TestMode)
}

func reminderTestDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

// setupReminderRouter builds a router with an auth stub (userID 1) and a
// freshly migrated + truncated reminders table (no DROP: sibling packages run
// in parallel and use the same table).
func setupReminderRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(postgres.Open(reminderTestDSN()), &gorm.Config{})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	require.NoError(t, db.AutoMigrate(&model.Reminder{}))
	require.NoError(t, db.Exec("TRUNCATE TABLE reminders RESTART IDENTITY CASCADE").Error)

	reminderService := service.NewReminderService(db)
	reminderController := NewReminderController(reminderService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	router.POST("/reminders", reminderController.CreateReminder)
	router.GET("/reminders", reminderController.GetUserReminders)
	router.GET("/reminders/:id", reminderController.GetReminder)
	router.PUT("/reminders/:id", reminderController.UpdateReminder)
	router.DELETE("/reminders/:id", reminderController.DeleteReminder)
	router.POST("/reminders/:id/complete", reminderController.CompleteReminder)
	router.DELETE("/reminders/:id/complete", reminderController.RevertCompletion)

	return router, db
}

func doReminderJSON(t *testing.T, router *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		require.NoError(t, err)
	} else {
		payload = []byte("invalid json")
	}

	req := httptest.NewRequest(method, path, bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// reminderBody returns a create payload; activeFrom is omitted when empty.
func reminderBody(title string, dueAt time.Time, activeFrom time.Time) map[string]interface{} {
	body := map[string]interface{}{
		"title": title,
		"dueAt": dueAt.Format(time.RFC3339Nano),
	}
	if !activeFrom.IsZero() {
		body["activeFrom"] = activeFrom.Format(time.RFC3339Nano)
	}
	return body
}

func TestCreateReminderHandler_ValidRequest_ReturnsCreated(t *testing.T) {
	router, _ := setupReminderRouter(t)

	w := doReminderJSON(t, router, http.MethodPost, "/reminders",
		reminderBody("Buy groceries", time.Now().UTC().Add(48*time.Hour), time.Time{}))

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Reminder created successfully", resp["message"])

	data, ok := resp["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "Buy groceries", data["title"])
	assert.Equal(t, "private", data["privacyStatus"])
	assert.NotZero(t, data["id"])
}

func TestCreateReminderHandler_MalformedJSON_ReturnsBadRequest(t *testing.T) {
	router, _ := setupReminderRouter(t)

	w := doReminderJSON(t, router, http.MethodPost, "/reminders", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateReminderHandler_MissingTitle_ReturnsBadRequest(t *testing.T) {
	router, _ := setupReminderRouter(t)

	w := doReminderJSON(t, router, http.MethodPost, "/reminders", map[string]interface{}{
		"dueAt": time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339Nano),
	})

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateReminderHandler_MissingDueAt_ReturnsBadRequest(t *testing.T) {
	router, _ := setupReminderRouter(t)

	w := doReminderJSON(t, router, http.MethodPost, "/reminders", map[string]interface{}{
		"title": "No deadline",
	})

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateReminderHandler_WindowAfterDeadline_ReturnsBadRequest(t *testing.T) {
	router, _ := setupReminderRouter(t)

	dueAt := time.Now().UTC().Add(48 * time.Hour)
	w := doReminderJSON(t, router, http.MethodPost, "/reminders",
		reminderBody("Invalid window", dueAt, dueAt.Add(24*time.Hour)))

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "before the deadline")
}

func TestGetUserRemindersHandler_ReturnsOwnedOnly(t *testing.T) {
	router, db := setupReminderRouter(t)

	require.NoError(t, db.Create(&model.Reminder{UserID: 1, Title: "mine"}).Error)
	require.NoError(t, db.Create(&model.Reminder{UserID: 2, Title: "foreign"}).Error)

	w := doReminderJSON(t, router, http.MethodGet, "/reminders", nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Message string                 `json:"message"`
		Count   int                    `json:"count"`
		Data    []dto.ReminderResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 1, resp.Count)
	require.Len(t, resp.Data, 1)
	assert.Equal(t, "mine", resp.Data[0].Title)
}

func TestGetReminderHandler(t *testing.T) {
	t.Run("returns the reminder", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "fetch me"}
		require.NoError(t, db.Create(&reminder).Error)

		w := doReminderJSON(t, router, http.MethodGet, fmt.Sprintf("/reminders/%d", reminder.ID), nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Data dto.ReminderResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, "fetch me", resp.Data.Title)
	})

	t.Run("unknown id returns not found", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodGet, "/reminders/999", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodGet, "/reminders/abc", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestUpdateReminderHandler(t *testing.T) {
	dueAt := time.Now().UTC().Add(48 * time.Hour)

	t.Run("updates fields", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "original", DueAt: dueAt}
		require.NoError(t, db.Create(&reminder).Error)

		newTitle := "renamed"
		w := doReminderJSON(t, router, http.MethodPut, fmt.Sprintf("/reminders/%d", reminder.ID),
			map[string]interface{}{"title": newTitle})

		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Data dto.ReminderResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, newTitle, resp.Data.Title)
	})

	t.Run("malformed body returns bad request", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "original", DueAt: dueAt}
		require.NoError(t, db.Create(&reminder).Error)

		w := doReminderJSON(t, router, http.MethodPut, fmt.Sprintf("/reminders/%d", reminder.ID), nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("window after deadline returns bad request", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "original", DueAt: dueAt}
		require.NoError(t, db.Create(&reminder).Error)

		w := doReminderJSON(t, router, http.MethodPut, fmt.Sprintf("/reminders/%d", reminder.ID),
			map[string]interface{}{"activeFrom": dueAt.Add(24 * time.Hour).Format(time.RFC3339Nano)})

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("unknown id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodPut, "/reminders/999",
			map[string]interface{}{"title": "ghost"})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodPut, "/reminders/abc", map[string]interface{}{})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestDeleteReminderHandler(t *testing.T) {
	t.Run("deletes the reminder", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "doomed"}
		require.NoError(t, db.Create(&reminder).Error)

		w := doReminderJSON(t, router, http.MethodDelete, fmt.Sprintf("/reminders/%d", reminder.ID), nil)
		assert.Equal(t, http.StatusOK, w.Code)

		w = doReminderJSON(t, router, http.MethodGet, fmt.Sprintf("/reminders/%d", reminder.ID), nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("unknown id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodDelete, "/reminders/999", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodDelete, "/reminders/abc", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestCompleteReminderHandler(t *testing.T) {
	t.Run("completes and reverts", func(t *testing.T) {
		router, db := setupReminderRouter(t)

		reminder := model.Reminder{UserID: 1, Title: "task"}
		require.NoError(t, db.Create(&reminder).Error)

		w := doReminderJSON(t, router, http.MethodPost, fmt.Sprintf("/reminders/%d/complete", reminder.ID), nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp struct {
			Data dto.ReminderResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		require.NotNil(t, resp.Data.CompletedAt)

		w = doReminderJSON(t, router, http.MethodDelete, fmt.Sprintf("/reminders/%d/complete", reminder.ID), nil)
		assert.Equal(t, http.StatusOK, w.Code)

		w = doReminderJSON(t, router, http.MethodGet, fmt.Sprintf("/reminders/%d", reminder.ID), nil)
		var reverted struct {
			Data dto.ReminderResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &reverted))
		assert.Nil(t, reverted.Data.CompletedAt)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodPost, "/reminders/abc/complete", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("revert invalid id returns bad request", func(t *testing.T) {
		router, _ := setupReminderRouter(t)

		w := doReminderJSON(t, router, http.MethodDelete, "/reminders/abc/complete", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// TestReminderHandlers_WithoutUserContext asserts every handler answers 401
// when the auth middleware did not set a userID.
func TestReminderHandlers_WithoutUserContext_ReturnsUnauthorized(t *testing.T) {
	db, err := gorm.Open(postgres.Open(reminderTestDSN()), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Reminder{}))
	require.NoError(t, db.Exec("TRUNCATE TABLE reminders RESTART IDENTITY CASCADE").Error)

	reminderController := NewReminderController(service.NewReminderService(db))
	router := gin.New()
	router.POST("/reminders", reminderController.CreateReminder)
	router.GET("/reminders", reminderController.GetUserReminders)
	router.GET("/reminders/:id", reminderController.GetReminder)
	router.PUT("/reminders/:id", reminderController.UpdateReminder)
	router.DELETE("/reminders/:id", reminderController.DeleteReminder)
	router.POST("/reminders/:id/complete", reminderController.CompleteReminder)
	router.DELETE("/reminders/:id/complete", reminderController.RevertCompletion)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"create", http.MethodPost, "/reminders"},
		{"list", http.MethodGet, "/reminders"},
		{"get", http.MethodGet, "/reminders/1"},
		{"update", http.MethodPut, "/reminders/1"},
		{"delete", http.MethodDelete, "/reminders/1"},
		{"complete", http.MethodPost, "/reminders/1/complete"},
		{"revert", http.MethodDelete, "/reminders/1/complete"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doReminderJSON(t, router, tc.method, tc.path, map[string]interface{}{
				"title": "x", "dueAt": time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano),
			})
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}
