package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"life-tracker-backend/internal/domain/health/dto"
	"life-tracker-backend/internal/domain/health/model"
	"life-tracker-backend/internal/domain/health/repository"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type WorkoutService struct {
	workoutRepo  repository.WorkoutRepository
	exerciseRepo repository.ExerciseRepository
}

func NewWorkoutService(db *mongo.Database) *WorkoutService {
	return &WorkoutService{
		workoutRepo:  repository.NewWorkoutRepository(db),
		exerciseRepo: repository.NewExerciseRepository(db),
	}
}

func (s *WorkoutService) validateSessionExercises(userID uint, reqExercises []dto.SessionExerciseRequest) ([]model.SessionExercise, error) {
	if len(reqExercises) == 0 {
		return nil, errors.New("workout must include at least one exercise")
	}

	exercises := make([]model.SessionExercise, 0, len(reqExercises))
	for _, se := range reqExercises {
		exerciseID, err := primitive.ObjectIDFromHex(se.ExerciseID)
		if err != nil {
			return nil, errors.New("invalid exercise ID")
		}
		if _, err := s.exerciseRepo.FindByID(context.Background(), exerciseID, userID); err != nil {
			return nil, errors.New("exercise not found")
		}

		sets := make([]model.WorkoutSet, 0, len(se.Sets))
		for _, set := range se.Sets {
			if set.Reps <= 0 {
				return nil, errors.New("reps must be greater than zero")
			}
			if set.WeightKg < 0 {
				return nil, errors.New("weight cannot be negative")
			}
			sets = append(sets, model.WorkoutSet{Reps: set.Reps, WeightKg: set.WeightKg})
		}
		exercises = append(exercises, model.SessionExercise{ExerciseID: exerciseID, Sets: sets})
	}
	return exercises, nil
}

func (s *WorkoutService) CreateWorkoutSession(userID uint, req *dto.CreateWorkoutSessionRequest) (*dto.WorkoutSessionResponse, error) {
	exercises, err := s.validateSessionExercises(userID, req.Exercises)
	if err != nil {
		return nil, err
	}

	sessionDate := time.Now()
	if !req.Date.IsZero() {
		sessionDate = req.Date
	}

	session := model.WorkoutSession{
		ID:              primitive.NewObjectID(),
		UserID:          userID,
		Date:            sessionDate,
		DurationMinutes: req.DurationMinutes,
		Notes:           req.Notes,
		Exercises:       exercises,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.workoutRepo.Create(context.Background(), &session); err != nil {
		return nil, errors.New("failed to create workout session")
	}
	return session.ToResponse(), nil
}

func (s *WorkoutService) GetWorkoutSessions(userID uint, startDate, endDate *time.Time) ([]dto.WorkoutSessionResponse, error) {
	sessions, err := s.workoutRepo.FindByFilter(context.Background(), repository.WorkoutFilter{
		UserID:    userID,
		StartDate: startDate,
		EndDate:   endDate,
	})
	if err != nil {
		return nil, errors.New("failed to fetch workout sessions")
	}

	responses := make([]dto.WorkoutSessionResponse, 0, len(sessions))
	for i := range sessions {
		responses = append(responses, *sessions[i].ToResponse())
	}
	return responses, nil
}

func (s *WorkoutService) GetWorkoutSession(userID uint, sessionID string) (*dto.WorkoutSessionResponse, error) {
	objID, err := primitive.ObjectIDFromHex(sessionID)
	if err != nil {
		return nil, errors.New("invalid workout session ID")
	}

	session, err := s.workoutRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrWorkoutNotFound) {
			return nil, errors.New("workout session not found")
		}
		return nil, errors.New("failed to fetch workout session")
	}
	return session.ToResponse(), nil
}

func (s *WorkoutService) UpdateWorkoutSession(userID uint, sessionID string, req *dto.UpdateWorkoutSessionRequest) (*dto.WorkoutSessionResponse, error) {
	objID, err := primitive.ObjectIDFromHex(sessionID)
	if err != nil {
		return nil, errors.New("invalid workout session ID")
	}

	_, err = s.workoutRepo.FindByID(context.Background(), objID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrWorkoutNotFound) {
			return nil, errors.New("workout session not found")
		}
		return nil, errors.New("failed to fetch workout session")
	}

	updates := bson.M{"updatedAt": time.Now()}
	if req.Date != nil {
		updates["date"] = *req.Date
	}
	if req.DurationMinutes != nil {
		updates["durationMinutes"] = *req.DurationMinutes
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.Exercises != nil {
		exercises, err := s.validateSessionExercises(userID, *req.Exercises)
		if err != nil {
			return nil, err
		}
		updates["exercises"] = exercises
	}

	if err := s.workoutRepo.Update(context.Background(), objID, updates); err != nil {
		return nil, errors.New("failed to update workout session")
	}
	return s.GetWorkoutSession(userID, sessionID)
}

