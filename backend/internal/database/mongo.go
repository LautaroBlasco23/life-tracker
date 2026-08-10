package database

import (
	"context"
	"fmt"
	"time"

	"life-tracker-backend/internal/config"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func InitializeMongoDB(cfg *config.Config) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Create MongoDB client
	clientOpts := options.Client().ApplyURI(cfg.MongoURI).
		SetMaxConnIdleTime(30 * time.Second).
		SetMaxConnecting(2).
		SetMinPoolSize(0)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Test the connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	return client.Database(cfg.MongoDatabase), nil
}

func CreateMongoIndexes(db *mongo.Database) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Activity records collection indexes
	activityRecordsCollection := db.Collection("activity_records")

	// Index for querying user's activity records
	// Ordered bson.D required: DocumentDB rejects map-based (unordered) index
	// key specs with "multi-key map passed in for ordered parameter keys".
	userActivityIndex := mongo.IndexModel{
		Keys: bson.D{
			{Key: "userId", Value: 1},
			{Key: "activityId", Value: 1},
		},
	}

	// Index for date-based queries (for streaks, stats)
	dateIndex := mongo.IndexModel{
		Keys: bson.D{
			{Key: "userId", Value: 1},
			{Key: "activityId", Value: 1},
			{Key: "completionDate", Value: -1}, // Descending for recent first
		},
	}

	// Create indexes
	_, err := activityRecordsCollection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		userActivityIndex,
		dateIndex,
	})
	if err != nil {
		return fmt.Errorf("failed to create MongoDB indexes: %w", err)
	}

	return nil
}
