package controller

// calendar_event_controller_test.go
//
// Subject: internal/domain/calendar/controller/calendar_event_controller.go
// Scope:   HTTP handler behavior for calendar event CRUD and range listing —
//          request parsing, status codes, and response shape as seen by clients.
// Out of scope:
//   - Service-layer business logic → calendar_event_service_test.go
//   - Repository/database behavior → calendar_event_repository_test.go
// Setup:   Real PostgreSQL via ENVIRONMENT=test config; the table is dropped and
//          recreated per router.

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
	"life-tracker-backend/internal/domain/calendar/dto"
	"life-tracker-backend/internal/domain/calendar/model"
	"life-tracker-backend/internal/domain/calendar/service"

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

func testDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

// setupTestRouter builds a router with an auth stub and a fresh calendar_events table.
func setupTestRouter(t *testing.T) (*gin.Engine, *gorm.DB, func()) {
	t.Helper()

	db, err := gorm.Open(postgres.Open(testDSN()), &gorm.Config{})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	require.NoError(t, db.Exec("DROP TABLE IF EXISTS calendar_events CASCADE").Error)
	require.NoError(t, db.AutoMigrate(&model.CalendarEvent{}))

	calendarService := service.NewCalendarService(db)
	calendarController := NewCalendarController(calendarService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	router.POST("/calendar-events", calendarController.CreateEvent)
	router.GET("/calendar-events", calendarController.GetEvents)
	router.GET("/calendar-events/:id", calendarController.GetEvent)
	router.PUT("/calendar-events/:id", calendarController.UpdateEvent)
	router.DELETE("/calendar-events/:id", calendarController.DeleteEvent)

	cleanup := func() {
		db.Exec("DROP TABLE IF EXISTS calendar_events CASCADE")
	}

	return router, db, cleanup
}

func validBody() dto.CreateCalendarEventRequest {
	return dto.CreateCalendarEventRequest{
		Title:       "English class",
		Description: "B2 conversation",
		Category:    "Study",
		StartAt:     time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:       time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
}

func doJSON(t *testing.T, router *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
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

func TestCreateEvent_ValidRequest_ReturnsCreated(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodPost, "/calendar-events", validBody())

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Calendar event created successfully", resp["message"])

	data, ok := resp["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "English class", data["title"])
	assert.Equal(t, "Study", data["category"])
	assert.NotZero(t, data["id"])
}

func TestCreateEvent_InvalidInterval_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	body := validBody()
	body.EndAt = body.StartAt

	w := doJSON(t, router, http.MethodPost, "/calendar-events", body)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "end must be after start")
}

func TestCreateEvent_MissingTitle_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	body := validBody()
	body.Title = ""

	w := doJSON(t, router, http.MethodPost, "/calendar-events", body)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateEvent_MalformedJSON_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodPost, "/calendar-events", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetEvents_RangeFilter_ReturnsOverlappingOnly(t *testing.T) {
	router, db, cleanup := setupTestRouter(t)
	defer cleanup()

	inside := model.CalendarEvent{
		UserID:   1,
		Title:    "inside",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	outside := model.CalendarEvent{
		UserID:   1,
		Title:    "outside",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 27, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 27, 12, 0, 0, 0, time.UTC),
	}
	require.NoError(t, db.Create(&inside).Error)
	require.NoError(t, db.Create(&outside).Error)

	w := doJSON(t, router, http.MethodGet,
		"/calendar-events?from=2026-10-19T00:00:00Z&to=2026-10-26T00:00:00Z", nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Count int                         `json:"count"`
		Data  []dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 1, resp.Count)
	require.Len(t, resp.Data, 1)
	assert.Equal(t, "inside", resp.Data[0].Title)
}

func TestGetEvents_HalfRange_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodGet, "/calendar-events?from=2026-10-19T00:00:00Z", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetEvents_InvalidFrom_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodGet,
		"/calendar-events?from=not-a-date&to=2026-10-26T00:00:00Z", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetEvent_UnknownID_ReturnsNotFound(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodGet, "/calendar-events/999", nil)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetEvent_InvalidID_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodGet, "/calendar-events/abc", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateEvent_PartialUpdate_ReturnsUpdatedEvent(t *testing.T) {
	router, db, cleanup := setupTestRouter(t)
	defer cleanup()

	event := model.CalendarEvent{
		UserID:   1,
		Title:    "original",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	require.NoError(t, db.Create(&event).Error)

	title := "renamed"
	w := doJSON(t, router, http.MethodPut, fmt.Sprintf("/calendar-events/%d", event.ID), map[string]interface{}{
		"title": title,
	})

	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "renamed", resp.Data.Title)
	assert.True(t, event.StartAt.Equal(resp.Data.StartAt))
}

func TestUpdateEvent_InvalidInterval_ReturnsBadRequest(t *testing.T) {
	router, db, cleanup := setupTestRouter(t)
	defer cleanup()

	event := model.CalendarEvent{
		UserID:   1,
		Title:    "original",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	require.NoError(t, db.Create(&event).Error)

	w := doJSON(t, router, http.MethodPut, fmt.Sprintf("/calendar-events/%d", event.ID), map[string]interface{}{
		"startAt": "2026-10-19T13:00:00Z",
	})

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteEvent_RemovesEvent(t *testing.T) {
	router, db, cleanup := setupTestRouter(t)
	defer cleanup()

	event := model.CalendarEvent{
		UserID:   1,
		Title:    "to delete",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	require.NoError(t, db.Create(&event).Error)

	w := doJSON(t, router, http.MethodDelete, fmt.Sprintf("/calendar-events/%d", event.ID), nil)
	assert.Equal(t, http.StatusOK, w.Code)

	w = doJSON(t, router, http.MethodGet, fmt.Sprintf("/calendar-events/%d", event.ID), nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCreateEvent_WithoutUser_ReturnsUnauthorized(t *testing.T) {
	db, err := gorm.Open(postgres.Open(testDSN()), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("DROP TABLE IF EXISTS calendar_events CASCADE").Error)
	require.NoError(t, db.AutoMigrate(&model.CalendarEvent{}))
	defer func() { db.Exec("DROP TABLE IF EXISTS calendar_events CASCADE") }()

	calendarController := NewCalendarController(service.NewCalendarService(db))
	router := gin.New()
	router.POST("/calendar-events", calendarController.CreateEvent)

	w := doJSON(t, router, http.MethodPost, "/calendar-events", validBody())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// --- Weekly recurrence ---

// recurrenceBody returns a create payload with a weekly recurrence. An empty
// until leaves the bound out of the request.
func recurrenceBody(until string) map[string]interface{} {
	recurrence := map[string]interface{}{"rule": "weekly"}
	if until != "" {
		recurrence["until"] = until
	}

	return map[string]interface{}{
		"title":      "English class",
		"category":   "Study",
		"startAt":    "2026-10-19T10:00:00Z",
		"endAt":      "2026-10-19T12:00:00Z",
		"recurrence": recurrence,
	}
}

func TestCreateEvent_WeeklyRecurrence_CreatesEveryOccurrence(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodPost, "/calendar-events", recurrenceBody("2026-11-09T10:00:00Z"))
	assert.Equal(t, http.StatusCreated, w.Code)

	var resp struct {
		Data dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.NotNil(t, resp.Data.SeriesID)
	assert.Equal(t, "weekly", *resp.Data.RecurrenceRule)
	assert.Equal(t, 0, *resp.Data.OccurrenceIndex)

	w = doJSON(t, router, http.MethodGet, "/calendar-events", nil)
	assert.Equal(t, http.StatusOK, w.Code)

	var list struct {
		Count int                         `json:"count"`
		Data  []dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Equal(t, 4, list.Count)
	for _, event := range list.Data {
		require.NotNil(t, event.SeriesID)
		assert.Equal(t, *resp.Data.SeriesID, *event.SeriesID)
	}
}

func TestCreateEvent_RecurrenceWithoutUntil_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	body := recurrenceBody("")

	w := doJSON(t, router, http.MethodPost, "/calendar-events", body)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "until is required")
}

func TestCreateEvent_RecurrenceOverTheCap_ReturnsBadRequest(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	// 101 weekly occurrences exceed the cap of 100.
	w := doJSON(t, router, http.MethodPost, "/calendar-events", recurrenceBody("2028-10-16T10:00:00Z"))
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "maximum of 100 occurrences")

	w = doJSON(t, router, http.MethodGet, "/calendar-events", nil)
	var list struct {
		Count int `json:"count"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Equal(t, 0, list.Count)
}

func TestUpdateEvent_SeriesScope_UpdatesEveryOccurrence(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodPost, "/calendar-events", recurrenceBody("2026-11-09T10:00:00Z"))
	require.Equal(t, http.StatusCreated, w.Code)

	var created struct {
		Data dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	w = doJSON(t, router, http.MethodPut, fmt.Sprintf("/calendar-events/%d", created.Data.ID), map[string]interface{}{
		"title": "renamed",
		"scope": "series",
	})
	assert.Equal(t, http.StatusOK, w.Code)

	w = doJSON(t, router, http.MethodGet, "/calendar-events", nil)
	var list struct {
		Data []dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	require.Len(t, list.Data, 4)
	for _, event := range list.Data {
		assert.Equal(t, "renamed", event.Title)
	}
}

func TestDeleteEvent_SeriesScope_RemovesEveryOccurrence(t *testing.T) {
	router, _, cleanup := setupTestRouter(t)
	defer cleanup()

	w := doJSON(t, router, http.MethodPost, "/calendar-events", recurrenceBody("2026-11-09T10:00:00Z"))
	require.Equal(t, http.StatusCreated, w.Code)

	var created struct {
		Data dto.CalendarEventResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	w = doJSON(t, router, http.MethodDelete, fmt.Sprintf("/calendar-events/%d?scope=series", created.Data.ID), nil)
	assert.Equal(t, http.StatusOK, w.Code)

	w = doJSON(t, router, http.MethodGet, "/calendar-events", nil)
	var list struct {
		Count int `json:"count"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Equal(t, 0, list.Count)
}

func TestDeleteEvent_InvalidScope_ReturnsBadRequest(t *testing.T) {
	router, db, cleanup := setupTestRouter(t)
	defer cleanup()

	event := model.CalendarEvent{
		UserID:   1,
		Title:    "to delete",
		Category: "Study",
		StartAt:  time.Date(2026, time.October, 19, 10, 0, 0, 0, time.UTC),
		EndAt:    time.Date(2026, time.October, 19, 12, 0, 0, 0, time.UTC),
	}
	require.NoError(t, db.Create(&event).Error)

	w := doJSON(t, router, http.MethodDelete, fmt.Sprintf("/calendar-events/%d?scope=everything", event.ID), nil)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	w = doJSON(t, router, http.MethodGet, fmt.Sprintf("/calendar-events/%d", event.ID), nil)
	assert.Equal(t, http.StatusOK, w.Code)
}
