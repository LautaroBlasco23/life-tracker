package controller

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"life-tracker-backend/internal/domain/data/service"

	"github.com/gin-gonic/gin"
)

const maxImportBytes = 32 << 20 // 32 MB

type DataController struct {
	backupService *service.BackupService
}

func NewDataController(backupService *service.BackupService) *DataController {
	return &DataController{backupService: backupService}
}

func getUserID(ctx *gin.Context) (uint, error) {
	value, exists := ctx.Get("userID")
	if !exists {
		return 0, errors.New("user ID not found in context")
	}
	userID, ok := value.(uint)
	if !ok {
		return 0, errors.New("invalid user ID type in context")
	}
	return userID, nil
}

// ExportData streams the user's full backup as an XLSX workbook.
func (c *DataController) ExportData(ctx *gin.Context) {
	userID, err := getUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	f, err := c.backupService.Export(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate backup"})
		return
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate backup"})
		return
	}

	filename := fmt.Sprintf("life-tracker-backup-%s.xlsx", time.Now().Format("2006-01-02"))
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	ctx.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

// ImportData performs a full restore from an uploaded XLSX backup: the
// user's current data is deleted and replaced with the file's contents.
func (c *DataController) ImportData(ctx *gin.Context) {
	userID, err := getUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	fileHeader, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
		return
	}
	if fileHeader.Size > maxImportBytes {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "File is too large"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Could not read uploaded file"})
		return
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			slog.Warn("failed to close uploaded file", "error", closeErr)
		}
	}()

	data := make([]byte, fileHeader.Size)
	if _, err = file.Read(data); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Could not read uploaded file"})
		return
	}

	counts, err := c.backupService.Restore(userID, data)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Data restored successfully",
		"data":    counts,
	})
}
