package repository

import (
	"context"
	"errors"
	"fmt"

	"life-tracker-backend/internal/domain/health/model"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ExerciseRepository interface {
	Create(ctx context.Context, exercise *model.Exercise) error
	FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.Exercise, error)
	FindByUser(ctx context.Context, userID uint) ([]model.Exercise, error)
	FindByIDs(ctx context.Context, ids []primitive.ObjectID, userID uint) ([]model.Exercise, error)
	Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error
	Delete(ctx context.Context, id primitive.ObjectID, userID uint) error
}

type MongoExerciseRepository struct {
	collection *mongo.Collection
}

func NewExerciseRepository(db *mongo.Database) ExerciseRepository {
	return &MongoExerciseRepository{collection: db.Collection("exercises")}
}

func (r *MongoExerciseRepository) Create(ctx context.Context, exercise *model.Exercise) error {
	result, err := r.collection.InsertOne(ctx, exercise)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ErrExerciseNameConflict
		}
		return fmt.Errorf("inserting exercise: %w", err)
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		exercise.ID = oid
	}
	return nil
}

func (r *MongoExerciseRepository) FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.Exercise, error) {
	var exercise model.Exercise
	err := r.collection.FindOne(ctx, bson.M{"_id": id, "userId": userID}).Decode(&exercise)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrExerciseNotFound
		}
		return nil, fmt.Errorf("finding exercise: %w", err)
	}
	return &exercise, nil
}

func (r *MongoExerciseRepository) FindByUser(ctx context.Context, userID uint) ([]model.Exercise, error) {
	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := r.collection.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		return nil, fmt.Errorf("finding exercises: %w", err)
	}
	defer cursor.Close(ctx)

	var exercises []model.Exercise
	if err := cursor.All(ctx, &exercises); err != nil {
		return nil, fmt.Errorf("decoding exercises: %w", err)
	}
	return exercises, nil
}

func (r *MongoExerciseRepository) FindByIDs(ctx context.Context, ids []primitive.ObjectID, userID uint) ([]model.Exercise, error) {
	if len(ids) == 0 {
		return []model.Exercise{}, nil
	}
	cursor, err := r.collection.Find(ctx, bson.M{"userId": userID, "_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, fmt.Errorf("finding exercises by ids: %w", err)
	}
	defer cursor.Close(ctx)

	var exercises []model.Exercise
	if err := cursor.All(ctx, &exercises); err != nil {
		return nil, fmt.Errorf("decoding exercises by ids: %w", err)
	}
	return exercises, nil
}

func (r *MongoExerciseRepository) Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error {
	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ErrExerciseNameConflict
		}
		return fmt.Errorf("updating exercise: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrExerciseNotFound
	}
	return nil
}

func (r *MongoExerciseRepository) Delete(ctx context.Context, id primitive.ObjectID, userID uint) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id, "userId": userID})
	if err != nil {
		return fmt.Errorf("deleting exercise: %w", err)
	}
	if result.DeletedCount == 0 {
		return ErrExerciseNotFound
	}
	return nil
}
