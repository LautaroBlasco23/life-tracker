package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"life-tracker-backend/internal/domain/health/model"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type WorkoutFilter struct {
	UserID    uint
	StartDate *time.Time
	EndDate   *time.Time
}

type WorkoutRepository interface {
	Create(ctx context.Context, session *model.WorkoutSession) error
	FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.WorkoutSession, error)
	FindByFilter(ctx context.Context, filter WorkoutFilter) ([]model.WorkoutSession, error)
	Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error
	Delete(ctx context.Context, id primitive.ObjectID, userID uint) error
}

type MongoWorkoutRepository struct {
	collection *mongo.Collection
}

func NewWorkoutRepository(db *mongo.Database) WorkoutRepository {
	return &MongoWorkoutRepository{collection: db.Collection("workout_sessions")}
}

func (r *MongoWorkoutRepository) Create(ctx context.Context, session *model.WorkoutSession) error {
	result, err := r.collection.InsertOne(ctx, session)
	if err != nil {
		return fmt.Errorf("inserting workout session: %w", err)
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		session.ID = oid
	}
	return nil
}

func (r *MongoWorkoutRepository) FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.WorkoutSession, error) {
	var session model.WorkoutSession
	err := r.collection.FindOne(ctx, bson.M{"_id": id, "userId": userID}).Decode(&session)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrWorkoutNotFound
		}
		return nil, fmt.Errorf("finding workout session: %w", err)
	}
	return &session, nil
}

func (r *MongoWorkoutRepository) FindByFilter(ctx context.Context, filter WorkoutFilter) ([]model.WorkoutSession, error) {
	bsonFilter := bson.M{"userId": filter.UserID}

	if filter.StartDate != nil || filter.EndDate != nil {
		dateFilter := bson.M{}
		if filter.StartDate != nil {
			dateFilter["$gte"] = filter.StartDate.UTC()
		}
		if filter.EndDate != nil {
			dateFilter["$lte"] = filter.EndDate.UTC()
		}
		bsonFilter["date"] = dateFilter
	}

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("finding workout sessions: %w", err)
	}
	defer cursor.Close(ctx)

	var sessions []model.WorkoutSession
	if err := cursor.All(ctx, &sessions); err != nil {
		return nil, fmt.Errorf("decoding workout sessions: %w", err)
	}
	return sessions, nil
}

func (r *MongoWorkoutRepository) Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error {
	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		return fmt.Errorf("updating workout session: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrWorkoutNotFound
	}
	return nil
}

func (r *MongoWorkoutRepository) Delete(ctx context.Context, id primitive.ObjectID, userID uint) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id, "userId": userID})
	if err != nil {
		return fmt.Errorf("deleting workout session: %w", err)
	}
	if result.DeletedCount == 0 {
		return ErrWorkoutNotFound
	}
	return nil
}
