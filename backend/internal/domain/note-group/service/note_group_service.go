package service

import (
	"errors"

	"life-tracker-backend/internal/domain/note-group/dto"
	"life-tracker-backend/internal/domain/note-group/model"
	"life-tracker-backend/internal/domain/note-group/repository"

	"gorm.io/gorm"
)

var ErrNoteGroupNotFound = errors.New("note group not found")

type NoteGroupService struct {
	repo *repository.NoteGroupRepository
}

func NewNoteGroupService(db *gorm.DB) *NoteGroupService {
	return &NoteGroupService{
		repo: repository.NewNoteGroupRepository(db),
	}
}

func (s *NoteGroupService) CreateNoteGroup(userID uint, req *dto.CreateNoteGroupRequest) (*dto.NoteGroupResponse, error) {
	group := &model.NoteGroup{
		UserID: userID,
		Name:   req.Name,
	}

	if err := s.repo.Create(group); err != nil {
		return nil, err
	}

	return group.ToResponse(), nil
}

func (s *NoteGroupService) GetNoteGroup(id, userID uint) (*dto.NoteGroupResponse, error) {
	group, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNoteGroupNotFound
		}
		return nil, err
	}
	return group.ToResponse(), nil
}

func (s *NoteGroupService) GetNoteGroups(userID uint) ([]*dto.NoteGroupResponse, error) {
	groups, err := s.repo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]*dto.NoteGroupResponse, len(groups))
	for i, group := range groups {
		responses[i] = group.ToResponse()
	}
	return responses, nil
}

func (s *NoteGroupService) UpdateNoteGroup(id, userID uint, req *dto.UpdateNoteGroupRequest) (*dto.NoteGroupResponse, error) {
	group, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNoteGroupNotFound
		}
		return nil, err
	}

	if req.Name != nil {
		group.Name = *req.Name
	}

	if err := s.repo.Update(group); err != nil {
		return nil, err
	}

	return group.ToResponse(), nil
}

func (s *NoteGroupService) DeleteNoteGroup(id, userID uint) error {
	// DeleteNote unassigns the group's notes in the same transaction; if the
	// group is not found no rows are touched, but the caller still reports
	// not-found via an explicit ownership check to keep the HTTP contract
	// consistent with notes.
	if _, err := s.repo.FindByID(id, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNoteGroupNotFound
		}
		return err
	}

	return s.repo.Delete(id, userID)
}

func (s *NoteGroupService) ReorderNoteGroups(userID uint, req *dto.ReorderNoteGroupsRequest) error {
	return s.repo.Reorder(userID, req.Items)
}
