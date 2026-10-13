package repository

import (
	"errors"

	"life-tracker-backend/internal/domain/note/dto"
	"life-tracker-backend/internal/domain/note/model"

	"gorm.io/gorm"
)

var ErrGroupNotFound = errors.New("note group not found")

type NoteRepository struct {
	db *gorm.DB
}

func NewNoteRepository(db *gorm.DB) *NoteRepository {
	return &NoteRepository{db: db}
}

func (r *NoteRepository) Create(note *model.Note) error {
	return r.db.Create(note).Error
}

func (r *NoteRepository) FindByID(id, userID uint) (*model.Note, error) {
	var note model.Note
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&note).Error
	if err != nil {
		return nil, err
	}
	return &note, nil
}

func (r *NoteRepository) FindByUserID(userID uint, filter *dto.NoteFilter) ([]*model.Note, error) {
	var notes []*model.Note
	query := r.db.Where("user_id = ?", userID)

	if filter != nil && filter.Query != "" {
		searchPattern := "%" + filter.Query + "%"
		query = query.Where("title ILIKE ? OR content ILIKE ?", searchPattern, searchPattern)
	}

	err := query.Order("position ASC, updated_at DESC, id DESC").Find(&notes).Error
	return notes, err
}

func (r *NoteRepository) Update(note *model.Note) error {
	return r.db.Save(note).Error
}

func (r *NoteRepository) Delete(id, userID uint) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Note{}).Error
}

// Reorder applies position and group assignment changes in a single transaction.
// Rows not owned by userID are silently ignored (zero rows updated).
func (r *NoteRepository) Reorder(userID uint, items []dto.NotePositionItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			updates := map[string]interface{}{
				"position": item.Position,
				"group_id": item.GroupID,
			}
			if err := tx.Model(&model.Note{}).
				Where("id = ? AND user_id = ?", item.ID, userID).
				Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ValidateGroupIDs returns an error if any of the given group IDs does not
// belong to userID (queries the note_groups table by name to avoid a
// cross-domain model import). Duplicates in the input are ignored: a reorder
// payload reindexes a whole section at once, so the same groupId repeats
// once per note in it.
func (r *NoteRepository) ValidateGroupIDs(userID uint, groupIDs []uint) error {
	if len(groupIDs) == 0 {
		return nil
	}

	unique := make([]uint, 0, len(groupIDs))
	seen := make(map[uint]struct{}, len(groupIDs))
	for _, id := range groupIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}

	var found []uint
	err := r.db.Table("note_groups").
		Where("user_id = ? AND id IN ? AND deleted_at IS NULL", userID, unique).
		Pluck("id", &found).Error
	if err != nil {
		return err
	}
	if len(found) != len(unique) {
		return ErrGroupNotFound
	}
	return nil
}
