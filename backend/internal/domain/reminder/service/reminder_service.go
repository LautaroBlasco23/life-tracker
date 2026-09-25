package service

import (
	"errors"
	"log/slog"
	"time"

	"life-tracker-backend/internal/domain/reminder/dto"
	"life-tracker-backend/internal/domain/reminder/model"
	"life-tracker-backend/internal/domain/reminder/repository"

	"gorm.io/gorm"
)

type ReminderService struct {
	reminderRepo repository.ReminderRepository
}

func NewReminderService(db *gorm.DB) *ReminderService {
	return &ReminderService{
		reminderRepo: repository.NewReminderRepository(db),
	}
}

func (s *ReminderService) CreateReminder(userID uint, req *dto.CreateReminderRequest) (*dto.ReminderResponse, error) {
	activeFrom := time.Now()
	if req.ActiveFrom != nil {
		activeFrom = *req.ActiveFrom
	}
	if !activeFrom.Before(req.DueAt) {
		return nil, errors.New("active window must open before the deadline")
	}

	privacy := model.PrivacyPrivate
	if req.PrivacyStatus != "" {
		privacy = model.PrivacyStatus(req.PrivacyStatus)
	}

	reminder := model.Reminder{
		UserID:        userID,
		Title:         req.Title,
		Description:   req.Description,
		DueAt:         req.DueAt,
		ActiveFrom:    &activeFrom,
		PrivacyStatus: privacy,
	}

	if err := s.reminderRepo.Create(&reminder); err != nil {
		return nil, errors.New("failed to create reminder")
	}

	slog.Info("reminder created",
		"event", "REMINDER_CREATED",
		"user_id", userID,
		"reminder_id", reminder.ID,
		"title", reminder.Title,
	)

	return reminder.ToResponse(), nil
}

func (s *ReminderService) GetUserReminders(userID uint) ([]*dto.ReminderResponse, error) {
	reminders, err := s.reminderRepo.FindByUserID(userID)
	if err != nil {
		return nil, errors.New("failed to fetch reminders")
	}

	responses := make([]*dto.ReminderResponse, len(reminders))
	for i := range reminders {
		responses[i] = reminders[i].ToResponse()
	}
	return responses, nil
}

func (s *ReminderService) GetReminder(userID, reminderID uint) (*dto.ReminderResponse, error) {
	reminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrReminderNotFound) {
			return nil, errors.New("reminder not found")
		}
		return nil, errors.New("failed to fetch reminder")
	}
	return reminder.ToResponse(), nil
}

func (s *ReminderService) UpdateReminder(userID, reminderID uint, req *dto.UpdateReminderRequest) (*dto.ReminderResponse, error) {
	reminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		return nil, errors.New("reminder not found")
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.DueAt != nil {
		updates["due_at"] = *req.DueAt
	}
	if req.ActiveFrom != nil {
		updates["active_from"] = *req.ActiveFrom
	}
	if req.PrivacyStatus != nil {
		updates["privacy_status"] = *req.PrivacyStatus
	}

	if len(updates) > 0 {
		dueAt := reminder.DueAt
		if t, ok := updates["due_at"].(time.Time); ok {
			dueAt = t
		}
		activeFrom := time.Now()
		if reminder.ActiveFrom != nil {
			activeFrom = *reminder.ActiveFrom
		}
		if t, ok := updates["active_from"].(time.Time); ok {
			activeFrom = t
		}
		if !activeFrom.Before(dueAt) {
			return nil, errors.New("active window must open before the deadline")
		}

		if err = s.reminderRepo.Update(reminder, updates); err != nil {
			return nil, errors.New("failed to update reminder")
		}
	}

	updatedReminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		return nil, errors.New("failed to fetch updated reminder")
	}

	slog.Info("reminder updated",
		"event", "REMINDER_UPDATED",
		"user_id", userID,
		"reminder_id", reminderID,
	)

	return updatedReminder.ToResponse(), nil
}

func (s *ReminderService) CompleteReminder(userID, reminderID uint) (*dto.ReminderResponse, error) {
	reminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		return nil, errors.New("reminder not found")
	}

	if reminder.CompletedAt != nil {
		return nil, errors.New("reminder already completed")
	}

	now := time.Now()
	if reminder.ActiveFrom != nil && now.Before(*reminder.ActiveFrom) {
		return nil, errors.New("reminder is not active yet")
	}

	if err = s.reminderRepo.Update(reminder, map[string]interface{}{
		"completed_at": now,
	}); err != nil {
		return nil, errors.New("failed to complete reminder")
	}

	slog.Info("reminder completed",
		"event", "REMINDER_COMPLETED",
		"user_id", userID,
		"reminder_id", reminderID,
	)

	return s.GetReminder(userID, reminderID)
}

func (s *ReminderService) RevertCompletion(userID, reminderID uint) error {
	reminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		return errors.New("reminder not found")
	}

	if reminder.CompletedAt == nil {
		return errors.New("no completion to revert")
	}

	if err = s.reminderRepo.Update(reminder, map[string]interface{}{
		"completed_at": nil,
	}); err != nil {
		return errors.New("failed to revert reminder completion")
	}

	slog.Info("reminder completion reverted",
		"event", "REMINDER_COMPLETION_REVERTED",
		"user_id", userID,
		"reminder_id", reminderID,
	)

	return nil
}

func (s *ReminderService) DeleteReminder(userID, reminderID uint) error {
	reminder, err := s.reminderRepo.FindByID(reminderID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrReminderNotFound) {
			return errors.New("reminder not found")
		}
		return errors.New("failed to fetch reminder")
	}

	if err := s.reminderRepo.Delete(reminderID, userID); err != nil {
		if errors.Is(err, repository.ErrReminderNotFound) {
			return errors.New("reminder not found")
		}
		return errors.New("failed to delete reminder")
	}

	slog.Info("reminder deleted",
		"event", "REMINDER_DELETED",
		"user_id", userID,
		"reminder_id", reminderID,
		"title", reminder.Title,
	)

	return nil
}
