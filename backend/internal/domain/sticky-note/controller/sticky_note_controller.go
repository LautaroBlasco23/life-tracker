package controller

import (
	"errors"
	"net/http"
	"strconv"

	"life-tracker-backend/internal/domain/sticky-note/dto"
	"life-tracker-backend/internal/domain/sticky-note/service"

	"github.com/gin-gonic/gin"
)

type StickyNoteController struct {
	service *service.StickyNoteService
}

func NewStickyNoteController(service *service.StickyNoteService) *StickyNoteController {
	return &StickyNoteController{service: service}
}

func (c *StickyNoteController) CreateStickyNote(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	var req dto.CreateStickyNoteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	note, err := c.service.CreateStickyNote(userID, &req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create sticky note"})
		return
	}

	ctx.JSON(http.StatusCreated, gin.H{
		"message": "Sticky note created successfully",
		"data":    note,
	})
}

func (c *StickyNoteController) GetStickyNote(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid sticky note ID"})
		return
	}

	note, err := c.service.GetStickyNote(uint(id), userID)
	if err != nil {
		if errors.Is(err, service.ErrStickyNoteNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Sticky note not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch sticky note"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Sticky note retrieved successfully",
		"data":    note,
	})
}

func (c *StickyNoteController) GetStickyNotes(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	notes, err := c.service.GetStickyNotes(userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to fetch sticky notes"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Sticky notes retrieved successfully",
		"data":    notes,
		"count":   len(notes),
	})
}

func (c *StickyNoteController) UpdateStickyNote(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid sticky note ID"})
		return
	}

	var req dto.UpdateStickyNoteRequest
	if err = ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	note, err := c.service.UpdateStickyNote(uint(id), userID, &req)
	if err != nil {
		if errors.Is(err, service.ErrStickyNoteNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Sticky note not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update sticky note"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Sticky note updated successfully",
		"data":    note,
	})
}

func (c *StickyNoteController) DeleteStickyNote(ctx *gin.Context) {
	userID := ctx.GetUint("userID")

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid sticky note ID"})
		return
	}

	if err := c.service.DeleteStickyNote(uint(id), userID); err != nil {
		if errors.Is(err, service.ErrStickyNoteNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "Sticky note not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete sticky note"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Sticky note deleted successfully"})
}
