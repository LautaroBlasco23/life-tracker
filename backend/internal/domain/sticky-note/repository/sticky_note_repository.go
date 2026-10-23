package repository

import (
	"life-tracker-backend/internal/domain/sticky-note/model"

	"gorm.io/gorm"
)

type StickyNoteRepository struct {
	db *gorm.DB
}

func NewStickyNoteRepository(db *gorm.DB) *StickyNoteRepository {
	return &StickyNoteRepository{db: db}
}

func (r *StickyNoteRepository) Create(note *model.StickyNote) error {
	return r.db.Create(note).Error
}

func (r *StickyNoteRepository) FindByID(id, userID uint) (*model.StickyNote, error) {
	var note model.StickyNote
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&note).Error
	if err != nil {
		return nil, err
	}
	return &note, nil
}

func (r *StickyNoteRepository) FindByUserID(userID uint) ([]*model.StickyNote, error) {
	var notes []*model.StickyNote
	err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC, id DESC").
		Find(&notes).Error
	return notes, err
}

func (r *StickyNoteRepository) Update(note *model.StickyNote) error {
	return r.db.Save(note).Error
}

func (r *StickyNoteRepository) Delete(id, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.StickyNote{}).Error
}
