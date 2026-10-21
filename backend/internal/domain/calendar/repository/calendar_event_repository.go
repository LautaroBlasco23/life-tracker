package repository

import (
	"errors"
	"time"

	"life-tracker-backend/internal/domain/calendar/model"

	"gorm.io/gorm"
)

var ErrCalendarEventNotFound = errors.New("calendar event not found")

// CalendarEventFilter selects events overlapping [From, To).
type CalendarEventFilter struct {
	From *time.Time
	To   *time.Time
}

type CalendarEventRepository interface {
	Create(event *model.CalendarEvent) error
	FindByID(id, userID uint) (*model.CalendarEvent, error)
	FindByUserID(userID uint, filter *CalendarEventFilter) ([]model.CalendarEvent, error)
	Update(event *model.CalendarEvent, updates map[string]interface{}) error
	Delete(id, userID uint) error
}

type GormCalendarEventRepository struct {
	db *gorm.DB
}

func NewCalendarEventRepository(db *gorm.DB) CalendarEventRepository {
	return &GormCalendarEventRepository{db: db}
}

func (r *GormCalendarEventRepository) Create(event *model.CalendarEvent) error {
	return r.db.Create(event).Error
}

func (r *GormCalendarEventRepository) FindByID(id, userID uint) (*model.CalendarEvent, error) {
	var event model.CalendarEvent
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&event).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCalendarEventNotFound
		}
		return nil, err
	}
	return &event, nil
}

// FindByUserID returns the user's events ordered by start time. A range filter
// keeps events that overlap the range at all, so a block crossing midnight (or
// the edge of the week) shows up in both weeks it touches.
func (r *GormCalendarEventRepository) FindByUserID(userID uint, filter *CalendarEventFilter) ([]model.CalendarEvent, error) {
	var events []model.CalendarEvent
	query := r.db.Where("user_id = ?", userID).Order("start_at ASC")

	if filter != nil {
		if filter.From != nil {
			query = query.Where("end_at > ?", filter.From.UTC())
		}
		if filter.To != nil {
			query = query.Where("start_at < ?", filter.To.UTC())
		}
	}

	if err := query.Find(&events).Error; err != nil {
		return nil, err
	}
	return events, nil
}

func (r *GormCalendarEventRepository) Update(event *model.CalendarEvent, updates map[string]interface{}) error {
	return r.db.Model(event).Updates(updates).Error
}

func (r *GormCalendarEventRepository) Delete(id, userID uint) error {
	result := r.db.Where("user_id = ?", userID).Delete(&model.CalendarEvent{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrCalendarEventNotFound
	}
	return nil
}
