package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	activityModel "life-tracker-backend/internal/domain/activity/model"
	activityRepository "life-tracker-backend/internal/domain/activity/repository"
	activityService "life-tracker-backend/internal/domain/activity/service"
	"life-tracker-backend/internal/domain/routine/dto"
	"life-tracker-backend/internal/domain/routine/model"
	"life-tracker-backend/internal/domain/routine/repository"

	"go.mongodb.org/mongo-driver/mongo"
	"gorm.io/gorm"
)

type RoutineService struct {
	repo       repository.RoutineRepository
	db         *gorm.DB
	recordRepo activityRepository.ActivityRecordRepository
}

func NewRoutineService(db *gorm.DB, mongoDB *mongo.Database) *RoutineService {
	var recordRepo activityRepository.ActivityRecordRepository
	if mongoDB != nil {
		recordRepo = activityRepository.NewActivityRecordRepository(mongoDB)
	}
	return &RoutineService{
		repo:       repository.NewRoutineRepository(db),
		db:         db,
		recordRepo: recordRepo,
	}
}

// decorateWithCompletions fills TodayCompletions/ScheduledToday for each
// activity item and computes the routine-level IsCompletedToday flag.
// Completion is measured over activities scheduled today only: an activity
// not due today can't be completed today and must not block completion.
func (s *RoutineService) decorateWithCompletions(userID uint, loc *time.Location, responses []*dto.RoutineResponse) {
	if loc == nil {
		loc = time.UTC
	}
	scheduled := activityRepository.CompletionMetadata{
		MonthlyCompletions: make(map[uint]time.Time),
		OneTimeCompletions: make(map[uint]time.Time),
		TodayCompletions:   make(map[uint]int),
	}
	if s.recordRepo != nil && loc != nil {
		ids := make([]uint, 0)
		seen := make(map[uint]bool)
		for _, r := range responses {
			for _, item := range r.Activities {
				if !seen[item.ActivityID] {
					seen[item.ActivityID] = true
					ids = append(ids, item.ActivityID)
				}
			}
		}
		if len(ids) > 0 {
			metadata, err := s.recordRepo.GetCompletionMetadata(context.Background(), userID, ids, loc)
			if err != nil {
				fmt.Printf("Warning: failed to fetch routine completion metadata: %v\n", err)
			} else {
				scheduled = *metadata
			}
		}
	}

	now := time.Now().In(loc)

	for _, r := range responses {
		total, completed := 0, 0
		for i := range r.Activities {
			item := &r.Activities[i]
			metadata := &scheduled
			activity := &activityModel.Activity{
				ID:               item.ActivityID,
				Frequency:        activityModel.Frequency(item.Frequency),
				DayFrequency:     item.DayFrequency,
				CompletionAmount: item.CompletionAmount,
			}
			item.ScheduledToday = activityService.ShouldShowToday(activity, metadata, now)
			item.TodayCompletions = scheduled.TodayCompletions[item.ActivityID]
			if item.ScheduledToday && item.TodayCompletions >= item.CompletionAmount {
				completed++
			}
			if item.ScheduledToday {
				total++
			}
		}
		r.IsCompletedToday = total > 0 && completed == total
	}
}

func (s *RoutineService) validateActivitiesOwnership(userID uint, activityIDs []dto.ActivityIDPosition) error {
	if len(activityIDs) == 0 {
		return nil
	}
	ids := make([]uint, len(activityIDs))
	for i, a := range activityIDs {
		ids[i] = a.ActivityID
	}
	var count int64
	s.db.Model(&activityModel.Activity{}).
		Where("id IN ? AND user_id = ? AND deleted_at IS NULL", ids, userID).
		Count(&count)
	if int(count) != len(ids) {
		return errors.New("one or more activities not found or not owned by user")
	}
	return nil
}

func (s *RoutineService) fetchActivitiesForResponse(routineID uint) []dto.RoutineActivityItem {
	items, err := s.repo.GetActivities(routineID)
	if err != nil || len(items) == 0 {
		return []dto.RoutineActivityItem{}
	}

	activityIDs := make([]uint, len(items))
	for i, it := range items {
		activityIDs[i] = it.ActivityID
	}

	var activities []activityModel.Activity
	s.db.Where("id IN ?", activityIDs).Find(&activities)

	activityMap := make(map[uint]activityModel.Activity, len(activities))
	for _, a := range activities {
		activityMap[a.ID] = a
	}

	result := make([]dto.RoutineActivityItem, len(items))
	for i, it := range items {
		a := activityMap[it.ActivityID]
		result[i] = dto.RoutineActivityItem{
			ActivityID:       it.ActivityID,
			ActivityTitle:    a.Title,
			Description:      a.Description,
			Frequency:        string(a.Frequency),
			DayFrequency:     a.DayFrequency,
			DayTime:          string(a.DayTime),
			PrivacyStatus:    string(a.PrivacyStatus),
			CompletionAmount: a.CompletionAmount,
			Position:         it.Position,
		}
	}
	return result
}

func (s *RoutineService) validateDayFrequency(dayFrequency string) error {
	if dayFrequency == "" {
		return nil
	}
	var days []string
	if err := json.Unmarshal([]byte(dayFrequency), &days); err != nil {
		return errors.New("invalid day frequency format")
	}

	validDays := map[string]bool{
		"monday": true, "tuesday": true, "wednesday": true, "thursday": true,
		"friday": true, "saturday": true, "sunday": true,
	}

	for _, day := range days {
		if !validDays[day] {
			return fmt.Errorf("invalid day: %s", day)
		}
	}

	return nil
}

