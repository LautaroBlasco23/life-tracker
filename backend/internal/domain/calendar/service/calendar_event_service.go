package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"life-tracker-backend/internal/domain/calendar/dto"
	"life-tracker-backend/internal/domain/calendar/model"
	"life-tracker-backend/internal/domain/calendar/repository"

	"gorm.io/gorm"
)

const (
	maxEventDuration = 24 * time.Hour
	// maxOccurrencesPerSeries caps how many rows a single series may create.
	maxOccurrencesPerSeries = 100
	// maxRecurrenceIntervalWeeks is the widest gap between two occurrences.
	maxRecurrenceIntervalWeeks = 52
	// daysPerWeek is the step of a weekly rule.
	daysPerWeek = 7
)

type CalendarService struct {
	repo repository.CalendarEventRepository
}

func NewCalendarService(db *gorm.DB) *CalendarService {
	return &CalendarService{
		repo: repository.NewCalendarEventRepository(db),
	}
}

// CreateEvent stores a new event. `loc` is the user's timezone (from the
// X-Timezone header) and is only used to materialize a recurring series: the
// occurrences keep the wall-clock time of the first one across DST changes.
// A nil location falls back to UTC.
func (s *CalendarService) CreateEvent(userID uint, req *dto.CreateCalendarEventRequest, loc *time.Location) (*dto.CalendarEventResponse, error) {
	if err := validateEventInterval(req.StartAt, req.EndAt); err != nil {
		return nil, err
	}

	if req.Recurrence != nil {
		return s.createRecurringEvent(userID, req, loc)
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

// createRecurringEvent materializes a recurring event: one row per
// occurrence, all of them sharing a series id. The read path stays untouched
// because every occurrence is an ordinary event.
//
// All occurrences are written in a single transaction: a failure half way
// through must not leave a partial series behind.
func (s *CalendarService) createRecurringEvent(userID uint, req *dto.CreateCalendarEventRequest, loc *time.Location) (*dto.CalendarEventResponse, error) {
	occurrences, weekdays, err := buildOccurrences(userID, req, loc)
	if err != nil {
		return nil, err
	}

	seriesID, err := newSeriesID()
	if err != nil {
		return nil, errors.New("failed to create calendar event")
	}

	rule := dto.RecurrenceRuleWeekly
	interval := recurrenceInterval(req.Recurrence)
	until := *req.Recurrence.Until
	weekdaysEcho := strings.Join(weekdays, ",")

	for i := range occurrences {
		index := i
		occurrences[i].SeriesID = &seriesID
		occurrences[i].OccurrenceIndex = &index
		occurrences[i].RecurrenceRule = &rule
		occurrences[i].RecurrenceUntil = &until
		occurrences[i].RecurrenceInterval = &interval
		occurrences[i].RecurrenceWeekdays = &weekdaysEcho
	}

	if err := s.repo.WithinTransaction(func(txRepo repository.CalendarEventRepository) error {
		for i := range occurrences {
			if err := txRepo.Create(&occurrences[i]); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, errors.New("failed to create calendar event")
	}

	return occurrences[0].ToResponse(), nil
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

	if req.Scope == dto.ScopeSeries && event.SeriesID != nil {
		if seriesErr := s.updateSeries(userID, event, updates, startAt, endAt); seriesErr != nil {
			return nil, seriesErr
		}
	} else if updateErr := s.repo.Update(event, updates); updateErr != nil {
		return nil, errors.New("failed to update calendar event")
	}

	updatedEvent, err := s.repo.FindByID(eventID, userID)
	if err != nil {
		return nil, errors.New("failed to fetch updated calendar event")
	}

	return updatedEvent.ToResponse(), nil
}

// updateSeries applies a change to every occurrence of a series. A new start
// shifts the whole series by the same amount and the edited occurrence's new
// duration is applied to all of them, so the series stays consistent.
func (s *CalendarService) updateSeries(userID uint, target *model.CalendarEvent, updates map[string]interface{}, newStart, newEnd time.Time) error {
	occurrences, err := s.repo.FindBySeries(userID, *target.SeriesID)
	if err != nil {
		return errors.New("failed to fetch calendar series")
	}
	if len(occurrences) == 0 {
		return errors.New("calendar event not found")
	}

	delta := newStart.Sub(target.StartAt)
	duration := newEnd.Sub(newStart)

	// The series is updated in one transaction: a failure half way through
	// must not leave some occurrences updated and others not.
	return s.repo.WithinTransaction(func(txRepo repository.CalendarEventRepository) error {
		for i := range occurrences {
			occurrence := occurrences[i]
			occurrenceUpdates := make(map[string]interface{}, len(updates))
			for key, value := range updates {
				occurrenceUpdates[key] = value
			}

			if _, moved := occurrenceUpdates["start_at"]; moved {
				occurrenceUpdates["start_at"] = occurrence.StartAt.Add(delta)
				occurrenceUpdates["end_at"] = occurrence.StartAt.Add(delta).Add(duration)
			} else if _, resized := occurrenceUpdates["end_at"]; resized {
				occurrenceUpdates["end_at"] = occurrence.StartAt.Add(duration)
			}

			if err := txRepo.Update(&occurrence, occurrenceUpdates); err != nil {
				return err
			}
		}
		return nil
	})
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

// DeleteEvent removes one occurrence of an event. With scope "series" every
// occurrence of the series the event belongs to is removed instead.
func (s *CalendarService) DeleteEvent(userID, eventID uint, scope string) error {
	if scope == dto.ScopeSeries {
		if err := s.deleteSeries(userID, eventID); err != nil {
			return err
		}
		return nil
	}

	if err := s.repo.Delete(eventID, userID); err != nil {
		if errors.Is(err, repository.ErrCalendarEventNotFound) {
			return errors.New("calendar event not found")
		}
		return errors.New("failed to delete calendar event")
	}

	return nil
}

// deleteSeries removes every occurrence of the series the event belongs to.
// An event that is not part of a series is deleted like a single occurrence.
func (s *CalendarService) deleteSeries(userID, eventID uint) error {
	event, err := s.repo.FindByID(eventID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrCalendarEventNotFound) {
			return errors.New("calendar event not found")
		}
		return errors.New("failed to fetch calendar event")
	}

	if event.SeriesID == nil {
		if deleteErr := s.repo.Delete(eventID, userID); deleteErr != nil {
			if errors.Is(deleteErr, repository.ErrCalendarEventNotFound) {
				return errors.New("calendar event not found")
			}
			return errors.New("failed to delete calendar event")
		}
		return nil
	}

	deleted, err := s.repo.DeleteSeries(userID, *event.SeriesID)
	if err != nil {
		return errors.New("failed to delete calendar event")
	}
	if deleted == 0 {
		return errors.New("calendar event not found")
	}

	return nil
}

// buildOccurrences materializes the occurrences of a weekly rule. Every
// occurrence keeps the time of day of the first one, repeats on the week days
// of the rule (default: the first occurrence's weekday), and the series stops
// at `until`.
//
// The step is applied on the wall clock in the user's timezone (not by adding
// 7*24h to the instant): a class at 10:00 stays at 10:00 after a DST change.
// `loc` may be nil, in which case UTC is used.
//
// It returns the occurrences plus the normalized day names (sorted, lowercase,
// de-duplicated) used to expand the series, so callers can persist the echo.
func buildOccurrences(userID uint, req *dto.CreateCalendarEventRequest, loc *time.Location) ([]model.CalendarEvent, []string, error) {
	recurrence := req.Recurrence
	if recurrence == nil {
		return nil, nil, errors.New("recurrence is required")
	}
	if recurrence.Rule != dto.RecurrenceRuleWeekly {
		return nil, nil, errors.New("unsupported recurrence rule")
	}
	if recurrence.Until == nil {
		return nil, nil, errors.New("recurrence until is required for weekly events")
	}

	interval := recurrenceInterval(recurrence)
	if interval < 1 || interval > maxRecurrenceIntervalWeeks {
		return nil, nil, fmt.Errorf("recurrence interval must be between 1 and %d weeks", maxRecurrenceIntervalWeeks)
	}

	until := *recurrence.Until
	if until.Before(req.StartAt) {
		return nil, nil, errors.New("recurrence until must not be before the event start")
	}

	if loc == nil {
		loc = time.UTC
	}

	localStart := req.StartAt.In(loc)
	weekdays, err := normalizeWeekdays(recurrence.Weekdays, localStart)
	if err != nil {
		return nil, nil, err
	}

	duration := req.EndAt.Sub(req.StartAt)
	step := daysPerWeek * interval
	startOffset := weekdayOffset(localStart)

	// Candidates are generated week by week, days in ascending order, so the
	// sequence is strictly increasing: the first candidate past `until` ends
	// the whole series. Candidates of the starting week that fall before the
	// event start (selected days earlier in that week) are skipped.
	occurrences := make([]model.CalendarEvent, 0, len(weekdays)*2)
	for weeks := 0; ; weeks++ {
		for _, dayOffset := range weekdayOffsets(weekdays) {
			start := localStart.AddDate(0, 0, weeks*step+dayOffset-startOffset).UTC()
			if start.Before(req.StartAt) {
				continue
			}
			if start.After(until) {
				return occurrences, weekdays, nil
			}
			if len(occurrences) >= maxOccurrencesPerSeries {
				return nil, nil, fmt.Errorf("recurring event exceeds the maximum of %d occurrences", maxOccurrencesPerSeries)
			}

			occurrences = append(occurrences, model.CalendarEvent{
				UserID:      userID,
				Title:       req.Title,
				Description: req.Description,
				Category:    req.Category,
				StartAt:     start,
				EndAt:       start.Add(duration),
			})
		}
	}
}

// weekdayNames maps the Monday-based offset (0-6) returned by weekdayOffset
// to the day name used on the API surface.
var weekdayNames = [7]string{
	"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

var weekdayNameOffsets = func() map[string]int {
	offsets := make(map[string]int, len(weekdayNames))
	for offset, name := range weekdayNames {
		offsets[name] = offset
	}
	return offsets
}()

// weekdayOffset maps a time.Time to its position in the week starting on
// Monday (Monday=0 … Sunday=6), independently of time.Time's Sunday-based
// Weekday().
func weekdayOffset(t time.Time) int {
	return (int(t.Weekday()) + 6) % 7
}

// normalizeWeekdays validates the requested day names and returns them as
// sorted, de-duplicated offsets. An empty list defaults to the weekday of
// `localStart`, preserving the behavior of rules without weekdays.
func normalizeWeekdays(raw []string, localStart time.Time) ([]string, error) {
	if len(raw) == 0 {
		return []string{weekdayNames[weekdayOffset(localStart)]}, nil
	}

	offsets := make([]int, 0, len(raw))
	seen := make(map[int]bool, len(raw))
	for _, name := range raw {
		offset, ok := weekdayNameOffsets[strings.ToLower(strings.TrimSpace(name))]
		if !ok {
			return nil, fmt.Errorf("unsupported recurrence weekday %q", name)
		}
		if seen[offset] {
			continue
		}
		seen[offset] = true
		offsets = append(offsets, offset)
	}
	sort.Ints(offsets)

	names := make([]string, len(offsets))
	for i, offset := range offsets {
		names[i] = weekdayNames[offset]
	}
	return names, nil
}

// weekdayOffsets maps normalized day names back to their numeric offsets.
func weekdayOffsets(weekdays []string) []int {
	offsets := make([]int, len(weekdays))
	for i, name := range weekdays {
		offsets[i] = weekdayNameOffsets[name]
	}
	return offsets
}

// recurrenceInterval returns the number of weeks between two occurrences.
func recurrenceInterval(recurrence *dto.CalendarRecurrenceRequest) int {
	if recurrence == nil || recurrence.Interval == nil {
		return 1
	}
	return *recurrence.Interval
}

// newSeriesID returns the identifier shared by every occurrence of a series.
func newSeriesID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
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
