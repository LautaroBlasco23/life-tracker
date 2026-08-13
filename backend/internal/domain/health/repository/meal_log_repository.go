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

var (
	ErrMealLogNotFound      = errors.New("meal log not found")
	ErrExerciseNotFound     = errors.New("exercise not found")
	ErrWorkoutNotFound      = errors.New("workout session not found")
	ErrInvalidObjectID      = errors.New("invalid id")
	ErrExerciseNameConflict = errors.New("exercise name already exists")
)

type MealLogFilter struct {
	UserID    uint
	MealType  *string
	StartDate *time.Time
	EndDate   *time.Time
}

type DailyAggregationResult struct {
	Year      int
	Month     int
	Day       int
	Calories  float64
	Protein   float64
	Carbs     float64
	Fat       float64
	MealCount int64
}

type MealLogRepository interface {
	Create(ctx context.Context, mealLog *model.MealLog) error
	FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.MealLog, error)
	FindByFilter(ctx context.Context, filter MealLogFilter, limit int) ([]model.MealLog, error)
	Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error
	Delete(ctx context.Context, id primitive.ObjectID, userID uint) error
	AggregateDaily(ctx context.Context, userID uint, startDate, endDate time.Time, loc *time.Location) ([]DailyAggregationResult, error)
}

type MongoMealLogRepository struct {
	collection *mongo.Collection
}

func NewMealLogRepository(db *mongo.Database) MealLogRepository {
	return &MongoMealLogRepository{collection: db.Collection("meal_logs")}
}

func (r *MongoMealLogRepository) Create(ctx context.Context, mealLog *model.MealLog) error {
	result, err := r.collection.InsertOne(ctx, mealLog)
	if err != nil {
		return fmt.Errorf("inserting meal log: %w", err)
	}
	if oid, ok := result.InsertedID.(primitive.ObjectID); ok {
		mealLog.ID = oid
	}
	return nil
}

func (r *MongoMealLogRepository) FindByID(ctx context.Context, id primitive.ObjectID, userID uint) (*model.MealLog, error) {
	var mealLog model.MealLog
	err := r.collection.FindOne(ctx, bson.M{"_id": id, "userId": userID}).Decode(&mealLog)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrMealLogNotFound
		}
		return nil, fmt.Errorf("finding meal log: %w", err)
	}
	return &mealLog, nil
}

func (r *MongoMealLogRepository) FindByFilter(ctx context.Context, filter MealLogFilter, limit int) ([]model.MealLog, error) {
	bsonFilter := bson.M{"userId": filter.UserID}

	if filter.MealType != nil {
		bsonFilter["mealType"] = *filter.MealType
	}

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
	if limit > 0 {
		opts.SetLimit(int64(limit))
	}

	cursor, err := r.collection.Find(ctx, bsonFilter, opts)
	if err != nil {
		return nil, fmt.Errorf("finding meal logs: %w", err)
	}
	defer cursor.Close(ctx)

	var mealLogs []model.MealLog
	if err := cursor.All(ctx, &mealLogs); err != nil {
		return nil, fmt.Errorf("decoding meal logs: %w", err)
	}
	return mealLogs, nil
}

func (r *MongoMealLogRepository) Update(ctx context.Context, id primitive.ObjectID, updates bson.M) error {
	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		return fmt.Errorf("updating meal log: %w", err)
	}
	if result.MatchedCount == 0 {
		return ErrMealLogNotFound
	}
	return nil
}

func (r *MongoMealLogRepository) Delete(ctx context.Context, id primitive.ObjectID, userID uint) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id, "userId": userID})
	if err != nil {
		return fmt.Errorf("deleting meal log: %w", err)
	}
	if result.DeletedCount == 0 {
		return ErrMealLogNotFound
	}
	return nil
}

func (r *MongoMealLogRepository) AggregateDaily(ctx context.Context, userID uint, startDate, endDate time.Time, loc *time.Location) ([]DailyAggregationResult, error) {
	pipeline := []bson.M{
		{
			"$match": bson.M{
				"userId": userID,
				"date": bson.M{
					"$gte": startDate.UTC(),
					"$lte": endDate.UTC(),
				},
			},
		},
		{
			"$addFields": bson.M{
				"localDate": bson.M{
					"$dateToParts": bson.M{
						"date":     "$date",
						"timezone": loc.String(),
					},
				},
			},
		},
		{
			"$group": bson.M{
				"_id": bson.M{
					"year":  "$localDate.year",
					"month": "$localDate.month",
					"day":   "$localDate.day",
				},
				"calories":  bson.M{"$sum": "$calories"},
				"protein":   bson.M{"$sum": "$protein"},
				"carbs":     bson.M{"$sum": "$carbs"},
				"fat":       bson.M{"$sum": "$fat"},
				"mealCount": bson.M{"$sum": 1},
			},
		},
		{
			"$sort": bson.M{
				"_id.year":  1,
				"_id.month": 1,
				"_id.day":   1,
			},
		},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("aggregating daily nutrition: %w", err)
	}
	defer cursor.Close(ctx)

	var results []DailyAggregationResult
	for cursor.Next(ctx) {
		var raw struct {
			ID struct {
				Year  int `bson:"year"`
				Month int `bson:"month"`
				Day   int `bson:"day"`
			} `bson:"_id"`
			Calories  float64 `bson:"calories"`
			Protein   float64 `bson:"protein"`
			Carbs     float64 `bson:"carbs"`
			Fat       float64 `bson:"fat"`
			MealCount int64   `bson:"mealCount"`
		}
		if err := cursor.Decode(&raw); err != nil {
			continue
		}
		results = append(results, DailyAggregationResult{
			Year:      raw.ID.Year,
			Month:     raw.ID.Month,
			Day:       raw.ID.Day,
			Calories:  raw.Calories,
			Protein:   raw.Protein,
			Carbs:     raw.Carbs,
			Fat:       raw.Fat,
			MealCount: raw.MealCount,
		})
	}
	return results, nil
}
