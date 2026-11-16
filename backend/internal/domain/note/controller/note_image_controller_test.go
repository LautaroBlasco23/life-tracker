// note_image_controller_test.go
//
// Subject:      internal/domain/note/controller.NoteController.UploadNoteImage.
// Scope:        HTTP contract for POST /notes/images — multipart field,
//
//	status codes and the {message, data:{url}} envelope.
//
// Out of scope: Service-layer rules → note_service_test.go
//
//	Storage keys / S3 wiring → imagestore client.
//
// Infrastructure: None (the image store is faked; the upload path never
//
//	touches the database).
//
// Parallel-safe: Yes — no shared state.
package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"life-tracker-backend/internal/domain/note/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeNoteImageStore stands in for *imagestore.Client (the note service
// consumes it through an interface, so no real S3 is needed).
type fakeNoteImageStore struct {
	url string
	err error
}

func (f *fakeNoteImageStore) UploadNoteImage(
	_ context.Context, _ uint, _ []byte, _ string,
) (string, error) {
	return f.url, f.err
}

func setupNoteImageRouter(t *testing.T, store *fakeNoteImageStore) *gin.Engine {
	t.Helper()

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", uint(1))
		c.Next()
	})
	noteService := service.NewNoteService(nil, store)
	r.POST("/notes/images", NewNoteController(noteService).UploadNoteImage)
	return r
}

func noteImageMultipartBody(t *testing.T, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("image", filename)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	return body, writer.FormDataContentType()
}

func TestUploadNoteImageSuccess(t *testing.T) {
	router := setupNoteImageRouter(t, &fakeNoteImageStore{url: "http://cdn.test/notes/1/abc.png"})

	body, contentType := noteImageMultipartBody(t, "screenshot.png", []byte("fake png bytes"))
	req := httptest.NewRequest(http.MethodPost, "/notes/images", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var res struct {
		Message string `json:"message"`
		Data    struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &res))
	assert.Equal(t, "Note image uploaded successfully", res.Message)
	assert.Equal(t, "http://cdn.test/notes/1/abc.png", res.Data.URL)
}

func TestUploadNoteImageNoFile(t *testing.T) {
	router := setupNoteImageRouter(t, &fakeNoteImageStore{url: "unused"})

	req := httptest.NewRequest(http.MethodPost, "/notes/images", nil)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=none")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "No image file provided")
}

func TestUploadNoteImageTooLarge(t *testing.T) {
	router := setupNoteImageRouter(t, &fakeNoteImageStore{url: "unused"})

	// One byte over the 10MB cap enforced by the service.
	oversized := make([]byte, 10*1024*1024+1)
	body, contentType := noteImageMultipartBody(t, "screenshot.png", oversized)

	req := httptest.NewRequest(http.MethodPost, "/notes/images", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "file size exceeds 10MB limit")
}

func TestUploadNoteImageInvalidType(t *testing.T) {
	router := setupNoteImageRouter(t, &fakeNoteImageStore{url: "unused"})

	body, contentType := noteImageMultipartBody(t, "animation.gif", []byte("gif bytes"))
	req := httptest.NewRequest(http.MethodPost, "/notes/images", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid file type")
}

func TestUploadNoteImageStoreError(t *testing.T) {
	router := setupNoteImageRouter(t, &fakeNoteImageStore{
		err: errors.New("s3 unavailable"),
	})

	body, contentType := noteImageMultipartBody(t, "screenshot.png", []byte("fake png bytes"))
	req := httptest.NewRequest(http.MethodPost, "/notes/images", body)
	req.Header.Set("Content-Type", contentType)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "s3 unavailable")
}
