package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/database"
	"life-tracker-backend/internal/infrastructure/imagestore"
	"life-tracker-backend/internal/infrastructure/logging"
	"life-tracker-backend/internal/infrastructure/secrets"
	"life-tracker-backend/internal/middleware"

	activityRoutes "life-tracker-backend/internal/domain/activity/routes"
	authRoutes "life-tracker-backend/internal/domain/auth/routes"
	financeRoutes "life-tracker-backend/internal/domain/finance/routes"
	healthRoutes "life-tracker-backend/internal/domain/health/routes"
	noteRoutes "life-tracker-backend/internal/domain/note/routes"
	routineRoutes "life-tracker-backend/internal/domain/routine/routes"
	screenTimeRoutes "life-tracker-backend/internal/domain/screentime/routes"
	socialRoutes "life-tracker-backend/internal/domain/social/routes"
	timeRoutes "life-tracker-backend/internal/domain/time/routes"
	userRoutes "life-tracker-backend/internal/domain/user/routes"

	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// Structured JSON logging first so every log line (including config) is parseable.
	logging.Setup()

	// Load configuration
	cfg := config.Load()

	// Resolve the JWT secret: env wins in dev, Secrets Manager otherwise
	secret, err := secrets.LoadJWTSecret(context.Background(), cfg, cfg.JWTSecret)
	if err != nil {
		return fmt.Errorf("failed to load JWT secret: %w", err)
	}
	cfg.JWTSecret = secret

	// Initialize databases
	dbs, err := database.Initialize(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to databases: %w", err)
	}

	slog.Info("connected to PostgreSQL")
	slog.Info("connected to MongoDB")

	// Image Service
	imageClient, err := imagestore.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("failed to create imagestore client: %w", err)
	}
	defer func() {
		if closeErr := imageClient.Close(); closeErr != nil {
			slog.Warn("failed to close image client", "error", closeErr)
		}
	}()

	slog.Info("connected to ImageStore service")

	// Set Gin mode
	gin.SetMode(cfg.GinMode)

	// Initialize router
	router := newRouter(cfg, dbs, imageClient)

	if cfg.AppRuntime == "serverless" {
		slog.Info("starting Lambda handler")
		lambda.Start(ginadapter.NewV2(router).ProxyWithContext)
		return nil
	}

	// Start server
	port := fmt.Sprintf(":%s", cfg.Port)
	slog.Info("server starting", "port", cfg.Port)
	slog.Info("metrics available at /metrics")
	slog.Info("health check available at /health")

	if err := router.Run(port); err != nil {
		return fmt.Errorf("failed to start server: %w", err)
	}

	return nil
}

func newRouter(cfg *config.Config, dbs *database.Connections, imageClient *imagestore.Client) *gin.Engine {
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
	r.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	r.Use(middleware.TimezoneMiddleware())
	r.Use(middleware.PrometheusMiddleware())

	// monitoring metrics endpoint
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

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
			activityRoutes.RegisterActivityRoutes(protected, dbs.PostgreSQL, dbs.MongoDB)
			financeRoutes.RegisterFinanceRoutes(protected, dbs.MongoDB)
			healthRoutes.RegisterHealthRoutes(protected, dbs.MongoDB)
			screenTimeRoutes.RegisterScreenTimeRoutes(protected, dbs.MongoDB)
			timeRoutes.RegisterTimeRoutes(protected, dbs.PostgreSQL)
			noteRoutes.RegisterNoteRoutes(protected, dbs.PostgreSQL)
			routineRoutes.RegisterRoutineRoutes(protected, dbs.PostgreSQL)
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
