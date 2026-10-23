package service

import (
	"errors"

	"life-tracker-backend/internal/domain/sticky-note/dto"
	"life-tracker-backend/internal/domain/sticky-note/model"
	"life-tracker-backend/internal/domain/sticky-note/repository"
	"life-tracker-backend/internal/infrastructure/monitoring"

	"gorm.io/gorm"
)

var ErrStickyNoteNotFound = errors.New("sticky note not found")

type StickyNoteService struct {
	repo *repository.StickyNoteRepository
}

func NewStickyNoteService(db *gorm.DB) *StickyNoteService {
	return &StickyNoteService{
		repo: repository.NewStickyNoteRepository(db),
	}
}

func (s *StickyNoteService) CreateStickyNote(userID uint, req *dto.CreateStickyNoteRequest) (*dto.StickyNoteResponse, error) {
	note := &model.StickyNote{UserID: userID}
	if req.Title != nil {
		note.Title = *req.Title
	}
	if req.Description != nil {
		note.Description = *req.Description
	}

	if err := s.repo.Create(note); err != nil {
		return nil, err
	}

	monitoring.StickyNotesCreated.Inc()
	monitoring.ActiveStickyNotes.Inc()

	return note.ToResponse(), nil
}

func (s *StickyNoteService) GetStickyNote(id, userID uint) (*dto.StickyNoteResponse, error) {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrStickyNoteNotFound
		}
		return nil, err
	}
	return note.ToResponse(), nil
}

func (s *StickyNoteService) GetStickyNotes(userID uint) ([]*dto.StickyNoteResponse, error) {
	notes, err := s.repo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	responses := make([]*dto.StickyNoteResponse, len(notes))
	for i, note := range notes {
		responses[i] = note.ToResponse()
	}
	return responses, nil
}

func (s *StickyNoteService) UpdateStickyNote(id, userID uint, req *dto.UpdateStickyNoteRequest) (*dto.StickyNoteResponse, error) {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrStickyNoteNotFound
		}
		return nil, err
	}

	if req.Title != nil {
		note.Title = *req.Title
	}
	if req.Description != nil {
		note.Description = *req.Description
	}

	if err := s.repo.Update(note); err != nil {
		return nil, err
	}

	monitoring.StickyNotesUpdated.Inc()

	return note.ToResponse(), nil
}

func (s *StickyNoteService) DeleteStickyNote(id, userID uint) error {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrStickyNoteNotFound
		}
		return err
	}

	if err := s.repo.Delete(note.ID, userID); err != nil {
		return err
	}

	monitoring.StickyNotesDeleted.Inc()
	monitoring.ActiveStickyNotes.Dec()

	return nil
}
