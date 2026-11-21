package controller

// user_controller_routes_test.go
//
// Subject: internal/domain/user/controller/user_controller.go — the handlers
//          not exercised by user_controller_test.go (onboarding, search,
//          lookup, email availability, and image-handler error paths).
// Scope:   HTTP handler behavior — request parsing, status codes, and
//          response shape as seen by clients, including that lookup never
//          leaks the email.
// Out of scope:
//   - Service-layer business logic → user_service_test.go
//   - Successful image upload/delete flows → need the imagestore client
// Setup:   Real PostgreSQL via ENVIRONMENT=test config; tables are migrated +
//          truncated per router (no DROP: sibling packages run in parallel).

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	authModel "life-tracker-backend/internal/domain/auth/model"
	"life-tracker-backend/internal/domain/user/model"
	"life-tracker-backend/internal/domain/user/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// setupUserRoutesRouter registers every user handler the default setup does
// not cover.
func setupUserRoutesRouter(t *testing.T) (*gin.Engine, *gorm.DB, *service.UserService) {
	t.Helper()

	db, err := gorm.Open(postgres.Open(userExtraTestDSN()), &gorm.Config{})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	require.NoError(t, db.AutoMigrate(&model.User{}, &authModel.Auth{}))
	require.NoError(t, db.Exec("TRUNCATE TABLE users RESTART IDENTITY CASCADE").Error)
	require.NoError(t, db.Exec("TRUNCATE TABLE auths RESTART IDENTITY CASCADE").Error)

	userService := service.NewUserService(db, nil)
	controller := NewUserController(userService)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Set("email", "me@example.com")
		c.Set("username", "me")
		c.Next()
	})

	users := router.Group("/users")
	{
		users.PUT("/me/onboarding", controller.CompleteOnboarding)
		users.POST("/me/image", controller.UploadProfileImage)
		users.DELETE("/me/image", controller.DeleteProfileImage)
		users.GET("/search", controller.SearchUsers)
		users.GET("/check-email", controller.CheckEmailAvailability)
		users.GET("/:username", controller.GetUserOrProfile)
	}

	return router, db, userService
}

func userExtraTestDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

func doUserExtraJSON(t *testing.T, router *gin.Engine, method, path string, body []byte) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, path, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func seedUserWithAuth(t *testing.T, db *gorm.DB, id uint, email, username string) {
	t.Helper()
	require.NoError(t, db.Create(&model.User{
		ID:        id,
		FirstName: "Test",
		LastName:  fmt.Sprintf("User%d", id),
	}).Error)
	require.NoError(t, db.Create(&authModel.Auth{
		UserID:   id,
		Email:    email,
		Username: username,
	}).Error)
}

func TestCompleteOnboardingHandler(t *testing.T) {
	router, db, _ := setupUserRoutesRouter(t)
	seedUserWithAuth(t, db, 1, "me@example.com", "me")

	t.Run("marks onboarding as completed", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodPut, "/users/me/onboarding", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, "Onboarding completed successfully", resp["message"])
		data, ok := resp["data"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, true, data["onboardingCompleted"])
	})

	t.Run("is idempotent", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodPut, "/users/me/onboarding", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var count int64
		require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
		assert.Equal(t, int64(1), count)
	})

	t.Run("unknown user returns bad request", func(t *testing.T) {
		anonRouter := gin.New()
		anonRouter.Use(func(c *gin.Context) {
			c.Set("userID", uint(9999))
			c.Set("email", "anon@example.com")
			c.Next()
		})
		userService := service.NewUserService(db, nil)
		anonRouter.PUT("/users/me/onboarding", NewUserController(userService).CompleteOnboarding)

		w := doUserExtraJSON(t, anonRouter, http.MethodPut, "/users/me/onboarding", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestSearchUsersHandler(t *testing.T) {
	router, db, _ := setupUserRoutesRouter(t)
	seedUserWithAuth(t, db, 1, "me@example.com", "me")
	seedUserWithAuth(t, db, 2, "alpha@example.com", "alpha")
	seedUserWithAuth(t, db, 3, "beta@example.com", "beta")

	t.Run("finds users by username prefix excluding the viewer", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/search?q=user", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Count int `json:"count"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, 0, resp.Count, "only the viewer matches the prefix and is excluded")
	})

	t.Run("finds matching prefix", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/search?q=alpha&limit=10", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct {
			Count int `json:"count"`
			Data  []struct {
				Username string `json:"username"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, 1, resp.Count)
		assert.Equal(t, "alpha", resp.Data[0].Username)
	})

	t.Run("empty query returns bad request", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/search", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

// TestGetUserOrProfileHandler asserts public lookup works by numeric id or by
// username and never exposes the email.
func TestGetUserOrProfileHandler(t *testing.T) {
	router, db, _ := setupUserRoutesRouter(t)
	seedUserWithAuth(t, db, 7, "secret@example.com", "seventh")

	t.Run("lookup by numeric id", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/7", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp struct {
			Data map[string]interface{} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(7), resp.Data["id"])
		assert.Equal(t, "seventh", resp.Data["username"])
		assert.NotContains(t, resp.Data, "email", "public lookup must not leak the email")
	})

	t.Run("lookup by username", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/seventh", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		var resp struct {
			Data map[string]interface{} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, float64(7), resp.Data["id"])
		assert.NotContains(t, resp.Data, "email", "public lookup must not leak the email")
	})

	t.Run("unknown username returns not found", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/ghost", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("unknown numeric id returns not found", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/9999", nil)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestCheckEmailAvailabilityHandler(t *testing.T) {
	router, db, _ := setupUserRoutesRouter(t)
	seedUserWithAuth(t, db, 1, "taken@example.com", "taken")

	t.Run("email is available", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/check-email?email=free@example.com", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, true, resp["available"])
		assert.Equal(t, "free@example.com", resp["email"])
	})

	t.Run("email is taken", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/check-email?email=taken@example.com", nil)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Equal(t, false, resp["available"])
	})

	t.Run("missing email parameter", func(t *testing.T) {
		w := doUserExtraJSON(t, router, http.MethodGet, "/users/check-email", nil)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["error"], "required")
	})
}

func TestUploadProfileImageHandler_NoFile_ReturnsBadRequest(t *testing.T) {
	router, _, _ := setupUserRoutesRouter(t)

	w := doUserExtraJSON(t, router, http.MethodPost, "/users/me/image", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "No image file provided")
}

func TestDeleteProfileImageHandler_NoImage_ReturnsBadRequest(t *testing.T) {
	router, db, _ := setupUserRoutesRouter(t)
	seedUserWithAuth(t, db, 1, "me@example.com", "me")

	w := doUserExtraJSON(t, router, http.MethodDelete, "/users/me/image", nil)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "no profile image to delete")
}
