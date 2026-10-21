package service

import (
	"errors"
	"time"

	"life-tracker-backend/internal/domain/calendar/dto"
	"life-tracker-backend/internal/domain/calendar/model"
	"life-tracker-backend/internal/domain/calendar/repository"

	"gorm.io/gorm"
)

const maxEventDuration = 24 * time.Hour

type CalendarService struct {
	repo repository.CalendarEventRepository
}

func NewCalendarService(db *gorm.DB) *CalendarService {
	return &CalendarService{
		repo: repository.NewCalendarEventRepository(db),
	}
}

func (s *CalendarService) CreateEvent(userID uint, req *dto.CreateCalendarEventRequest) (*dto.CalendarEventResponse, error) {
	if err := validateEventInterval(req.StartAt, req.EndAt); err != nil {
		return nil, err
	}

	event := model.CalendarEvent{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		StartAt:     req.StartAt,
		EndAt:       req.EndAt,
	}

	if err := s.repo.Create(&event); err != nil {
		return nil, errors.New("failed to create calendar event")
	}

	return event.ToResponse(), nil
}

func (s *CalendarService) GetEvents(userID uint, filter *dto.CalendarEventFilter) ([]*dto.CalendarEventResponse, error) {
	repoFilter := &repository.CalendarEventFilter{}
	if filter != nil {
		repoFilter.From = filter.From
		repoFilter.To = filter.To
	}

	events, err := s.repo.FindByUserID(userID, repoFilter)
	if err != nil {
		return nil, errors.New("failed to fetch calendar events")
	}

	responses := make([]*dto.CalendarEventResponse, len(events))
	for i := range events {
		responses[i] = events[i].ToResponse()
	}

	return responses, nil
}

func (s *CalendarService) GetEvent(userID, eventID uint) (*dto.CalendarEventResponse, error) {
	event, err := s.repo.FindByID(eventID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrCalendarEventNotFound) {
			return nil, errors.New("calendar event not found")
		}
		return nil, errors.New("failed to fetch calendar event")
	}

	return event.ToResponse(), nil
}

func (s *CalendarService) UpdateEvent(userID, eventID uint, req *dto.UpdateCalendarEventRequest) (*dto.CalendarEventResponse, error) {
	event, err := s.repo.FindByID(eventID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrCalendarEventNotFound) {
			return nil, errors.New("calendar event not found")
		}
		return nil, errors.New("failed to fetch calendar event")
	}

	startAt, endAt := event.StartAt, event.EndAt
	if req.StartAt != nil {
		startAt = *req.StartAt
	}
	if req.EndAt != nil {
		endAt = *req.EndAt
	}
	if validationErr := validateEventInterval(startAt, endAt); validationErr != nil {
		return nil, validationErr
	}

	updates := s.buildUpdateMap(req)
	if len(updates) == 0 {
		return event.ToResponse(), nil
	}

	if err = s.repo.Update(event, updates); err != nil {
		return nil, errors.New("failed to update calendar event")
	}

	updatedEvent, err := s.repo.FindByID(eventID, userID)
	if err != nil {
		return nil, errors.New("failed to fetch updated calendar event")
	}

	return updatedEvent.ToResponse(), nil
}

func (s *CalendarService) buildUpdateMap(req *dto.UpdateCalendarEventRequest) map[string]interface{} {
	updates := make(map[string]interface{})

	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.StartAt != nil {
		updates["start_at"] = *req.StartAt
	}
	if req.EndAt != nil {
		updates["end_at"] = *req.EndAt
	}

	return updates
}

func (s *CalendarService) DeleteEvent(userID, eventID uint) error {
	if err := s.repo.Delete(eventID, userID); err != nil {
		if errors.Is(err, repository.ErrCalendarEventNotFound) {
			return errors.New("calendar event not found")
		}
		return errors.New("failed to delete calendar event")
	}

	return nil
}

func validateEventInterval(start, end time.Time) error {
	if !end.After(start) {
		return errors.New("end must be after start")
	}
	if end.Sub(start) > maxEventDuration {
		return errors.New("calendar event cannot exceed 24 hours")
	}
	return nil
}
