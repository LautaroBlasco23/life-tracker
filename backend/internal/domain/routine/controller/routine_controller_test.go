package controller

// routine_controller_test.go
//
// Subject: internal/domain/routine/controller/routine_controller.go
// Scope:   HTTP handler behavior for routine CRUD — request parsing, status
//          codes, and response shape as seen by clients.
// Out of scope:
//   - Service-layer business logic → routine_service_test.go
//   - Repository/database behavior → routine_repository_test.go
// Setup:   Real PostgreSQL via ENVIRONMENT=test config; routine tables are
//          migrated + truncated per router (no DROP: sibling packages run in
//          parallel and use the same tables).

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"life-tracker-backend/internal/config"
	activityModel "life-tracker-backend/internal/domain/activity/model"
	"life-tracker-backend/internal/domain/routine/dto"
	"life-tracker-backend/internal/domain/routine/model"
	"life-tracker-backend/internal/domain/routine/service"

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

func routineControllerTestDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

// setupRoutineRouter builds a router with an auth stub (userID 1) and fresh
// routine tables.
func setupRoutineRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(postgres.Open(routineControllerTestDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	require.NoError(t, db.AutoMigrate(
		&activityModel.Activity{}, &model.Routine{}, &model.RoutineActivity{},
	))
	require.NoError(t, db.Exec(
		"TRUNCATE TABLE routine_activities, routines, activities RESTART IDENTITY CASCADE",
	).Error)

	routineService := service.NewRoutineService(db, nil)
	routineController := NewRoutineController(routineService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})

	router.POST("/routines", routineController.CreateRoutine)
	router.GET("/routines/me", routineController.GetMyRoutines)
	router.GET("/routines/:id", routineController.GetRoutine)
	router.PATCH("/routines/:id", routineController.UpdateRoutine)
	router.DELETE("/routines/:id", routineController.DeleteRoutine)

	return router, db
}

func doRoutineJSON(t *testing.T, router *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
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

func (tc *routineControllerFixture) createActivity(t *testing.T, userID uint, title string) activityModel.Activity {
	a := activityModel.Activity{
		UserID:           userID,
		Title:            title,
		Description:      "Description of " + title,
		Frequency:        activityModel.FrequencyDaily,
		DayTime:          activityModel.DayTimeMorning,
		CompletionAmount: 2,
		IsActive:         true,
		PrivacyStatus:    activityModel.PrivacyPrivate,
	}
	require.NoError(t, tc.db.Create(&a).Error)
	return a
}

type routineControllerFixture struct {
	db *gorm.DB
}

func TestCreateRoutineHandler(t *testing.T) {
	router, db := setupRoutineRouter(t)
	fx := &routineControllerFixture{db: db}
	act := fx.createActivity(t, 1, "Training session")

	t.Run("creates routine", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
			"title":         "Health routine",
			"privacyStatus": "private",
			"activityIds":   []map[string]interface{}{{"activityId": act.ID, "position": 0}},
		})

		assert.Equal(t, http.StatusCreated, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, "Routine created successfully", resp["message"])

		data, ok := resp["data"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "Health routine", data["title"])
		assert.Equal(t, float64(1), data["userId"])
		activities, ok := data["activities"].([]interface{})
		require.True(t, ok)
		require.Len(t, activities, 1)
	})

	t.Run("malformed body returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPost, "/routines", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("missing fields return bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
			"title": "No activities",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("foreign activity returns bad request", func(t *testing.T) {
		foreign := fx.createActivity(t, 99, "Foreign activity")
		w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
			"title":         "Bad routine",
			"privacyStatus": "private",
			"activityIds":   []map[string]interface{}{{"activityId": foreign.ID, "position": 0}},
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestGetMyRoutinesHandler(t *testing.T) {
	router, db := setupRoutineRouter(t)
	fx := &routineControllerFixture{db: db}
	act := fx.createActivity(t, 1, "Training session")

	w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
		"title":         "Health routine",
		"privacyStatus": "private",
		"activityIds":   []map[string]interface{}{{"activityId": act.ID, "position": 0}},
	})
	require.Equal(t, http.StatusCreated, w.Code)

	t.Run("lists the user's routines with count", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodGet, "/routines/me", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp struct {
			Count int                   `json:"count"`
			Data  []dto.RoutineResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, 1, resp.Count)
		require.Len(t, resp.Data, 1)
		assert.Equal(t, "Health routine", resp.Data[0].Title)
		require.Len(t, resp.Data[0].Activities, 1)
		assert.Equal(t, "Training session", resp.Data[0].Activities[0].ActivityTitle)
	})
}

