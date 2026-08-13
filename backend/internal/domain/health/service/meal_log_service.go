package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/model"
	"life-tracker-backend/internal/domain/health/repository"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type MealLogService struct {
	mealLogRepo repository.MealLogRepository
}

func NewMealLogService(db *mongo.Database) *MealLogService {
	return &MealLogService{mealLogRepo: repository.NewMealLogRepository(db)}
}

func (s *MealLogService) CreateMealLog(userID uint, req *dto.CreateMealLogRequest) (*dto.MealLogResponse, error) {
	if !model.IsValidMealType(req.MealType) {
		return nil, errors.New("invalid meal type")
	}

	mealDate := time.Now()
	if !req.Date.IsZero() {
		mealDate = req.Date
	}

	mealLog := model.MealLog{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		MealType:  req.MealType,
		Name:      req.Name,
		Calories:  req.Calories,
		Protein:   req.Protein,
		Carbs:     req.Carbs,
		Fat:       req.Fat,
		Date:      mealDate,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.mealLogRepo.Create(context.Background(), &mealLog); err != nil {
		return nil, fmt.Errorf("creating meal log: %w", err)
	}
	return mealLog.ToResponse(), nil
}

func (s *MealLogService) GetMealLogs(userID uint, mealType *string, startDate, endDate *time.Time, limit int) ([]dto.MealLogResponse, error) {
	mealLogs, err := s.mealLogRepo.FindByFilter(context.Background(), repository.MealLogFilter{
		UserID:    userID,
		MealType:  mealType,
		StartDate: startDate,
		EndDate:   endDate,
	}, limit)
	if err != nil {
		return nil, fmt.Errorf("getting meal logs: %w", err)
	}

	responses := make([]dto.MealLogResponse, 0, len(mealLogs))
	for i := range mealLogs {
		responses = append(responses, *mealLogs[i].ToResponse())
	}
	return responses, nil
}

func (s *MealLogService) GetMealLog(userID uint, mealLogID string) (*dto.MealLogResponse, error) {
	objID, err := primitive.ObjectIDFromHex(mealLogID)
	if err != nil {
		return nil, errors.New("invalid meal log ID")
	}

	mealLog, err := s.mealLogRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrMealLogNotFound) {
			return nil, errors.New("meal log not found")
		}
		return nil, errors.New("failed to fetch meal log")
	}
	return mealLog.ToResponse(), nil
}

func (s *MealLogService) UpdateMealLog(userID uint, mealLogID string, req *dto.UpdateMealLogRequest) (*dto.MealLogResponse, error) {
	objID, err := primitive.ObjectIDFromHex(mealLogID)
	if err != nil {
		return nil, errors.New("invalid meal log ID")
	}

	if req.MealType != nil && !model.IsValidMealType(*req.MealType) {
		return nil, errors.New("invalid meal type")
	}

	_, err = s.mealLogRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrMealLogNotFound) {
			return nil, errors.New("meal log not found")
		}
		return nil, errors.New("failed to fetch meal log")
	}

	updates := bson.M{"updatedAt": time.Now()}
	if req.MealType != nil {
		updates["mealType"] = *req.MealType
	}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Calories != nil {
		updates["calories"] = *req.Calories
	}
	if req.Protein != nil {
		updates["protein"] = *req.Protein
	}
	if req.Carbs != nil {
		updates["carbs"] = *req.Carbs
	}
	if req.Fat != nil {
		updates["fat"] = *req.Fat
	}
	if req.Date != nil {
		updates["date"] = *req.Date
	}

	if err := s.mealLogRepo.Update(context.Background(), objID, updates); err != nil {
		return nil, errors.New("failed to update meal log")
	}
	return s.GetMealLog(userID, mealLogID)
}

func (s *MealLogService) DeleteMealLog(userID uint, mealLogID string) error {
	objID, err := primitive.ObjectIDFromHex(mealLogID)
	if err != nil {
		return errors.New("invalid meal log ID")
	}

	if err := s.mealLogRepo.Delete(context.Background(), objID, userID); err != nil {
		if errors.Is(err, repository.ErrMealLogNotFound) {
			return errors.New("meal log not found")
		}
		return errors.New("failed to delete meal log")
	}
	return nil
}

func (s *MealLogService) GetNutritionSummary(userID uint, startDate, endDate time.Time, loc *time.Location) (*dto.NutritionSummaryResponse, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, loc)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, loc)

	results, err := s.mealLogRepo.AggregateDaily(context.Background(), userID, start, end, loc)
	if err != nil {
		return nil, fmt.Errorf("getting nutrition summary: %w", err)
	}

	summary := &dto.NutritionSummaryResponse{
		StartDate: startDate.Format("2006-01-02"),
		EndDate:   endDate.Format("2006-01-02"),
		Daily:     make([]dto.DailyNutritionSummary, 0, len(results)),
	}
	for _, r := range results {
		day := dto.DailyNutritionSummary{
			Date:      fmt.Sprintf("%04d-%02d-%02d", r.Year, r.Month, r.Day),
			Calories:  r.Calories,
			Protein:   r.Protein,
			Carbs:     r.Carbs,
			Fat:       r.Fat,
			MealCount: r.MealCount,
		}
		summary.Daily = append(summary.Daily, day)
		summary.Totals.Calories += r.Calories
		summary.Totals.Protein += r.Protein
		summary.Totals.Carbs += r.Carbs
		summary.Totals.Fat += r.Fat
		summary.Totals.MealCount += r.MealCount
	}
	return summary, nil
}
