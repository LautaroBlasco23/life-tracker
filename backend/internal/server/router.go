// Package server holds the production HTTP router construction.
//
// The router is the full production surface: middleware chain (RequestID,
// RequestLogger, Recovery, CORS, Timezone, Prometheus), /metrics, /health,
// public + JWT-protected /api routes for every domain, and a catch-all OPTIONS
// handler so CORS preflights flow through CORSMiddleware (see comment below).
// Exposed as a package (rather than an unexported func in main) so the E2E
// suite can exercise the real routing stack with httptest.
package server

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/database"
	"life-tracker-backend/internal/infrastructure/imagestore"
	"life-tracker-backend/internal/middleware"

	activityRoutes "life-tracker-backend/internal/domain/activity/routes"
	authRoutes "life-tracker-backend/internal/domain/auth/routes"
	dataRoutes "life-tracker-backend/internal/domain/data/routes"
	financeRoutes "life-tracker-backend/internal/domain/finance/routes"
	noteGroupRoutes "life-tracker-backend/internal/domain/note-group/routes"
	noteRoutes "life-tracker-backend/internal/domain/note/routes"
	reminderRoutes "life-tracker-backend/internal/domain/reminder/routes"
	routineRoutes "life-tracker-backend/internal/domain/routine/routes"
	screenTimeRoutes "life-tracker-backend/internal/domain/screentime/routes"
	socialRoutes "life-tracker-backend/internal/domain/social/routes"
	timeRoutes "life-tracker-backend/internal/domain/time/routes"
	userRoutes "life-tracker-backend/internal/domain/user/routes"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// NewRouter builds the production gin.Engine. Moved verbatim from
// cmd/main/main.go — any behavior change here is a production bug.
func NewRouter(cfg *config.Config, dbs *database.Connections, imageClient *imagestore.Client) *gin.Engine {
	r := gin.New()

	err := r.SetTrustedProxies([]string{
		"127.0.0.1",
		"172.16.0.0/12", // docker bridge
	})
	if err != nil {
		slog.Error("failed to set trusted proxies", "error", err)
		os.Exit(1)
	}

	// Add middleware. Order matters: request ID first so later middleware can
	// tag their output, request logger before recovery so panicked requests
	// still produce an access-log line via the recovered 500.
	r.Use(middleware.RequestIDMiddleware())
	r.Use(middleware.RequestLoggerMiddleware())
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	r.Use(middleware.TimezoneMiddleware())
	r.Use(middleware.PrometheusMiddleware())

	// Health check endpoint with database status
	r.GET("/health", func(c *gin.Context) {
		// Test PostgreSQL connection
		sqlDB, err := dbs.PostgreSQL.DB()
		postgresStatus := "ok"
		if err != nil || sqlDB.Ping() != nil {
			postgresStatus = "error"
		}

		// Test MongoDB connection
		mongoStatus := "ok"
		if err := dbs.MongoDB.Client().Ping(c.Request.Context(), nil); err != nil {
			mongoStatus = "error"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
			"databases": gin.H{
				"postgresql": postgresStatus,
				"mongodb":    mongoStatus,
			},
		})
	})

	// API routes
	api := r.Group("/api")
	{
		// Auth routes (public)
		authRoutes.RegisterAuthRoutes(api, dbs.PostgreSQL, cfg, imageClient)

		// Public user routes (no auth required)
		userRoutes.RegisterPublicUserRoutes(api, dbs.PostgreSQL, imageClient)

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.JWTAuthMiddleware(cfg.JWTSecret))
		{
			authRoutes.RegisterProtectedAuthRoutes(protected, dbs.PostgreSQL, cfg, imageClient)
			// Register social routes BEFORE user routes to avoid path conflicts
			// Social has /users/:username/followers which is more specific than user's /users/:param
			socialRoutes.RegisterSocialRoutes(protected, dbs.PostgreSQL, dbs.MongoDB)
			userRoutes.RegisterUserRoutes(protected, dbs.PostgreSQL, imageClient)
			dataRoutes.RegisterDataRoutes(protected, dbs.PostgreSQL, dbs.MongoDB)
			activityRoutes.RegisterActivityRoutes(protected, dbs.PostgreSQL, dbs.MongoDB)
			financeRoutes.RegisterFinanceRoutes(protected, dbs.MongoDB)
			screenTimeRoutes.RegisterScreenTimeRoutes(protected, dbs.MongoDB)
			timeRoutes.RegisterTimeRoutes(protected, dbs.PostgreSQL)
			noteRoutes.RegisterNoteRoutes(protected, dbs.PostgreSQL)
			noteGroupRoutes.RegisterNoteGroupRoutes(protected, dbs.PostgreSQL)
			routineRoutes.RegisterRoutineRoutes(protected, dbs.PostgreSQL, dbs.MongoDB)
			reminderRoutes.RegisterReminderRoutes(protected, dbs.PostgreSQL)
		}
	}

	// CORS preflight: for a path registered without an explicit OPTIONS route,
	// Gin answers OPTIONS with an automatic Allow response that skips the
	// middleware chain — so the CORS middleware never sets headers and browsers
	// reject the request ("Failed to fetch"). Register an explicit catch-all so
	// preflights flow through CORSMiddleware (which aborts with 204 + headers).
	// floci's API Gateway does not handle CORS itself, so this must be in the app.
	r.Handle(http.MethodOptions, "/*path", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	return r
}

// NewMetricsRouter exposes only the Prometheus endpoint. It is served on a
// separate internal port (see cmd/main) so route latency / auth-failure
// metrics are never reachable from the public API surface.
func NewMetricsRouter() *gin.Engine {
	m := gin.New()
	m.GET("/metrics", gin.WrapH(promhttp.Handler()))
	return m
}