func TestGetRoutineHandler(t *testing.T) {
	router, db := setupRoutineRouter(t)
	fx := &routineControllerFixture{db: db}
	act := fx.createActivity(t, 1, "Training session")

	w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
		"title":         "Health routine",
		"privacyStatus": "private",
		"activityIds":   []map[string]interface{}{{"activityId": act.ID, "position": 0}},
	})
	require.Equal(t, http.StatusCreated, w.Code)
	var created struct {
		Data dto.RoutineResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	t.Run("returns the routine", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodGet, fmt.Sprintf("/routines/%d", created.Data.ID), nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Data dto.RoutineResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, created.Data.ID, resp.Data.ID)
		require.Len(t, resp.Data.Activities, 1)
		assert.Equal(t, "Training session", resp.Data.Activities[0].ActivityTitle)
	})

	t.Run("unknown id returns not found", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodGet, "/routines/999", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodGet, "/routines/abc", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestUpdateRoutineHandler(t *testing.T) {
	router, db := setupRoutineRouter(t)
	fx := &routineControllerFixture{db: db}
	act := fx.createActivity(t, 1, "Training session")

	w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
		"title":         "Health routine",
		"privacyStatus": "private",
		"activityIds":   []map[string]interface{}{{"activityId": act.ID, "position": 0}},
	})
	require.Equal(t, http.StatusCreated, w.Code)
	var created struct {
		Data dto.RoutineResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

	t.Run("updates fields", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPatch, fmt.Sprintf("/routines/%d", created.Data.ID),
			map[string]interface{}{"title": "Renamed", "privacyStatus": "public"})

		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Data dto.RoutineResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, "Renamed", resp.Data.Title)
		assert.Equal(t, "public", resp.Data.PrivacyStatus)
	})

	t.Run("malformed body returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPatch, fmt.Sprintf("/routines/%d", created.Data.ID), nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPatch, "/routines/abc", map[string]interface{}{})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("unknown id returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPatch, "/routines/999", map[string]interface{}{
			"title": "ghost",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestDeleteRoutineHandler(t *testing.T) {
	router, db := setupRoutineRouter(t)
	fx := &routineControllerFixture{db: db}
	act := fx.createActivity(t, 1, "Training session")

	t.Run("deletes the routine", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodPost, "/routines", map[string]interface{}{
			"title":         "Doomed routine",
			"privacyStatus": "private",
			"activityIds":   []map[string]interface{}{{"activityId": act.ID, "position": 0}},
		})
		require.Equal(t, http.StatusCreated, w.Code)
		var created struct {
			Data dto.RoutineResponse `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))

		w = doRoutineJSON(t, router, http.MethodDelete, fmt.Sprintf("/routines/%d", created.Data.ID), nil)
		assert.Equal(t, http.StatusOK, w.Code)

		w = doRoutineJSON(t, router, http.MethodGet, fmt.Sprintf("/routines/%d", created.Data.ID), nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("invalid id returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodDelete, "/routines/abc", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("unknown id returns bad request", func(t *testing.T) {
		w := doRoutineJSON(t, router, http.MethodDelete, "/routines/999", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// TestRoutineHandlers_WithoutUserContext asserts every handler answers 401
// when the auth middleware did not set a userID.
func TestRoutineHandlers_WithoutUserContext_ReturnsUnauthorized(t *testing.T) {
	db, err := gorm.Open(postgres.Open(routineControllerTestDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&activityModel.Activity{}, &model.Routine{}, &model.RoutineActivity{}))
	require.NoError(t, db.Exec(
		"TRUNCATE TABLE routine_activities, routines, activities RESTART IDENTITY CASCADE",
	).Error)

	routineController := NewRoutineController(service.NewRoutineService(db, nil))
	router := gin.New()
	router.POST("/routines", routineController.CreateRoutine)
	router.GET("/routines/me", routineController.GetMyRoutines)
	router.GET("/routines/:id", routineController.GetRoutine)
	router.PATCH("/routines/:id", routineController.UpdateRoutine)
	router.DELETE("/routines/:id", routineController.DeleteRoutine)

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{"create", http.MethodPost, "/routines"},
		{"list mine", http.MethodGet, "/routines/me"},
		{"get", http.MethodGet, "/routines/1"},
		{"update", http.MethodPatch, "/routines/1"},
		{"delete", http.MethodDelete, "/routines/1"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doRoutineJSON(t, router, tc.method, tc.path, map[string]interface{}{
				"title":         "x",
				"privacyStatus": "private",
				"activityIds":   []map[string]interface{}{{"activityId": 1, "position": 0}},
			})
			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}
