package service

import (
	"context"
	"errors"
	"time"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/model"
	"life-tracker-backend/internal/domain/health/repository"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ExerciseService struct {
	exerciseRepo repository.ExerciseRepository
}

func NewExerciseService(db *mongo.Database) *ExerciseService {
	return &ExerciseService{exerciseRepo: repository.NewExerciseRepository(db)}
}

func validateMuscleGroups(groups []string) error {
	for _, g := range groups {
		if !model.IsValidMuscleGroup(g) {
			return errors.New("invalid muscle group: " + g)
		}
	}
	return nil
}

func (s *ExerciseService) CreateExercise(userID uint, req *dto.CreateExerciseRequest) (*dto.ExerciseResponse, error) {
	if err := validateMuscleGroups(req.MuscleGroups); err != nil {
		return nil, err
	}

	exercise := model.Exercise{
		ID:           primitive.NewObjectID(),
		UserID:       userID,
		Name:         req.Name,
		MuscleGroups: req.MuscleGroups,
		CreatedAt:    time.Now(),
	}

	if err := s.exerciseRepo.Create(context.Background(), &exercise); err != nil {
		if errors.Is(err, repository.ErrExerciseNameConflict) {
			return nil, errors.New("an exercise with this name already exists")
		}
		return nil, errors.New("failed to create exercise")
	}
	return exercise.ToResponse(), nil
}

func (s *ExerciseService) GetExercises(userID uint) ([]dto.ExerciseResponse, error) {
	exercises, err := s.exerciseRepo.FindByUser(context.Background(), userID)
	if err != nil {
		return nil, errors.New("failed to fetch exercises")
	}

	responses := make([]dto.ExerciseResponse, 0, len(exercises))
	for i := range exercises {
		responses = append(responses, *exercises[i].ToResponse())
	}
	return responses, nil
}

func (s *ExerciseService) UpdateExercise(userID uint, exerciseID string, req *dto.UpdateExerciseRequest) (*dto.ExerciseResponse, error) {
	objID, err := primitive.ObjectIDFromHex(exerciseID)
	if err != nil {
		return nil, errors.New("invalid exercise ID")
	}

	if req.MuscleGroups != nil {
		if err := validateMuscleGroups(*req.MuscleGroups); err != nil {
			return nil, err
		}
	}

	_, err = s.exerciseRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrExerciseNotFound) {
			return nil, errors.New("exercise not found")
		}
		return nil, errors.New("failed to fetch exercise")
	}

	updates := bson.M{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.MuscleGroups != nil {
		updates["muscleGroups"] = *req.MuscleGroups
	}

	if err := s.exerciseRepo.Update(context.Background(), objID, updates); err != nil {
		if errors.Is(err, repository.ErrExerciseNameConflict) {
			return nil, errors.New("an exercise with this name already exists")
		}
		return nil, errors.New("failed to update exercise")
	}

	exercise, err := s.exerciseRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		return nil, errors.New("failed to fetch exercise")
	}
	return exercise.ToResponse(), nil
}

func (s *ExerciseService) DeleteExercise(userID uint, exerciseID string) error {
	objID, err := primitive.ObjectIDFromHex(exerciseID)
	if err != nil {
		return errors.New("invalid exercise ID")
	}

	if err := s.exerciseRepo.Delete(context.Background(), objID, userID); err != nil {
		if errors.Is(err, repository.ErrExerciseNotFound) {
			return errors.New("exercise not found")
		}
		return errors.New("failed to delete exercise")
	}
	return nil
}
