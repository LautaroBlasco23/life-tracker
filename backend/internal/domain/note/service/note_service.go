package service

import (
	"errors"

	"life-tracker-backend/internal/domain/note/dto"
	"life-tracker-backend/internal/domain/note/model"
	"life-tracker-backend/internal/domain/note/repository"
	"life-tracker-backend/internal/infrastructure/monitoring"

	"gorm.io/gorm"
)

var (
	ErrNoteNotFound  = errors.New("note not found")
	ErrGroupNotFound = repository.ErrGroupNotFound
)

type NoteService struct {
	repo *repository.NoteRepository
}

func NewNoteService(db *gorm.DB) *NoteService {
	return &NoteService{
		repo: repository.NewNoteRepository(db),
	}
}

func (s *NoteService) CreateNote(userID uint, req *dto.CreateNoteRequest) (*dto.NoteResponse, error) {
	note := &model.Note{
		UserID:  userID,
		Title:   req.Title,
		Content: req.Content,
	}

	if err := s.repo.Create(note); err != nil {
		return nil, err
	}

	monitoring.NotesCreated.Inc()
	monitoring.ActiveNotes.Inc()
	monitoring.NoteContentLength.Observe(float64(len(note.Content)))

	return note.ToResponse(), nil
}

func (s *NoteService) GetNote(id, userID uint) (*dto.NoteResponse, error) {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNoteNotFound
		}
		return nil, err
	}
	return note.ToResponse(), nil
}

func (s *NoteService) GetNotes(userID uint, filter *dto.NoteFilter) ([]*dto.NoteResponse, error) {
	notes, err := s.repo.FindByUserID(userID, filter)
	if err != nil {
		return nil, err
	}

	responses := make([]*dto.NoteResponse, len(notes))
	for i, note := range notes {
		responses[i] = note.ToResponse()
	}
	return responses, nil
}

func (s *NoteService) UpdateNote(id, userID uint, req *dto.UpdateNoteRequest) (*dto.NoteResponse, error) {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNoteNotFound
		}
		return nil, err
	}

	if req.Title != nil {
		note.Title = *req.Title
	}
	if req.Content != nil {
		note.Content = *req.Content
	}

	if err := s.repo.Update(note); err != nil {
		return nil, err
	}

	monitoring.NotesUpdated.Inc()
	monitoring.NoteContentLength.Observe(float64(len(note.Content)))

	return note.ToResponse(), nil
}

func (s *NoteService) DeleteNote(id, userID uint) error {
	note, err := s.repo.FindByID(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNoteNotFound
		}
		return err
	}

	if err := s.repo.Delete(note.ID, userID); err != nil {
		return err
	}

	monitoring.NotesDeleted.Inc()
	monitoring.ActiveNotes.Dec()

	return nil
}

// ReorderNotes applies position and group changes for the user's notes.
// Group IDs are validated against the requesting user before persisting.
func (s *NoteService) ReorderNotes(userID uint, req *dto.ReorderNotesRequest) error {
	groupIDs := make([]uint, 0, len(req.Items))
	for _, item := range req.Items {
		if item.GroupID != nil {
			groupIDs = append(groupIDs, *item.GroupID)
		}
	}

	if err := s.repo.ValidateGroupIDs(userID, groupIDs); err != nil {
		return err
	}

	return s.repo.Reorder(userID, req.Items)
}
