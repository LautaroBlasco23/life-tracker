package database

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"life-tracker-backend/internal/config"
)

func InitializePostgreSQL(cfg *config.Config) (*gorm.DB, error) {
	return initializePostgreSQL(cfg, true)
}

func initializePostgreSQL(cfg *config.Config, runMigrations bool) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode,
	)

	// SQL logging: bound values (emails, token hashes, user text) must not end
	// up in prod logs, so Info-level SQL tracing is dev-only.
	logLevel := logger.Warn
	if cfg.Environment == "dev" {
		logLevel = logger.Info
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB from gorm: %w", err)
	}
	// Pool limits suit short-lived Lambda containers (bounded connections that
	// re-establish between warm starts) and are harmless for the long-lived
	// container server, so they apply always.
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxIdleTime(30 * time.Second)
	sqlDB.SetConnMaxLifetime(3 * time.Minute)

	if runMigrations {
		if err := RunMigrations(db); err != nil {
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}
	}

	return db, nil
}
