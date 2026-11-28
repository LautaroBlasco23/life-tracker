package controller

// auth_controller_logout_email_test.go
//
// Subject: internal/domain/auth/controller/auth_controller.go — the handlers
//          and error paths not exercised by auth_controller_test.go
//          (logout single-session and revoke-all, update-email guards).
// Scope:   Logout HTTP contract (absent body = revoke all, revoked refresh
//          token is rejected afterwards) and UpdateEmail failure paths
//          (wrong password, same email, taken email).
// Out of scope: Token mechanics themselves → auth_service_test.go.
// Setup:   Real PostgreSQL via ENVIRONMENT=test config; tables are migrated +
//          truncated per router (no DROP: sibling packages run in parallel).

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"life-tracker-backend/internal/domain/auth/dto"
	"life-tracker-backend/internal/domain/auth/model"
	"life-tracker-backend/internal/domain/auth/service"
	userModel "life-tracker-backend/internal/domain/user/model"
	userService "life-tracker-backend/internal/domain/user/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// setupLogoutRouter registers the protected auth handlers with a real auth
// middleware stub that resolves the seeded user (id 1).
func setupLogoutRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(postgres.Open(authExtraTestDSN()), &gorm.Config{})
	require.NoError(t, err, "Failed to connect to PostgreSQL")

	require.NoError(t, db.AutoMigrate(&model.Auth{}, &userModel.User{}, &model.RefreshToken{}))
	require.NoError(t, db.Exec("TRUNCATE TABLE refresh_tokens RESTART IDENTITY CASCADE").Error)
	require.NoError(t, db.Exec("TRUNCATE TABLE auths RESTART IDENTITY CASCADE").Error)
	require.NoError(t, db.Exec("TRUNCATE TABLE users RESTART IDENTITY CASCADE").Error)

	authService := service.NewAuthService(db, cfg)
	controller := NewAuthController(authService, userService.NewUserService(db, nil))

	router := gin.New()
	auth := router.Group("/auth")
	{
		auth.POST("/register", controller.Register)
		auth.POST("/login", controller.Login)
		auth.POST("/refresh", controller.RefreshToken)

		authenticated := auth.Group("")
		authenticated.Use(func(c *gin.Context) {
			// Resolve the real user id from the presented email, emulating
			// what the JWT middleware would set.
			c.Set("userID", uint(1))
			c.Next()
		})
		{
			authenticated.POST("/logout", controller.Logout)
			authenticated.PUT("/email", controller.UpdateEmail)
		}
	}

	return router, db
}

func authExtraTestDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

func doAuthJSON(t *testing.T, router *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		require.NoError(t, err)
	} else {
		payload = nil
	}

	req := httptest.NewRequest(method, path, bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func registerAuthUser(t *testing.T, router *gin.Engine, email, username string) {
	t.Helper()
	w := doAuthJSON(t, router, http.MethodPost, "/auth/register", dto.RegisterRequest{
		Email:     email,
		Password:  "password123",
		FirstName: "Test",
		LastName:  "User",
		Username:  username,
	})
	require.Equal(t, http.StatusCreated, w.Code)
}

func loginAuthUser(t *testing.T, router *gin.Engine, email string) dto.TokenResponse {
	t.Helper()
	w := doAuthJSON(t, router, http.MethodPost, "/auth/login", dto.LoginRequest{
		Identifier: email,
		Password:   "password123",
	})
	require.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Data struct {
			Tokens dto.TokenResponse `json:"tokens"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	return resp.Data.Tokens
}

func TestLogoutHandler(t *testing.T) {
	router, _ := setupLogoutRouter(t)
	registerAuthUser(t, router, "logout@example.com", "logoutuser")

	t.Run("revokes the presented refresh token", func(t *testing.T) {
		tokens := loginAuthUser(t, router, "logout@example.com")

		w := doAuthJSON(t, router, http.MethodPost, "/auth/logout",
			dto.LogoutRequest{RefreshToken: tokens.RefreshToken})
		assert.Equal(t, http.StatusOK, w.Code)

		// The revoked refresh token must not mint new access tokens.
		w = doAuthJSON(t, router, http.MethodPost, "/auth/refresh",
			dto.RefreshRequest{RefreshToken: tokens.RefreshToken})
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("absent body revokes every session", func(t *testing.T) {
		first := loginAuthUser(t, router, "logout@example.com")
		second := loginAuthUser(t, router, "logout@example.com")

		w := doAuthJSON(t, router, http.MethodPost, "/auth/logout", nil)
		assert.Equal(t, http.StatusOK, w.Code)

		for _, token := range []string{first.RefreshToken, second.RefreshToken} {
			w := doAuthJSON(t, router, http.MethodPost, "/auth/refresh",
				dto.RefreshRequest{RefreshToken: token})
			assert.Equal(t, http.StatusUnauthorized, w.Code, "all sessions must be revoked")
		}
	})

	t.Run("unauthorized without user context", func(t *testing.T) {
		anonRouter := gin.New()
		anonRouter.POST("/auth/logout", NewAuthController(
			service.NewAuthService(mustOpenAuthDB(t), cfg),
			userService.NewUserService(mustOpenAuthDB(t), nil),
		).Logout)

		w := doAuthJSON(t, anonRouter, http.MethodPost, "/auth/logout", nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

// mustOpenAuthDB opens a second connection for the anonymous-router case.
func mustOpenAuthDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(postgres.Open(authExtraTestDSN()), &gorm.Config{})
	require.NoError(t, err)
	return db
}

func TestUpdateEmailHandler_FailurePaths(t *testing.T) {
	router, _ := setupLogoutRouter(t)
	registerAuthUser(t, router, "email@example.com", "emailuser")
	registerAuthUser(t, router, "squatter@example.com", "squatter")

	t.Run("wrong password returns bad request", func(t *testing.T) {
		w := doAuthJSON(t, router, http.MethodPut, "/auth/email", dto.UpdateEmailRequest{
			Password: "wrong-password",
			NewEmail: "new@example.com",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["error"], "password is incorrect")
	})

	t.Run("same email returns bad request", func(t *testing.T) {
		w := doAuthJSON(t, router, http.MethodPut, "/auth/email", dto.UpdateEmailRequest{
			Password: "password123",
			NewEmail: "email@example.com",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["error"], "same as current email")
	})

	t.Run("taken email returns bad request", func(t *testing.T) {
		w := doAuthJSON(t, router, http.MethodPut, "/auth/email", dto.UpdateEmailRequest{
			Password: "password123",
			NewEmail: "squatter@example.com",
		})
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var resp map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Contains(t, resp["error"], "already in use")
	})

	t.Run("malformed body returns bad request", func(t *testing.T) {
		w := doAuthJSON(t, router, http.MethodPut, "/auth/email", nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
