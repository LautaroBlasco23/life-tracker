package database

import (
	"fmt"
	"log/slog"
	"time"

	"life-tracker-backend/internal/config"

	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

type Connections struct {
	PostgreSQL *gorm.DB
	MongoDB    *mongo.Database
}

func Initialize(cfg *config.Config) (*Connections, error) {
	// Migrations and index creation are provision-time concerns for Lambda:
	// they run via cmd/migrate, never per cold start.
	return initializeWithRetry(cfg, 10, 5*time.Second, cfg.AppRuntime != "serverless")
}

func initializeWithRetry(cfg *config.Config, maxRetries int, delay time.Duration, runMigrations bool) (*Connections, error) {
	var (
		postgresDB *gorm.DB
		mongoDB    *mongo.Database
		err        error
	)

	for i := 0; i < maxRetries; i++ {
		postgresDB, err = initializePostgreSQL(cfg, runMigrations)
		if err != nil {
			slog.Warn("failed to connect to PostgreSQL", "attempt", i+1, "max_attempts", maxRetries, "error", err)
			time.Sleep(delay)
			continue
		}

		mongoDB, err = InitializeMongoDB(cfg)
		if err != nil {
			slog.Warn("failed to connect to MongoDB", "attempt", i+1, "max_attempts", maxRetries, "error", err)
			time.Sleep(delay)
			continue
		}

		if runMigrations {
			if err = CreateMongoIndexes(mongoDB); err != nil {
				slog.Warn("failed to create MongoDB indexes", "error", err)
			}
		}

		return &Connections{
			PostgreSQL: postgresDB,
			MongoDB:    mongoDB,
		}, nil
	}

	return nil, fmt.Errorf("failed to connect after %d attempts: %w", maxRetries, err)
}
