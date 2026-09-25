package repository

import (
	"errors"

	"life-tracker-backend/internal/domain/reminder/model"

	"gorm.io/gorm"
)

var ErrReminderNotFound = errors.New("reminder not found")

type ReminderRepository interface {
	Create(reminder *model.Reminder) error
	FindByID(id, userID uint) (*model.Reminder, error)
	FindByUserID(userID uint) ([]model.Reminder, error)
	Update(reminder *model.Reminder, updates map[string]interface{}) error
	Delete(id, userID uint) error
}

type GormReminderRepository struct {
	db *gorm.DB
}

func NewReminderRepository(db *gorm.DB) ReminderRepository {
	return &GormReminderRepository{db: db}
}

func (r *GormReminderRepository) Create(reminder *model.Reminder) error {
	return r.db.Create(reminder).Error
}

func (r *GormReminderRepository) FindByID(id, userID uint) (*model.Reminder, error) {
	var reminder model.Reminder
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&reminder).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReminderNotFound
		}
		return nil, err
	}
	return &reminder, nil
}

func (r *GormReminderRepository) FindByUserID(userID uint) ([]model.Reminder, error) {
	var reminders []model.Reminder
	err := r.db.Where("user_id = ?", userID).Find(&reminders).Error
	return reminders, err
}

func (r *GormReminderRepository) Update(reminder *model.Reminder, updates map[string]interface{}) error {
	return r.db.Model(reminder).Updates(updates).Error
}

func (r *GormReminderRepository) Delete(id, userID uint) error {
	result := r.db.Where("user_id = ?", userID).Delete(&model.Reminder{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrReminderNotFound
	}
	return nil
}
