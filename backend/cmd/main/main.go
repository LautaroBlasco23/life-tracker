package main

import (
	"context"
	"errors"
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
	"life-tracker-backend/internal/server"

	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"
)

// metricsPort is the internal-only port the Prometheus endpoint listens on.
// It is deliberately not published in docker-compose; only same-network
// scrapers can reach it.
const metricsPort = "9091"

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

	// Refuse to run with insecure secrets (skipped for the test environment).
	if verr := cfg.Validate(); verr != nil {
		return fmt.Errorf("configuration validation failed: %w", verr)
	}

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

	// Initialize router (production wiring lives in internal/server so the
	// E2E suite can exercise the real routing stack).
	router := server.NewRouter(cfg, dbs, imageClient)

	if cfg.AppRuntime == "serverless" {
		slog.Info("starting Lambda handler")
		lambda.Start(ginadapter.NewV2(router).ProxyWithContext)
		return nil
	}

	// Start server
	port := fmt.Sprintf(":%s", cfg.Port)
	slog.Info("server starting", "port", cfg.Port)
	slog.Info("metrics listening on separate internal port", "port", metricsPort)
	slog.Info("health check available at /health")

	// Metrics are served on a separate listener that is not published to the
	// host: only same-network scrapers (Prometheus) can reach it.
	metricsSrv := &http.Server{
		Addr:              fmt.Sprintf(":%s", metricsPort),
		Handler:           server.NewMetricsRouter(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		if err := metricsSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("metrics server failed", "error", err)
		}
	}()
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := metricsSrv.Shutdown(shutdownCtx); err != nil {
			slog.Warn("metrics server shutdown failed", "error", err)
		}
	}()

	if err := router.Run(port); err != nil {
		return fmt.Errorf("failed to start server: %w", err)
	}

	return nil
}
