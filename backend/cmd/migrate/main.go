package main

import (
	"log"

	"life-tracker-backend/internal/config"
	"life-tracker-backend/internal/database"
)

func main() {
	cfg := config.Load()

	_, err := database.InitializePostgreSQL(cfg)
	if err != nil {
		log.Fatalf("failed to connect to PostgreSQL: %v", err)
	}
	log.Println("✅ PostgreSQL migrations applied")

	mongoDB, err := database.InitializeMongoDB(cfg)
	if err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}

	if err := database.CreateMongoIndexes(mongoDB); err != nil {
		log.Fatalf("failed to create MongoDB indexes: %v", err)
	}
	log.Println("✅ MongoDB indexes created")
}
