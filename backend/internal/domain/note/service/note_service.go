package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"path/filepath"
	"strings"

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

// noteImageStore is the subset of the imagestore client the note domain needs.
// Defined as an interface so tests can fake uploads without S3.
type noteImageStore interface {
	UploadNoteImage(ctx context.Context, userID uint, imageData []byte, filename string) (string, error)
}

type NoteService struct {
	repo   *repository.NoteRepository
	images noteImageStore
}

func NewNoteService(db *gorm.DB, images noteImageStore) *NoteService {
	return &NoteService{
		repo:   repository.NewNoteRepository(db),
		images: images,
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

// UploadNoteImage stores a pasted screenshot for embedding in note markdown
// and returns its public URL. It mirrors the avatar upload flow (same size /
// type validation) but does not touch the database: the URL is referenced
// from the note content itself.
func (s *NoteService) UploadNoteImage(ctx context.Context, userID uint, file *multipart.FileHeader) (string, error) {
	if err := validateNoteImageFile(file); err != nil {
		return "", err
	}

	src, err := file.Open()
	if err != nil {
		return "", errors.New("failed to open uploaded file")
	}
	defer func() {
		if closeErr := src.Close(); closeErr != nil {
			slog.Warn("failed to close uploaded file", "error", closeErr)
		}
	}()

	imageData, err := io.ReadAll(src)
	if err != nil {
		return "", errors.New("failed to read file data")
	}

	url, err := s.images.UploadNoteImage(ctx, userID, imageData, file.Filename)
	if err != nil {
		return "", fmt.Errorf("failed to upload image: %w", err)
	}

	monitoring.NoteImageUploads.Inc()

	return url, nil
}

func validateNoteImageFile(file *multipart.FileHeader) error {
	const maxSize = 10 * 1024 * 1024
	if file.Size > maxSize {
		return errors.New("file size exceeds 10MB limit")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
	}

	if !allowedExts[ext] {
		return errors.New("invalid file type, only JPG, PNG, and WebP are allowed")
	}

	return nil
}
