package repository

import (
	"life-tracker-backend/internal/domain/note-group/dto"
	"life-tracker-backend/internal/domain/note-group/model"

	"gorm.io/gorm"
)

type NoteGroupRepository struct {
	db *gorm.DB
}

func NewNoteGroupRepository(db *gorm.DB) *NoteGroupRepository {
	return &NoteGroupRepository{db: db}
}

func (r *NoteGroupRepository) Create(group *model.NoteGroup) error {
	return r.db.Create(group).Error
}

func (r *NoteGroupRepository) FindByID(id, userID uint) (*model.NoteGroup, error) {
	var group model.NoteGroup
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

func (r *NoteGroupRepository) FindByUserID(userID uint) ([]*model.NoteGroup, error) {
	var groups []*model.NoteGroup
	err := r.db.Where("user_id = ?", userID).
		Order("position ASC, created_at DESC, id DESC").
		Find(&groups).Error
	return groups, err
}

func (r *NoteGroupRepository) Update(group *model.NoteGroup) error {
	return r.db.Save(group).Error
}

// Delete soft-deletes the group and, in the same transaction, unassigns its
// notes (group_id = NULL) so they return to the ungrouped section instead of
// being orphaned or deleted.
func (r *NoteGroupRepository) Delete(id, userID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("notes").
			Where("group_id = ? AND user_id = ?", id, userID).
			Update("group_id", nil).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).Delete(&model.NoteGroup{}).Error
	})
}

// Reorder applies position changes in a single transaction.
// Rows not owned by userID are silently ignored (zero rows updated).
func (r *NoteGroupRepository) Reorder(userID uint, items []dto.NoteGroupPositionItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			if err := tx.Model(&model.NoteGroup{}).
				Where("id = ? AND user_id = ?", item.ID, userID).
				Update("position", item.Position).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