func normalizeDayTime(dayTime string) activityModel.DayTime {
	if dayTime == "" {
		return activityModel.DayTimeNotSpecified
	}
	return activityModel.DayTime(dayTime)
}

func normalizeStatus(status string) model.RoutineStatus {
	if status == "" {
		return model.StatusActive
	}
	return model.RoutineStatus(status)
}

func (s *RoutineService) CreateRoutine(userID uint, req *dto.CreateRoutineRequest, loc *time.Location) (*dto.RoutineResponse, error) {
	if err := s.validateActivitiesOwnership(userID, req.ActivityIDs); err != nil {
		return nil, err
	}
	if err := s.validateDayFrequency(req.DayFrequency); err != nil {
		return nil, err
	}

	routine := model.Routine{
		UserID:        userID,
		Title:         req.Title,
		Description:   req.Description,
		PrivacyStatus: model.PrivacyStatus(req.PrivacyStatus),
		DayTime:       normalizeDayTime(req.DayTime),
		DayFrequency:  req.DayFrequency,
		Status:        normalizeStatus(req.Status),
	}
	if err := s.repo.Create(&routine); err != nil {
		return nil, errors.New("failed to create routine")
	}

	items := make([]model.RoutineActivity, len(req.ActivityIDs))
	for i, a := range req.ActivityIDs {
		items[i] = model.RoutineActivity{RoutineID: routine.ID, ActivityID: a.ActivityID, Position: a.Position}
	}
	if err := s.repo.SetActivities(routine.ID, items); err != nil {
		return nil, errors.New("failed to set routine activities")
	}

	response := routine.ToResponse(s.fetchActivitiesForResponse(routine.ID))
	s.decorateWithCompletions(userID, loc, []*dto.RoutineResponse{response})
	return response, nil
}

func (s *RoutineService) GetMyRoutines(userID uint, loc *time.Location) ([]*dto.RoutineResponse, error) {
	routines, err := s.repo.FindByUserID(userID)
	if err != nil {
		return nil, errors.New("failed to fetch routines")
	}
	responses := make([]*dto.RoutineResponse, len(routines))
	for i := range routines {
		responses[i] = routines[i].ToResponse(s.fetchActivitiesForResponse(routines[i].ID))
	}
	s.decorateWithCompletions(userID, loc, responses)
	return responses, nil
}

func (s *RoutineService) GetRoutine(userID, routineID uint, loc *time.Location) (*dto.RoutineResponse, error) {
	routine, err := s.repo.FindByIDPublic(routineID)
	if err != nil {
		if errors.Is(err, repository.ErrRoutineNotFound) {
			return nil, errors.New("routine not found")
		}
		return nil, errors.New("failed to fetch routine")
	}
	if routine.UserID != userID && routine.PrivacyStatus != model.PrivacyPublic {
		return nil, errors.New("routine not found")
	}
	response := routine.ToResponse(s.fetchActivitiesForResponse(routine.ID))
	s.decorateWithCompletions(routine.UserID, loc, []*dto.RoutineResponse{response})
	return response, nil
}

func (s *RoutineService) UpdateRoutine(userID, routineID uint, req *dto.UpdateRoutineRequest, loc *time.Location) (*dto.RoutineResponse, error) {
	routine, err := s.repo.FindByID(routineID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrRoutineNotFound) {
			return nil, errors.New("routine not found")
		}
		return nil, errors.New("failed to fetch routine")
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.PrivacyStatus != nil {
		updates["privacy_status"] = *req.PrivacyStatus
	}
	if req.Status != nil {
		updates["status"] = normalizeStatus(*req.Status)
	}
	if req.DayTime != nil {
		updates["day_time"] = normalizeDayTime(*req.DayTime)
	}
	if req.DayFrequency != nil {
		if err := s.validateDayFrequency(*req.DayFrequency); err != nil {
			return nil, err
		}
		updates["day_frequency"] = *req.DayFrequency
	}
	if len(updates) > 0 {
		if updateErr := s.repo.Update(routine, updates); updateErr != nil {
			return nil, errors.New("failed to update routine")
		}
	}

	if req.ActivityIDs != nil {
		if validateErr := s.validateActivitiesOwnership(userID, req.ActivityIDs); validateErr != nil {
			return nil, validateErr
		}
		items := make([]model.RoutineActivity, len(req.ActivityIDs))
		for i, a := range req.ActivityIDs {
			items[i] = model.RoutineActivity{RoutineID: routineID, ActivityID: a.ActivityID, Position: a.Position}
		}
		if setErr := s.repo.SetActivities(routineID, items); setErr != nil {
			return nil, errors.New("failed to update activities")
		}
	}

	updated, err := s.repo.FindByID(routineID, userID)
	if err != nil {
		return nil, errors.New("failed to fetch updated routine")
	}
	response := updated.ToResponse(s.fetchActivitiesForResponse(routineID))
	s.decorateWithCompletions(userID, loc, []*dto.RoutineResponse{response})
	return response, nil
}

func (s *RoutineService) DeleteRoutine(userID, routineID uint) error {
	err := s.repo.Delete(routineID, userID)
	if errors.Is(err, repository.ErrRoutineNotFound) {
		return errors.New("routine not found")
	}
	return err
}

func (s *RoutineService) GetPublicByUser(userID uint, loc *time.Location) ([]*dto.RoutineResponse, error) {
	routines, err := s.repo.FindPublicByUserID(userID)
	if err != nil {
		return nil, errors.New("failed to fetch routines")
	}
	responses := make([]*dto.RoutineResponse, len(routines))
	for i := range routines {
		responses[i] = routines[i].ToResponse(s.fetchActivitiesForResponse(routines[i].ID))
	}
	s.decorateWithCompletions(userID, loc, responses)
	return responses, nil
}