func (s *WorkoutService) DeleteWorkoutSession(userID uint, sessionID string) error {
	objID, err := primitive.ObjectIDFromHex(sessionID)
	if err != nil {
		return errors.New("invalid workout session ID")
	}

	if err := s.workoutRepo.Delete(context.Background(), objID, userID); err != nil {
		if errors.Is(err, repository.ErrWorkoutNotFound) {
			return errors.New("workout session not found")
		}
		return errors.New("failed to delete workout session")
	}
	return nil
}

func (s *WorkoutService) GetGymStats(userID uint, startDate, endDate time.Time, loc *time.Location) (*dto.GymStatsResponse, error) {
	start := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, loc)
	end := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, loc)

	sessions, err := s.workoutRepo.FindByFilter(context.Background(), repository.WorkoutFilter{
		UserID:    userID,
		StartDate: &start,
		EndDate:   &end,
	})
	if err != nil {
		return nil, errors.New("failed to fetch workout sessions")
	}

	// Build a lookup of exercises so muscle groups can be resolved for stats.
	exerciseIDs := make([]primitive.ObjectID, 0)
	seen := make(map[primitive.ObjectID]struct{})
	for i := range sessions {
		for _, se := range sessions[i].Exercises {
			if _, ok := seen[se.ExerciseID]; !ok {
				seen[se.ExerciseID] = struct{}{}
				exerciseIDs = append(exerciseIDs, se.ExerciseID)
			}
		}
	}
	exercises, err := s.exerciseRepo.FindByIDs(context.Background(), exerciseIDs, userID)
	if err != nil {
		return nil, errors.New("failed to fetch exercises")
	}
	exerciseByID := make(map[primitive.ObjectID]model.Exercise, len(exercises))
	for _, ex := range exercises {
		exerciseByID[ex.ID] = ex
	}

	muscleVolume := make(map[string]float64)
	muscleSessions := make(map[string]map[string]struct{})
	weeklyVolume := make(map[string]float64)

	for i := range sessions {
		sessionDate := sessions[i].Date.In(loc)
		weekStart := mondayOfWeek(sessionDate)

		for _, se := range sessions[i].Exercises {
			exercise, ok := exerciseByID[se.ExerciseID]
			if !ok {
				// Exercise was deleted; skip rather than fail stats.
				continue
			}

			var volume float64
			for _, set := range se.Sets {
				volume += set.WeightKg * float64(set.Reps)
			}

			for _, muscle := range exercise.MuscleGroups {
				muscleVolume[muscle] += volume
				if _, exists := muscleSessions[muscle]; !exists {
					muscleSessions[muscle] = make(map[string]struct{})
				}
				muscleSessions[muscle][sessions[i].ID.Hex()] = struct{}{}
			}
			weeklyVolume[weekStart] += volume
		}
	}

	muscleVolumeResponse := make([]dto.MuscleVolume, 0, len(muscleVolume))
	for muscle, volume := range muscleVolume {
		muscleVolumeResponse = append(muscleVolumeResponse, dto.MuscleVolume{
			MuscleGroup: muscle,
			VolumeKg:    volume,
			Sessions:    len(muscleSessions[muscle]),
		})
	}
	sort.Slice(muscleVolumeResponse, func(i, j int) bool {
		return muscleVolumeResponse[i].VolumeKg > muscleVolumeResponse[j].VolumeKg
	})

	weeklyVolumeResponse := make([]dto.WeeklyVolume, 0, len(weeklyVolume))
	for weekStart, volume := range weeklyVolume {
		weeklyVolumeResponse = append(weeklyVolumeResponse, dto.WeeklyVolume{
			WeekStart: weekStart,
			VolumeKg:  volume,
		})
	}
	sort.Slice(weeklyVolumeResponse, func(i, j int) bool {
		return weeklyVolumeResponse[i].WeekStart < weeklyVolumeResponse[j].WeekStart
	})

	return &dto.GymStatsResponse{
		StartDate:    startDate.Format("2006-01-02"),
		EndDate:      endDate.Format("2006-01-02"),
		WorkoutCount: len(sessions),
		MuscleVolume: muscleVolumeResponse,
		WeeklyVolume: weeklyVolumeResponse,
	}, nil
}

func mondayOfWeek(t time.Time) string {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // treat Sunday as the last day of the week
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return monday.Format("2006-01-02")
}
